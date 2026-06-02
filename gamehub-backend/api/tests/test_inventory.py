from rest_framework import status
from decimal import Decimal
from .base import BaseAPITestCase
from api.models import CurrencySettings, InventoryCategory, InventoryItem


class InventoryViewSetTests(BaseAPITestCase):
    cat_url = '/api/inventory-categories/'
    item_url = '/api/inventory-items/'

    def setUp(self):
        super().setUp()
        self.cat1 = InventoryCategory.objects.create(name="Drinks", code="DRK")
        self.item1 = InventoryItem.objects.create(
            category=self.cat1, name="Cola", sale_price=2.50, quantity_in_stock=10
        )

    def test_list_unauthenticated(self):
        self.assertEqual(self.client.get(self.cat_url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(self.item_url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_category_staff_no_permission(self):
        self.authenticate('staff')
        data = {"name": "Snacks", "code": "SNK"}
        response = self.client.post(self.cat_url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_category_owner(self):
        self.authenticate('owner')
        data = {"name": "Snacks", "code": "SNK"}
        response = self.client.post(self.cat_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_item_owner(self):
        self.authenticate('owner')
        data = {
            "category": self.cat1.id,
            "name": "Chips",
            "sale_price": "1.50",
            "quantity_in_stock": 20,
            "minimum_stock_level": 3,
        }
        response = self.client.post(self.item_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["minimum_stock_level"], 3)

    def test_low_stock_flag_is_returned(self):
        self.item1.minimum_stock_level = 10
        self.item1.save(update_fields=["minimum_stock_level"])
        self.grant_staff_permission(can_manage_inventory=True)
        self.authenticate('staff')

        response = self.client.get(self.item_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data[0]["is_low_stock"])

    def test_create_item_local_currency_stores_usd(self):
        settings = CurrencySettings.get_solo()
        settings.local_currency_enabled = True
        settings.local_currency_code = "SYP"
        settings.local_currency_name = "Syrian Pound"
        settings.local_units_per_usd = Decimal("13800")
        settings.save()

        self.authenticate('owner')
        data = {
            "category": self.cat1.id,
            "name": "Chips",
            "sale_price": "27600",
            "sale_price_currency": "SYP",
            "cost_price": "13800",
            "cost_price_currency": "SYP",
            "quantity_in_stock": 20,
        }
        response = self.client.post(self.item_url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = InventoryItem.objects.get(name="Chips")
        self.assertEqual(item.sale_price, Decimal("2.00"))
        self.assertEqual(item.cost_price, Decimal("1.00"))
        self.assertEqual(item.original_price_currency, "SYP")
        self.assertEqual(item.original_price_amount, Decimal("27600.00"))

    def test_owner_can_include_inactive_inventory_items(self):
        inactive = InventoryItem.objects.create(
            category=self.cat1,
            name="Old Cola",
            sale_price=1,
            quantity_in_stock=0,
            is_active=False,
        )
        self.authenticate('owner')

        default_response = self.client.get(self.item_url)
        include_response = self.client.get(self.item_url, {"include_inactive": "true"})

        default_ids = {item["id"] for item in default_response.data}
        include_ids = {item["id"] for item in include_response.data}
        self.assertNotIn(inactive.id, default_ids)
        self.assertIn(inactive.id, include_ids)
