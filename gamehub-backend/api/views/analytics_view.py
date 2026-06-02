from django.db.models import Count, Sum, F
from rest_framework.views import APIView
from rest_framework.response import Response
from api.date_filters import get_date_range_from_request
from api.models import MonthlyExpense, Session, Sale, SessionOrder
from .permissions_view import IsOwner


def _month_start(value):
    return value.replace(day=1)


class AnalyticsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        start_date, end_date = get_date_range_from_request(request)

        sessions = Session.objects.all()
        completed = sessions.filter(
            end_time__isnull=False,
            end_time__date__range=(start_date, end_date),
        )
        standalone_sales = Sale.objects.filter(
            timestamp__date__range=(start_date, end_date)
        )

        # Calculate Revenue
        sess_revenue = completed.aggregate(total=Sum("final_cost"))["total"] or 0
        standalone_revenue = standalone_sales.aggregate(total=Sum("total_price"))["total"] or 0
        total_revenue = float(sess_revenue) + float(standalone_revenue)

        # Calculate Costs (Inventory COGS)
        # 1. From Session Orders
        sess_order_cost = SessionOrder.objects.filter(session__in=completed).aggregate(
            total=Sum(F("quantity") * F("unit_cost"))
        )["total"] or 0

        # 2. From Standalone Sales
        standalone_cost = standalone_sales.aggregate(total=Sum("total_cost"))["total"] or 0

        expense_months = MonthlyExpense.objects.filter(
            month__gte=_month_start(start_date),
            month__lte=_month_start(end_date),
        )
        monthly_expenses = sum((expense.total for expense in expense_months), 0)

        total_cost = float(sess_order_cost) + float(standalone_cost)
        net_profit = total_revenue - total_cost
        net_profit_after_expenses = net_profit - float(monthly_expenses)

        most_used = (
            sessions.filter(start_time__date__range=(start_date, end_date))
            .values("resource_unit__code", "resource_unit__resource_type__name")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )
        active_count = sessions.filter(end_time__isnull=True).count()

        return Response(
            {
                "activeSessions": active_count,
                "completedRevenue": total_revenue,
                "totalCost": total_cost,
                "inventoryNetProfit": net_profit,
                "monthlyExpenses": float(monthly_expenses),
                "netProfit": net_profit_after_expenses,
                "mostUsedResources": list(most_used),
                "dateRange": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
            }
        )
