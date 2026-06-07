from rest_framework import status
from .base import BaseAPITestCase
from api.models import FeatureFlag, ResourceType, ResourceUnit, InventoryCategory, InventoryItem, Session, SessionOrder, Sale, SaleItem, DailyReport, MonthlyExpense
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal


class BulkSetupAndAnalyticsTests(BaseAPITestCase):
    setup_url = '/api/setup/bulk/'
    analytics_url = '/api/analytics/'

    def test_bulk_setup_unauthorized(self):
        self.authenticate('staff')
        response = self.client.post(self.setup_url, {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_setup_owner(self):
        self.authenticate('owner')
        data = {
            "feature_flags": [{"key": "NEW_UI", "enabled": True}],
            "resource_types": [{"code": "PS5", "name": "Playstation 5", "pricing_strategy": "HOURLY", "base_price": "15"}],
            "resource_units": [{"code": "PS5-01", "resource_type_code": "PS5", "status": "AVAILABLE"}],
            "inventory_categories": [{"name": "Food", "code": "FOOD"}],
            "inventory_items": [{"category_code": "FOOD", "name": "Burger", "sale_price": "5.00", "quantity_in_stock": 10}]
        }
        response = self.client.post(self.setup_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify db logic
        self.assertEqual(FeatureFlag.objects.filter(key="NEW_UI").count(), 1)
        self.assertEqual(ResourceType.objects.filter(code="PS5").count(), 1)
        self.assertEqual(ResourceUnit.objects.filter(code="PS5-01").count(), 1)
        self.assertEqual(InventoryCategory.objects.filter(code="FOOD").count(), 1)
        self.assertEqual(InventoryItem.objects.filter(name="Burger").count(), 1)

    def test_analytics_owner(self):
        self.authenticate('owner')

        # Creating Session data
        rt = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")

        # Active session
        Session.objects.create(customer_name="Active", resource_unit=ru)

        # Completed session
        completed = Session.objects.create(customer_name="Done", resource_unit=ru)
        completed.end_time = timezone.now()
        completed.final_cost = 25.50
        completed.save()

        response = self.client.get(self.analytics_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["activeSessions"], 1)
        self.assertEqual(response.data["completedRevenue"], 25.50)

        # Must have PC-01 as most used
        self.assertTrue(len(response.data["mostUsedResources"]) > 0)
        self.assertEqual(response.data["mostUsedResources"][0]["resource_unit__code"], "PC-01")

    def test_analytics_reports_totals_remain_usd(self):
        self.authenticate('owner')
        rt = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")

        completed = Session.objects.create(customer_name="Done", resource_unit=ru)
        completed.end_time = timezone.now()
        completed.final_cost = 2
        completed.save()
        Sale.objects.create(user=self.owner, total_price=3, total_cost=1)

        response = self.client.get(self.analytics_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["completedRevenue"], 5.0)
        self.assertEqual(response.data["totalCost"], 1.0)
        self.assertEqual(response.data["netProfit"], 4.0)

    def test_analytics_filters_by_period(self):
        self.authenticate('owner')
        rt = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")

        today_session = Session.objects.create(customer_name="Today", resource_unit=ru)
        today_session.end_time = timezone.now()
        today_session.final_cost = 5
        today_session.save()

        yesterday_session = Session.objects.create(customer_name="Yesterday", resource_unit=ru)
        yesterday_session.end_time = timezone.now() - timedelta(days=1)
        yesterday_session.final_cost = 9
        yesterday_session.save()

        today_response = self.client.get(self.analytics_url, {"period": "today"})
        yesterday_response = self.client.get(self.analytics_url, {"period": "yesterday"})

        self.assertEqual(today_response.status_code, status.HTTP_200_OK)
        self.assertEqual(today_response.data["completedRevenue"], 5.0)
        self.assertEqual(yesterday_response.status_code, status.HTTP_200_OK)
        self.assertEqual(yesterday_response.data["completedRevenue"], 9.0)

    def test_close_day_accepts_selected_date(self):
        self.grant_staff_permission(can_close_shift=True)
        self.authenticate('staff')
        rt = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")
        selected_date = (timezone.localdate() - timedelta(days=1)).isoformat()

        completed = Session.objects.create(customer_name="Done", resource_unit=ru)
        completed.end_time = timezone.now() - timedelta(days=1)
        completed.final_cost = 7
        completed.save()

        response = self.client.post(
            "/api/daily-reports/close_day/",
            {"date": selected_date},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["date"], selected_date)
        self.assertEqual(response.data["revenue_sessions"], "7.00")
        self.assertTrue(DailyReport.objects.filter(date=selected_date).exists())

    def test_monthly_expenses_are_deducted_from_monthly_net_profit(self):
        self.authenticate('owner')
        today = timezone.localdate()
        rt = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")

        completed = Session.objects.create(customer_name="Done", resource_unit=ru)
        completed.end_time = timezone.now()
        completed.final_cost = Decimal("100.00")
        completed.save()
        MonthlyExpense.objects.create(
            month=today.replace(day=1),
            rent=Decimal("25.00"),
            internet=Decimal("5.00"),
        )

        response = self.client.get(self.analytics_url, {"period": "this_month"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["completedRevenue"], 100.0)
        self.assertEqual(response.data["monthlyExpenses"], 30.0)
        self.assertEqual(response.data["netProfit"], 70.0)

    def test_analytics_returns_daily_reference_details(self):
        self.authenticate('owner')
        today = timezone.localdate()
        rt = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        ru = ResourceUnit.objects.create(resource_type=rt, code="PC-01")
        category = InventoryCategory.objects.create(name="Cafe", code="CAFE")
        item = InventoryItem.objects.create(
            category=category,
            name="Cola",
            sale_price=Decimal("3.00"),
            cost_price=Decimal("1.00"),
            quantity_in_stock=10,
        )
        session = Session.objects.create(customer_name="Done", resource_unit=ru)
        session.end_time = timezone.now()
        session.final_duration_minutes = Decimal("60.00")
        session.final_cost = Decimal("13.00")
        session.save()
        SessionOrder.objects.create(
            session=session,
            inventory_item=item,
            item_name=item.name,
            quantity=1,
            unit_price=item.sale_price,
            unit_cost=item.cost_price,
            total_price=Decimal("0.00"),
        )
        sale = Sale.objects.create(
            user=self.owner,
            total_price=Decimal("8.00"),
            total_cost=Decimal("3.00"),
        )
        SaleItem.objects.create(
            sale=sale,
            inventory_item=item,
            item_name=item.name,
            quantity=2,
            unit_price=Decimal("4.00"),
            unit_cost=Decimal("1.50"),
            total_price=Decimal("0.00"),
        )

        response = self.client.get(
            self.analytics_url,
            {"period": "today", "detail_date": today.isoformat()},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["completedRevenue"], 21.0)
        self.assertEqual(response.data["totalCost"], 4.0)
        self.assertEqual(response.data["inventoryNetProfit"], 17.0)
        self.assertEqual(len(response.data["dailyBreakdown"]), 1)
        self.assertEqual(response.data["dailyBreakdown"][0]["salesCapital"], 3.0)
        self.assertEqual(response.data["dailyBreakdown"][0]["sessionProductCost"], 1.0)
        self.assertEqual(response.data["detail"]["date"], today.isoformat())
        self.assertEqual(response.data["detail"]["sessions"][0]["finalTotal"], 13.0)
        self.assertEqual(response.data["detail"]["sessions"][0]["orders"][0]["totalCost"], 1.0)
        self.assertEqual(response.data["detail"]["sales"][0]["profit"], 5.0)
        self.assertEqual(response.data["detail"]["sales"][0]["items"][0]["totalCost"], 3.0)

    def test_monthly_expense_post_updates_existing_month(self):
        self.authenticate('owner')
        month = timezone.localdate().replace(day=1)
        MonthlyExpense.objects.create(month=month, rent=Decimal("25.00"))

        response = self.client.post(
            "/api/monthly-expenses/",
            {
                "month": month.isoformat(),
                "rent": "40.00",
                "internet": "10.00",
                "electricity": "0.00",
                "salaries": "0.00",
                "maintenance": "0.00",
                "other": "0.00",
                "notes": "Updated",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(MonthlyExpense.objects.filter(month=month).count(), 1)
        expense = MonthlyExpense.objects.get(month=month)
        self.assertEqual(expense.rent, Decimal("40.00"))
        self.assertEqual(expense.internet, Decimal("10.00"))
        self.assertEqual(expense.notes, "Updated")

    def test_analytics_staff_forbidden(self):
        self.authenticate('staff')
        response = self.client.get(self.analytics_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
