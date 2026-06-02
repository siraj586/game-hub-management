from django.utils import timezone
from rest_framework import status

from api.models import AuditLog, DailyReport, InventoryCategory, InventoryItem, User
from .base import BaseAPITestCase


class RBACTests(BaseAPITestCase):
    users_url = "/api/users/"
    reports_url = "/api/daily-reports/"
    audit_logs_url = "/api/audit-logs/"
    inventory_items_url = "/api/inventory-items/"

    def test_staff_cannot_create_privileged_users_or_promote_self(self):
        self.authenticate("staff")
        create_response = self.client.post(
            self.users_url,
            {"username": "new-owner", "password": "password", "role": User.ROLE_OWNER},
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

        promote_response = self.client.patch(
            f"{self.users_url}{self.staff.id}/",
            {"role": User.ROLE_OWNER},
        )
        self.assertEqual(promote_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_cannot_create_deprecated_roles(self):
        self.authenticate("owner")
        response = self.client.post(
            self.users_url,
            {"username": "legacy", "password": "password", "role": "MANAGER"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_staff_shift_report_requires_permission(self):
        DailyReport.objects.create(date=timezone.now().date(), total_revenue=100)

        self.authenticate("staff")
        denied = self.client.get(self.reports_url)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.grant_staff_permission(can_view_shift_report=True)
        allowed = self.client.get(self.reports_url)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_staff_audit_logs_require_permission(self):
        AuditLog.objects.create(
            user=self.owner,
            action_type=AuditLog.ACTION_CREATE,
            resource_type="Test",
            resource_name="Record",
            description="Created test record",
        )

        self.authenticate("staff")
        denied = self.client.get(self.audit_logs_url)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.grant_staff_permission(can_view_audit_logs=True)
        allowed = self.client.get(self.audit_logs_url)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_staff_can_update_stock_but_not_inventory_pricing(self):
        category = InventoryCategory.objects.create(name="Drinks", code="DRK")
        item = InventoryItem.objects.create(
            category=category,
            name="Cola",
            sale_price=2.50,
            cost_price=1.00,
            quantity_in_stock=10,
        )

        self.authenticate("staff")
        denied = self.client.patch(
            f"{self.inventory_items_url}{item.id}/",
            {"quantity_in_stock": 12},
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.grant_staff_permission(can_update_stock=True)
        stock_response = self.client.patch(
            f"{self.inventory_items_url}{item.id}/",
            {"quantity_in_stock": 12},
        )
        self.assertEqual(stock_response.status_code, status.HTTP_200_OK)

        price_response = self.client.patch(
            f"{self.inventory_items_url}{item.id}/",
            {"sale_price": "3.00"},
        )
        self.assertEqual(price_response.status_code, status.HTTP_403_FORBIDDEN)
