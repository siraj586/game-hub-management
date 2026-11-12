import shutil
import tempfile
from datetime import datetime, time, timedelta
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.test import override_settings
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITransactionTestCase

from api.business_day import business_date_of, business_today, day_bounds
from api.models import AuditLog, ResourceType, ResourceUnit, Session, User
from api.models.core_model import BusinessDaySettings, DailyReport
from .base import BaseAPITestCase

CLOSE_URL = "/api/daily-reports/close_day/"


class SessionFixtureMixin:
    def make_unit(self):
        resource_type = ResourceType.objects.create(
            name="PC", code="PC_TYPE", prefix="PC", base_price=10
        )
        return ResourceUnit.objects.create(resource_type=resource_type, code="PC-01")

    def make_ended(self, unit, end_time, cost="7.00", currency="USD", paid=None):
        session = Session.objects.create(customer_name="Done", resource_unit=unit)
        session.end_time = end_time
        session.final_cost = Decimal(cost)
        session.original_payment_currency = currency
        session.original_payment_amount = Decimal(paid or cost)
        session.exchange_rate = Decimal("1")
        session.save()
        return session


class BusinessDayTests(SessionFixtureMixin, BaseAPITestCase):
    def local(self, day, hour, minute=0):
        return timezone.make_aware(datetime.combine(day, time(hour, minute)))

    def test_session_after_midnight_counts_for_previous_day(self):
        self.authenticate("owner")
        unit = self.make_unit()
        day = business_today() - timedelta(days=3)
        self.make_ended(unit, self.local(day + timedelta(days=1), 1, 30))
        self.make_ended(unit, self.local(day + timedelta(days=1), 5), cost="3.00")

        response = self.client.get(
            "/api/analytics/",
            {"period": "custom", "start": day.isoformat(), "end": (day + timedelta(days=1)).isoformat()},
        )

        breakdown = {row["date"]: row["totalRevenue"] for row in response.data["dailyBreakdown"]}
        self.assertEqual(breakdown[day.isoformat()], 7.0)
        self.assertEqual(breakdown[(day + timedelta(days=1)).isoformat()], 3.0)

    def test_bounds_and_date_agree_at_the_boundary(self):
        day = business_today() - timedelta(days=1)
        start, end = day_bounds(day, start_hour=4)
        self.assertEqual(business_date_of(start, 4), day)
        self.assertEqual(business_date_of(end - timedelta(seconds=1), 4), day)
        self.assertEqual(business_date_of(end, 4), day + timedelta(days=1))

    def test_session_reports_whether_it_is_in_current_business_day(self):
        self.authenticate("owner")
        unit = self.make_unit()
        current = self.make_ended(unit, timezone.now())
        old = self.make_ended(unit, timezone.now() - timedelta(days=2))

        rows = {row["id"]: row for row in self.client.get("/api/sessions/").data["results"]}

        self.assertTrue(rows[current.id]["inCurrentBusinessDay"])
        self.assertFalse(rows[old.id]["inCurrentBusinessDay"])

    def test_start_hour_is_validated_and_owner_only(self):
        url = "/api/business-day-settings/"
        self.authenticate("staff")
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        self.authenticate("owner")
        self.assertEqual(
            self.client.patch(url, {"start_hour": 24}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        response = self.client.patch(url, {"start_hour": 6}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(BusinessDaySettings.get_solo().start_hour, 6)


class HarvestTests(SessionFixtureMixin, BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.authenticate("owner")
        self.unit = self.make_unit()
        self.today = business_today().isoformat()

    def close(self, **extra):
        return self.client.post(CLOSE_URL, {"date": self.today, **extra}, format="json")

    def test_cash_count_records_the_difference(self):
        self.make_ended(self.unit, timezone.now(), cost="10.00")

        response = self.close(counted_usd="8.50")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["actual_usd_received"], "10.00")
        self.assertEqual(response.data["counted_usd"], "8.50")
        self.assertEqual(response.data["usd_variance"], "-1.50")
        self.assertIsNone(response.data["local_variance"])
        self.assertEqual(response.data["closed_by"], "owner")

    def test_negative_cash_count_is_rejected(self):
        self.assertEqual(self.close(counted_usd="-1").status_code, status.HTTP_400_BAD_REQUEST)

    def test_future_day_cannot_be_closed(self):
        tomorrow = (business_today() + timedelta(days=1)).isoformat()
        response = self.client.post(CLOSE_URL, {"date": tomorrow}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(DailyReport.objects.filter(date=tomorrow).exists())

    def test_closing_again_without_changes_is_a_conflict(self):
        self.make_ended(self.unit, timezone.now())
        self.assertEqual(self.close().status_code, status.HTTP_200_OK)
        self.assertEqual(self.close().status_code, status.HTTP_409_CONFLICT)

    def test_late_session_updates_report_and_keeps_the_old_figures(self):
        self.make_ended(self.unit, timezone.now(), cost="10.00")
        self.close(counted_usd="10.00")

        late = self.make_ended(self.unit, timezone.now(), cost="5.00")
        preview = self.client.get("/api/daily-reports/preview/", {"date": self.today})
        self.assertTrue(preview.data["already_closed"])
        self.assertTrue(preview.data["has_changes"])
        self.assertEqual(preview.data["total_revenue"], "15.00")

        response = self.close(counted_usd="15.00")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_revenue"], "15.00")
        self.assertEqual(response.data["usd_variance"], "0.00")
        revisions = response.data["metadata"]["revisions"]
        self.assertEqual(len(revisions), 1)
        self.assertEqual(revisions[0]["total_revenue"], "10.00")
        late.refresh_from_db()
        self.assertTrue(late.metadata.get("hidden_from_activity"))

    def test_preview_warns_about_running_sessions_and_changes_nothing(self):
        running = Session.objects.create(customer_name="Running", resource_unit=self.unit)

        response = self.client.get("/api/daily-reports/preview/", {"date": self.today})

        self.assertEqual(
            response.data["running_sessions"],
            [{"id": running.id, "name": "Running", "stationId": "PC-01"}],
        )
        self.assertFalse(response.data["already_closed"])
        self.assertFalse(DailyReport.objects.exists())

    def test_export_is_a_workbook_in_the_requested_range(self):
        self.make_ended(self.unit, timezone.now(), cost="10.00")
        self.close(counted_usd="9.00")
        DailyReport.objects.create(date=business_today() - timedelta(days=30))

        response = self.client.get(
            "/api/daily-reports/export/", {"start": self.today, "lang": "ar"}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sheet = load_workbook(BytesIO(response.content)).active
        rows = list(sheet.values)
        self.assertTrue(sheet.sheet_view.rightToLeft)
        self.assertEqual(rows[0][0], "التاريخ")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][0], self.today)
        self.assertEqual(rows[1][3], 10.0)
        self.assertEqual(rows[1][8], -1.0)

    def test_reports_require_permission(self):
        self.authenticate("staff")
        for url in ("/api/daily-reports/export/", "/api/daily-reports/preview/"):
            self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)


class HideSessionTests(SessionFixtureMixin, BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.unit = self.make_unit()
        self.session = self.make_ended(self.unit, timezone.now())
        self.url = f"/api/sessions/{self.session.id}/"

    def test_reason_is_required(self):
        self.authenticate("owner")
        response = self.client.delete(self.url, {"reason": "  "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.session.refresh_from_db()
        self.assertFalse(self.session.metadata.get("hidden_from_activity"))

    def test_hiding_keeps_the_revenue_and_records_the_reason(self):
        self.authenticate("owner")
        response = self.client.delete(self.url, {"reason": "Test entry"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.metadata["hidden_reason"], "Test entry")
        analytics = self.client.get("/api/analytics/", {"period": "today"})
        self.assertEqual(analytics.data["completedRevenue"], 7.0)
        self.assertTrue(AuditLog.objects.filter(description__contains="Test entry").exists())

    def test_running_session_cannot_be_hidden(self):
        self.authenticate("owner")
        running = Session.objects.create(customer_name="Running", resource_unit=self.unit)
        response = self.client.delete(
            f"/api/sessions/{running.id}/", {"reason": "x"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_staff_cannot_hide(self):
        self.authenticate("staff")
        response = self.client.delete(self.url, {"reason": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class BackupTests(SessionFixtureMixin, APITransactionTestCase):
    url = "/api/backups/"

    def setUp(self):
        self.directory = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.directory, ignore_errors=True)
        override = override_settings(BACKUP_DIR=self.directory)
        override.enable()
        self.addCleanup(override.disable)

        self.owner = User.objects.create_user(
            username="owner", password="password", role=User.ROLE_OWNER
        )
        token = Token.objects.create(user=self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_restore_brings_back_the_saved_data_and_keeps_a_safety_copy(self):
        unit = self.make_unit()
        kept = self.make_ended(unit, timezone.now())
        name = self.client.post(self.url).data["name"]

        kept.customer_name = "Changed after the backup"
        kept.save()
        added_later = self.make_ended(unit, timezone.now())

        response = self.client.post(f"{self.url}{name}/restore/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Session.objects.get(pk=kept.pk).customer_name, "Done")
        self.assertFalse(Session.objects.filter(pk=added_later.pk).exists())
        kinds = {item["kind"] for item in self.client.get(self.url).data["backups"]}
        self.assertEqual(kinds, {"manual", "pre-restore"})

    def test_download_returns_the_file(self):
        name = self.client.post(self.url).data["name"]
        response = self.client.get(f"{self.url}{name}/download/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = b"".join(response.streaming_content)
        self.assertTrue(content.startswith(b"SQLite format 3"))

    def test_path_traversal_names_are_rejected(self):
        for name in ("..%2F..%2Fdb.sqlite3", "db.sqlite3", "gamehub-1-auto.sqlite3"):
            response = self.client.get(f"{self.url}{name}/download/")
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND, name)

    def test_a_file_that_is_not_a_database_is_not_restored(self):
        unit = self.make_unit()
        kept = self.make_ended(unit, timezone.now())
        fake = "gamehub-20260101-000000-manual.sqlite3"
        (Path(self.directory) / fake).write_bytes(b"not a database")

        response = self.client.post(f"{self.url}{fake}/restore/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Session.objects.filter(pk=kept.pk).exists())

    def test_backups_are_owner_only(self):
        staff = User.objects.create_user(username="staff", password="password", role=User.ROLE_STAFF)
        token = Token.objects.create(user=staff)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(self.url).status_code, status.HTTP_403_FORBIDDEN)
