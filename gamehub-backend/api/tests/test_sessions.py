from decimal import Decimal
from datetime import timedelta
from rest_framework import status
from django.utils import timezone
from .base import BaseAPITestCase
from api.models import (
    AuditLog,
    CurrencySettings,
    InventoryCategory,
    InventoryItem,
    ResourceType,
    ResourceUnit,
    Session,
    SessionOrder,
)


class SessionViewSetTests(BaseAPITestCase):
    url = '/api/sessions/'

    def setUp(self):
        super().setUp()
        self.rt1 = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        self.ru1 = ResourceUnit.objects.create(resource_type=self.rt1, code="PC-01")
        self.cat1 = InventoryCategory.objects.create(name="Drinks", code="DRK")
        self.item1 = InventoryItem.objects.create(category=self.cat1, name="Cola", sale_price=2.50, quantity_in_stock=1)

    def test_create_session_no_permission(self):
        """Staff without can_start_session should get 403."""
        self.authenticate('staff')
        data = {"name": "John Doe", "stationId": "PC-01", "sessionType": Session.SESSION_POSTPAID}
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_session(self):
        """Staff with can_start_session should be able to create a session."""
        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        data = {"name": "John Doe", "stationId": "PC-01", "sessionType": Session.SESSION_POSTPAID}
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Session.objects.count(), 1)
        self.assertEqual(response.data["name"], "John Doe")
        self.assertIn("live_cost", response.data)
        self.assertIn("elapsed_time", response.data)
        self.assertIn("effective_rate", response.data)
        self.assertIn("final_total", response.data)
        self.assertIn("paused_duration", response.data)

    def test_sessions_list_is_paginated(self):
        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertEqual(response.data["count"], 1)

    def test_create_prepaid_session_local_amount_stores_usd(self):
        settings = CurrencySettings.get_solo()
        settings.local_currency_enabled = True
        settings.local_currency_code = "SYP"
        settings.local_currency_name = "Syrian Pound"
        settings.local_units_per_usd = Decimal("13800")
        settings.save()

        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        data = {
            "name": "John Doe",
            "stationId": "PC-01",
            "sessionType": Session.SESSION_PREPAID,
            "paymentCurrency": "SYP",
            "prepaidAmount": "27600",
        }
        response = self.client.post(self.url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        session = Session.objects.get()
        self.assertEqual(session.prepaid_amount_usd, Decimal("2.00"))
        self.assertEqual(session.original_payment_currency, "SYP")
        self.assertEqual(session.original_payment_amount, Decimal("27600.00"))
        self.assertEqual(session.get_rental_cost(), Decimal("2.00"))

    def test_create_prepaid_session_rejects_missing_payment_currency(self):
        """Prepaid session without paymentCurrency must be rejected at create time."""
        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        data = {
            "name": "John Doe",
            "stationId": "PC-01",
            "sessionType": Session.SESSION_PREPAID,
            "prepaidAmount": "10.00",
            # paymentCurrency deliberately omitted
        }
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paymentCurrency", response.data)
        self.assertEqual(Session.objects.count(), 0)

    def test_create_session_occupied(self):
        """Creating a session on an occupied station should fail with 400."""
        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        data = {"name": "Jane", "stationId": "PC-01", "sessionType": Session.SESSION_POSTPAID}
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stationId", response.data)

    def test_create_session_rejects_stopped_station(self):
        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        self.ru1.status = ResourceUnit.STATUS_STOPPED
        self.ru1.save(update_fields=["status"])

        response = self.client.post(
            self.url,
            {"name": "John Doe", "stationId": "PC-01", "sessionType": Session.SESSION_POSTPAID},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("resourceUnitId", response.data)

    def test_pause_resume_session(self):
        """Staff with pause/resume permissions can pause then resume a session."""
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )

        pause_url = f'{self.url}{session.id}/pause/'
        resume_url = f'{self.url}{session.id}/resume/'

        response = self.client.post(pause_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.grant_staff_permission(can_pause_session=True)
        response = self.client.post(pause_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertTrue(session.is_paused)
        self.assertIsNotNone(session.last_pause_time)

        response = self.client.post(resume_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.grant_staff_permission(can_resume_session=True)
        response = self.client.post(resume_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertFalse(session.is_paused)
        self.assertIsNone(session.last_pause_time)

    def test_toggle_pause_remains_backward_compatible(self):
        self.grant_staff_permission(can_pause_session=True, can_resume_session=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )

        toggle_url = f'{self.url}{session.id}/toggle_pause/'
        self.assertEqual(self.client.post(toggle_url).status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertTrue(session.is_paused)
        self.assertEqual(self.client.post(toggle_url).status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertFalse(session.is_paused)

    def test_staff_cannot_override_session_pricing(self):
        self.grant_staff_permission(can_start_session=True)
        self.authenticate('staff')
        data = {
            "name": "John Doe",
            "stationId": "PC-01",
            "sessionType": Session.SESSION_POSTPAID,
            "pricePerHour": "1.00",
        }
        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_add_order(self):
        """Staff with can_add_session_order can add orders to sessions."""
        self.grant_staff_permission(can_add_session_order=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )

        add_order_url = f'{self.url}{session.id}/add_order/'
        data = {"inventoryItemId": self.item1.id, "quantity": 1}
        response = self.client.post(add_order_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.item1.refresh_from_db()
        self.assertEqual(self.item1.quantity_in_stock, 0)
        self.assertEqual(session.orders.count(), 1)

        # Test insufficient stock
        response2 = self.client.post(add_order_url, data)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response2.data)

    def test_add_order_rejects_invalid_quantity_and_custom_staff_price(self):
        self.grant_staff_permission(can_add_session_order=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        add_order_url = f'{self.url}{session.id}/add_order/'

        invalid_quantity = self.client.post(
            add_order_url, {"inventoryItemId": self.item1.id, "quantity": 0}
        )
        self.assertEqual(invalid_quantity.status_code, status.HTTP_400_BAD_REQUEST)

        custom_price = self.client.post(
            add_order_url, {"name": "Manual", "price": "1.00", "quantity": 1}
        )
        self.assertEqual(custom_price.status_code, status.HTTP_403_FORBIDDEN)

    def test_end_session_rejects_missing_payment_currency(self):
        """Ending a session without paymentCurrency must be rejected with 400."""
        self.grant_staff_permission(can_end_session=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        end_url = f'{self.url}{session.id}/end/'
        response = self.client.post(end_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        session.refresh_from_db()
        self.assertIsNone(session.end_time)

    def test_end_session_without_discount_permission(self):
        """Staff with can_end_session but NOT can_apply_discount cannot apply discounts."""
        self.grant_staff_permission(can_end_session=True, can_apply_discount=False)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        end_url = f'{self.url}{session.id}/end/'
        response = self.client.post(end_url, {"discount": "1.00", "paymentCurrency": "USD"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_end_session_with_discount(self):
        """Staff with both can_end_session and can_apply_discount can end with discount."""
        self.grant_staff_permission(can_end_session=True, can_apply_discount=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        end_url = f'{self.url}{session.id}/end/'
        response = self.client.post(end_url, {"discount": "1.00", "paymentCurrency": "USD"})

        session.refresh_from_db()
        self.assertIsNotNone(session.end_time)
        self.assertEqual(session.discount, Decimal("1.00"))
        self.assertEqual(session.final_cost, Decimal("0.00"))
        self.assertEqual(response.data["final_total"], "0.00")

    def test_backend_is_source_of_truth_for_final_billing(self):
        self.grant_staff_permission(can_end_session=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John",
            resource_unit=self.ru1,
            session_type=Session.SESSION_PREPAID,
            prepaid_amount_usd=Decimal("12.00"),
        )

        response = self.client.post(f'{self.url}{session.id}/end/', {"paymentCurrency": "USD"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.final_cost, Decimal("12.00"))
        self.assertEqual(response.data["final_total"], "12.00")
        self.assertEqual(response.data["payment_method"], "CASH")

    def test_end_session_rejects_negative_discount(self):
        self.grant_staff_permission(can_end_session=True, can_apply_discount=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        end_url = f'{self.url}{session.id}/end/'
        # paymentCurrency is present so the discount check is reached (order: discount first, then currency)
        response = self.client.post(end_url, {"discount": "-1.00", "paymentCurrency": "USD"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_session_sensitive_actions_create_audit_logs(self):
        self.grant_staff_permission(
            can_start_session=True,
            can_end_session=True,
            can_add_session_order=True,
            can_apply_discount=True,
        )
        self.authenticate('staff')

        create_response = self.client.post(
            self.url,
            {"name": "John Doe", "stationId": "PC-01", "sessionType": Session.SESSION_POSTPAID},
        )
        session_id = create_response.data["id"]
        self.client.post(
            f'{self.url}{session_id}/add_order/',
            {"inventoryItemId": self.item1.id, "quantity": 1},
        )
        self.client.post(f'{self.url}{session_id}/end/', {"discount": "1.00", "paymentCurrency": "USD"})

        descriptions = set(AuditLog.objects.values_list("description", flat=True))
        self.assertIn("Started session.", descriptions)
        self.assertIn("Added order to session.", descriptions)
        self.assertIn("Applied session discount.", descriptions)
        self.assertIn("Ended session.", descriptions)

    def test_owner_can_correct_completed_session_and_restore_order_stock(self):
        self.authenticate('owner')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        order = SessionOrder.objects.create(
            session=session,
            inventory_item=self.item1,
            item_name=self.item1.name,
            quantity=1,
            unit_price=self.item1.sale_price,
            unit_cost=self.item1.cost_price,
            total_price=Decimal("0.00"),
        )
        self.item1.quantity_in_stock = 0
        self.item1.save(update_fields=["quantity_in_stock"])
        session.end_session()

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {
                "discount": "0.50",
                "removeOrderIds": [order.id],
                "reason": "Order was added to the wrong session",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item1.refresh_from_db()
        session.refresh_from_db()
        self.assertEqual(self.item1.quantity_in_stock, 1)
        self.assertEqual(session.discount, Decimal("0.50"))
        self.assertEqual(session.orders.count(), 0)
        log = AuditLog.objects.filter(description__startswith="Corrected session.").latest("timestamp")
        self.assertEqual(log.metadata["reason"], "Order was added to the wrong session")
        self.assertIn("old_value", log.metadata)
        self.assertIn("new_value", log.metadata)

    def test_owner_can_correct_completed_session_details_and_historical_station(self):
        self.authenticate('owner')
        ru2 = ResourceUnit.objects.create(resource_type=self.rt1, code="PC-02")
        Session.objects.create(
            customer_name="Active", resource_unit=ru2, session_type=Session.SESSION_POSTPAID
        )
        end = timezone.now()
        start = end - timedelta(hours=2)
        session = Session.objects.create(
            customer_name="Old Name",
            resource_unit=self.ru1,
            session_type=Session.SESSION_POSTPAID,
            start_time=start,
        )
        session.end_session(ref_time=end)

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {
                "name": "Corrected Name",
                "stationId": "PC-02",
                "startTime": start.isoformat(),
                "endTime": end.isoformat(),
                "discount": "5.00",
                "reason": "Moved to the right history station",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.customer_name, "Corrected Name")
        self.assertEqual(session.resource_unit, ru2)
        self.assertEqual(session.discount, Decimal("5.00"))
        self.assertEqual(session.final_duration_minutes, Decimal("120.00"))
        self.assertEqual(session.final_cost, Decimal("15.00"))

    def test_correct_session_rejects_active_session(self):
        self.authenticate('owner')
        session = Session.objects.create(
            customer_name="Active", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {"discount": "1.00", "reason": "Should not edit active sessions here"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Only completed sessions can be corrected.")

    def test_correct_session_rejects_blank_end_time_for_completed_session(self):
        self.authenticate('owner')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        session.end_session()
        original_end_time = session.end_time

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {"endTime": "", "reason": "Do not reopen completed sessions"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        session.refresh_from_db()
        self.assertEqual(session.end_time, original_end_time)

    def test_correct_session_rejects_moving_to_stopped_station(self):
        self.authenticate('owner')
        stopped = ResourceUnit.objects.create(
            resource_type=self.rt1, code="PC-STOP", status=ResourceUnit.STATUS_STOPPED
        )
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )
        session.end_session()

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {"stationId": stopped.code, "reason": "Wrong station"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], f"Station {stopped.code} is stopped.")

    def test_correct_session_updates_added_orders_stock_and_final_total(self):
        self.authenticate('owner')
        self.item1.quantity_in_stock = 4
        self.item1.save(update_fields=["quantity_in_stock"])
        item2 = InventoryItem.objects.create(
            category=self.cat1,
            name="Water",
            sale_price=Decimal("4.00"),
            quantity_in_stock=3,
        )
        end = timezone.now()
        start = end - timedelta(hours=1)
        session = Session.objects.create(
            customer_name="John",
            resource_unit=self.ru1,
            session_type=Session.SESSION_POSTPAID,
            start_time=start,
        )
        order = SessionOrder.objects.create(
            session=session,
            inventory_item=self.item1,
            item_name=self.item1.name,
            quantity=1,
            unit_price=self.item1.sale_price,
            unit_cost=self.item1.cost_price,
            total_price=Decimal("0.00"),
        )
        session.end_session(ref_time=end)

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {
                "updateOrders": [{"orderId": order.id, "quantity": 3}],
                "addOrders": [{"inventoryItemId": item2.id, "quantity": 2}],
                "discount": "1.00",
                "reason": "Corrected item quantities",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.item1.refresh_from_db()
        item2.refresh_from_db()
        self.assertEqual(self.item1.quantity_in_stock, 2)
        self.assertEqual(item2.quantity_in_stock, 1)
        self.assertEqual(session.orders.count(), 2)
        self.assertEqual(session.final_duration_minutes, Decimal("60.00"))
        self.assertEqual(session.final_cost, Decimal("24.50"))

    def test_staff_cannot_correct_session(self):
        self.grant_staff_permission(can_end_session=True)
        self.authenticate('staff')
        session = Session.objects.create(
            customer_name="John", resource_unit=self.ru1, session_type=Session.SESSION_POSTPAID
        )

        response = self.client.post(
            f'{self.url}{session.id}/correct/',
            {"discount": "1.00", "reason": "test"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
