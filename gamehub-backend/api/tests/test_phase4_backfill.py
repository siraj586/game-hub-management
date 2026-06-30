"""
Phase 4 — migration backfill tests.

We call the migration's Python function directly (no need to apply the
actual migration; the DB schema is already up-to-date in the test DB).
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

import importlib

_migration = importlib.import_module(
    "api.migrations.0012_backfill_unknown_legacy_payment_data"
)
backfill_unknown_legacy_rows = _migration.backfill_unknown_legacy_rows
from api.models import (
    InventoryCategory,
    InventoryItem,
    ResourceType,
    ResourceUnit,
    Sale,
    Session,
    User,
)


def _run_backfill():
    """Execute the forward migration function with live apps/schema_editor stubs."""
    from django.apps import apps
    backfill_unknown_legacy_rows(apps, None)


class Phase4BackfillTests(TestCase):

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", password="pw", role=User.ROLE_OWNER
        )
        self.cat = InventoryCategory.objects.create(name="Test", code="TST")
        self.item = InventoryItem.objects.create(
            category=self.cat, name="Item", sale_price="1.00", quantity_in_stock=10
        )
        rt = ResourceType.objects.create(
            name="PC", code="PC_TYPE", prefix="PC", base_price="5.00"
        )
        self.ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")

    # ------------------------------------------------------------------
    # Sale tests
    # ------------------------------------------------------------------

    def test_sale_with_null_exchange_rate_gets_unknown_currency(self):
        """Legacy sales (exchange_rate=NULL) must have payment_currency → UNKNOWN."""
        sale = Sale.objects.create(
            user=self.owner,
            payment_currency="USD",
            exchange_rate=None,   # simulates pre-Phase-2 row
        )
        _run_backfill()
        sale.refresh_from_db()
        self.assertEqual(sale.payment_currency, "UNKNOWN")
        self.assertIsNone(sale.exchange_rate)  # column stays NULL — no sentinel

    def test_sale_with_frozen_rate_is_untouched(self):
        """Sales that already have a frozen rate must not be modified."""
        sale = Sale.objects.create(
            user=self.owner,
            payment_currency="USD",
            exchange_rate=Decimal("1"),
        )
        _run_backfill()
        sale.refresh_from_db()
        self.assertEqual(sale.payment_currency, "USD")
        self.assertEqual(sale.exchange_rate, Decimal("1"))

    # ------------------------------------------------------------------
    # Session tests
    # ------------------------------------------------------------------

    def test_completed_session_with_null_rate_gets_flagged(self):
        """Completed sessions without exchange_rate must be flagged and set to UNKNOWN."""
        session = Session.objects.create(
            customer_name="Legacy",
            resource_unit=self.ru,
            session_type=Session.SESSION_POSTPAID,
            original_payment_currency="USD",   # old default
            end_time=timezone.now(),
            final_cost=Decimal("10.00"),
            exchange_rate=None,   # simulates pre-Phase-2 row
        )
        _run_backfill()
        session.refresh_from_db()
        self.assertEqual(session.original_payment_currency, "UNKNOWN")
        self.assertIsNone(session.exchange_rate)
        self.assertEqual(session.metadata.get("exchange_rate_note"), "unknown_rate_legacy")

    def test_completed_session_with_frozen_rate_is_untouched(self):
        """Completed sessions that already have a rate must not be modified."""
        session = Session.objects.create(
            customer_name="Good",
            resource_unit=self.ru,
            session_type=Session.SESSION_POSTPAID,
            original_payment_currency="USD",
            end_time=timezone.now(),
            final_cost=Decimal("5.00"),
            exchange_rate=Decimal("1"),
        )
        _run_backfill()
        session.refresh_from_db()
        self.assertEqual(session.original_payment_currency, "USD")
        self.assertNotIn("exchange_rate_note", session.metadata)

    def test_active_session_with_null_rate_is_untouched(self):
        """Active sessions (no end_time) legitimately have NULL rate; must not be touched."""
        session = Session.objects.create(
            customer_name="Active",
            resource_unit=self.ru,
            session_type=Session.SESSION_POSTPAID,
            original_payment_currency="USD",
            exchange_rate=None,
        )
        _run_backfill()
        session.refresh_from_db()
        self.assertEqual(session.original_payment_currency, "USD")
        self.assertIsNone(session.exchange_rate)
        self.assertNotIn("exchange_rate_note", session.metadata)

    def test_existing_metadata_is_preserved_when_flagging(self):
        """Flagging a session must merge into existing metadata, not overwrite it."""
        session = Session.objects.create(
            customer_name="Meta",
            resource_unit=self.ru,
            session_type=Session.SESSION_POSTPAID,
            end_time=timezone.now(),
            final_cost=Decimal("3.00"),
            exchange_rate=None,
            metadata={"source": "import"},
        )
        _run_backfill()
        session.refresh_from_db()
        self.assertEqual(session.metadata.get("source"), "import")
        self.assertEqual(session.metadata.get("exchange_rate_note"), "unknown_rate_legacy")
