from rest_framework import status

from api.models import AuditLog, InventoryCategory, InventoryItem, Sale, SaleItem
from .base import BaseAPITestCase


class SaleViewSetTests(BaseAPITestCase):
    url = "/api/sales/"

    def setUp(self):
        super().setUp()
        self.category = InventoryCategory.objects.create(name="Drinks", code="DRK")
        self.item = InventoryItem.objects.create(
            category=self.category,
            name="Cola",
            sale_price=2.50,
            cost_price=1.00,
            quantity_in_stock=2,
        )

    def test_staff_without_permission_cannot_create_sale(self):
        self.authenticate("staff")
        response = self.client.post(
            self.url,
            {"items": [{"id": self.item.id, "quantity": 1}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sale_rejects_missing_payment_currency(self):
        self.grant_staff_permission(can_create_standalone_sale=True)
        self.authenticate("staff")

        response = self.client.post(
            self.url,
            {"items": [{"id": self.item.id, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("paymentCurrency", response.data)
        self.assertEqual(Sale.objects.count(), 0)

    def test_staff_with_permission_creates_sale_and_updates_stock(self):
        self.grant_staff_permission(can_create_standalone_sale=True)
        self.authenticate("staff")

        response = self.client.post(
            self.url,
            {"items": [{"id": self.item.id, "quantity": 1}], "paymentCurrency": "USD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity_in_stock, 1)
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(response.data["payment_method"], "CASH")

        log = AuditLog.objects.get(resource_type="Standalone Sale")
        self.assertEqual(log.user, self.staff)
        self.assertEqual(log.metadata["sale_id"], response.data["id"])
        self.assertEqual(log.metadata["items"][0]["stock_after"], 1)

    def test_sale_rejects_insufficient_stock_and_rolls_back(self):
        self.grant_staff_permission(can_create_standalone_sale=True)
        self.authenticate("staff")

        response = self.client.post(
            self.url,
            {"items": [{"id": self.item.id, "quantity": 3}], "paymentCurrency": "USD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity_in_stock, 2)
        self.assertEqual(Sale.objects.count(), 0)

    def test_sale_rejects_duplicate_lines_that_exceed_stock(self):
        self.grant_staff_permission(can_create_standalone_sale=True)
        self.authenticate("staff")

        response = self.client.post(
            self.url,
            {
                "items": [
                    {"id": self.item.id, "quantity": 1},
                    {"id": self.item.id, "quantity": 2},
                ],
                "paymentCurrency": "USD",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity_in_stock, 2)
        self.assertEqual(Sale.objects.count(), 0)

    def test_sale_rejects_non_positive_quantity(self):
        self.grant_staff_permission(can_create_standalone_sale=True)
        self.authenticate("staff")

        response = self.client.post(
            self.url,
            {"items": [{"id": self.item.id, "quantity": 0}], "paymentCurrency": "USD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity_in_stock, 2)

    def test_owner_deleting_sale_restores_stock(self):
        sale = Sale.objects.create(user=self.owner, total_price=2.50, total_cost=1.00, payment_currency="USD")
        SaleItem.objects.create(
            sale=sale,
            inventory_item=self.item,
            item_name=self.item.name,
            quantity=1,
            unit_price=self.item.sale_price,
            unit_cost=self.item.cost_price,
            total_price=2.50,
        )
        self.item.quantity_in_stock = 1
        self.item.save(update_fields=["quantity_in_stock"])
        self.authenticate("owner")

        response = self.client.delete(f"{self.url}{sale.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity_in_stock, 2)
        self.assertTrue(
            AuditLog.objects.filter(
                resource_type="Standalone Sale",
                action_type=AuditLog.ACTION_DELETE,
            ).exists()
        )
