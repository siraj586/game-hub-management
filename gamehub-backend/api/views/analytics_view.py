from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum, F
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from api.currency import round_money
from api.date_filters import get_date_range_from_request
from api.models import MonthlyExpense, Session, Sale, SessionOrder
from api.models.core_model import CurrencySettings
from .permissions_view import IsOwner


def _month_start(value):
    return value.replace(day=1)


def _money(value):
    return float(value or 0)


def _is_known(payment_currency, exchange_rate):
    """Return True when the transaction has a trustworthy frozen rate."""
    return payment_currency not in (None, "", "UNKNOWN") and exchange_rate is not None


def _invoice_usd_revenue_session(session):
    """USD revenue for a completed session using its own frozen rate.

    Returns None when the rate is missing/unknown (legacy, Phase 4 backfill).
    """
    if not _is_known(session.original_payment_currency, session.exchange_rate):
        return None
    if session.original_payment_currency == "USD":
        return session.final_cost or Decimal("0")
    if session.exchange_rate > 0 and session.original_payment_amount:
        return round_money(session.original_payment_amount / session.exchange_rate)
    return session.final_cost or Decimal("0")


def _invoice_usd_revenue_sale(sale):
    """USD revenue for a sale using its own frozen rate.

    Returns None when the rate is missing/unknown.
    """
    if not _is_known(sale.payment_currency, sale.exchange_rate):
        return None
    if sale.payment_currency == "USD":
        return sale.total_price or Decimal("0")
    if sale.exchange_rate > 0 and sale.paid_amount:
        return round_money(sale.paid_amount / sale.exchange_rate)
    return sale.total_price or Decimal("0")


def _session_orders_total(session):
    return sum((order.total_price for order in session.orders.all()), Decimal("0"))


def _session_orders_cost(session):
    return sum(
        (order.quantity * order.unit_cost for order in session.orders.all()),
        Decimal("0"),
    )


class AnalyticsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        start_date, end_date = get_date_range_from_request(request)
        detail_raw = request.query_params.get("detail_date") or end_date.isoformat()
        detail_date = parse_date(detail_raw)
        if not detail_date:
            raise ValidationError({"detail_date": "Use YYYY-MM-DD."})
        if detail_date < start_date or detail_date > end_date:
            detail_date = end_date

        sessions = Session.objects.all()
        completed = sessions.filter(
            end_time__isnull=False,
            end_time__date__range=(start_date, end_date),
        ).select_related("resource_unit", "resource_unit__resource_type").prefetch_related("orders")
        standalone_sales = Sale.objects.filter(
            timestamp__date__range=(start_date, end_date)
        ).select_related("user").prefetch_related("items")

        # Current exchange rate (for ≈ local display on the frontend)
        currency_settings = CurrencySettings.get_solo()
        today_rate = float(currency_settings.local_units_per_usd or 1) if currency_settings.local_currency_enabled else None

        # Revenue from frozen rates — each invoice converted at its own rate
        revenue_usd = Decimal("0")
        unknown_transaction_count = 0
        for obj in completed:
            rev = _invoice_usd_revenue_session(obj)
            if rev is None:
                unknown_transaction_count += 1
            else:
                revenue_usd += rev
        for obj in standalone_sales:
            rev = _invoice_usd_revenue_sale(obj)
            if rev is None:
                unknown_transaction_count += 1
            else:
                revenue_usd += rev

        # Legacy aggregate (kept for backward compat, includes unknowns)
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
        monthly_expenses = sum((expense.total for expense in expense_months), Decimal("0"))

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
        daily_breakdown = []
        cursor = start_date
        while cursor <= end_date:
            day_sessions = [session for session in completed if session.end_time.date() == cursor]
            day_sales = [sale for sale in standalone_sales if sale.timestamp.date() == cursor]
            session_revenue = sum((session.final_cost or Decimal("0") for session in day_sessions), Decimal("0"))
            session_order_revenue = sum((_session_orders_total(session) for session in day_sessions), Decimal("0"))
            session_order_cost = sum((_session_orders_cost(session) for session in day_sessions), Decimal("0"))
            sales_revenue = sum((sale.total_price for sale in day_sales), Decimal("0"))
            sales_cost = sum((sale.total_cost for sale in day_sales), Decimal("0"))
            total_day_revenue = session_revenue + sales_revenue
            total_day_cost = session_order_cost + sales_cost
            
            actual_usd = Decimal("0")
            actual_local = Decimal("0")
            day_revenue_usd = Decimal("0")
            for session in day_sessions:
                cur = session.original_payment_currency
                if cur == "USD" and _is_known(cur, session.exchange_rate):
                    actual_usd += session.original_payment_amount or session.final_cost or Decimal("0")
                elif cur not in (None, "", "USD", "UNKNOWN") and _is_known(cur, session.exchange_rate):
                    actual_local += session.original_payment_amount or Decimal("0")
                rev = _invoice_usd_revenue_session(session)
                if rev is not None:
                    day_revenue_usd += rev
            for sale in day_sales:
                cur = sale.payment_currency
                if cur == "USD" and _is_known(cur, sale.exchange_rate):
                    actual_usd += sale.paid_amount or sale.total_price or Decimal("0")
                elif cur not in (None, "", "USD", "UNKNOWN") and _is_known(cur, sale.exchange_rate):
                    actual_local += sale.paid_amount or Decimal("0")
                rev = _invoice_usd_revenue_sale(sale)
                if rev is not None:
                    day_revenue_usd += rev

            daily_breakdown.append(
                {
                    "date": cursor.isoformat(),
                    "sessionsCount": len(day_sessions),
                    "salesCount": len(day_sales),
                    "sessionRevenue": _money(session_revenue),
                    "sessionProductRevenue": _money(session_order_revenue),
                    "sessionProductCost": _money(session_order_cost),
                    "salesRevenue": _money(sales_revenue),
                    "salesCapital": _money(sales_cost),
                    "totalRevenue": _money(total_day_revenue),
                    "totalCost": _money(total_day_cost),
                    "grossProfit": _money(total_day_revenue - total_day_cost),
                    "revenueUsd": _money(day_revenue_usd),
                    "actualUsdReceived": _money(actual_usd),
                    "actualLocalReceived": _money(actual_local),
                }
            )
            cursor += timedelta(days=1)

        detail_sessions = [
            {
                "id": session.id,
                "name": session.customer_name,
                "stationId": session.resource_unit.code,
                "deviceType": session.resource_unit.resource_type.name,
                "startTime": session.start_time.isoformat(),
                "endTime": session.end_time.isoformat() if session.end_time else None,
                "durationMinutes": _money(session.final_duration_minutes),
                "discount": _money(session.discount),
                "sessionProductRevenue": _money(_session_orders_total(session)),
                "sessionProductCost": _money(_session_orders_cost(session)),
                "finalTotal": _money(session.final_cost),
                "paymentCurrency": session.original_payment_currency or "UNKNOWN",
                "paidAmount": _money(session.original_payment_amount) if session.original_payment_amount is not None else None,
                "exchangeRate": float(session.exchange_rate) if session.exchange_rate is not None else None,
                "orders": [
                    {
                        "id": order.id,
                        "name": order.item_name,
                        "quantity": order.quantity,
                        "unitPrice": _money(order.unit_price),
                        "unitCost": _money(order.unit_cost),
                        "totalPrice": _money(order.total_price),
                        "totalCost": _money(order.quantity * order.unit_cost),
                    }
                    for order in session.orders.all()
                ],
            }
            for session in completed
            if session.end_time.date() == detail_date
        ]
        detail_sales = [
            {
                "id": sale.id,
                "timestamp": sale.timestamp.isoformat(),
                "username": sale.user.username,
                "totalPrice": _money(sale.total_price),
                "totalCost": _money(sale.total_cost),
                "profit": _money(sale.profit),
                "paymentCurrency": sale.payment_currency or "UNKNOWN",
                "paidAmount": _money(sale.paid_amount) if sale.paid_amount is not None else None,
                "exchangeRate": float(sale.exchange_rate) if sale.exchange_rate is not None else None,
                "items": [
                    {
                        "id": item.id,
                        "name": item.item_name,
                        "quantity": item.quantity,
                        "unitPrice": _money(item.unit_price),
                        "unitCost": _money(item.unit_cost),
                        "totalPrice": _money(item.total_price),
                        "totalCost": _money(item.quantity * item.unit_cost),
                    }
                    for item in sale.items.all()
                ],
            }
            for sale in standalone_sales
            if sale.timestamp.date() == detail_date
        ]

        actual_usd_total = sum((day["actualUsdReceived"] for day in daily_breakdown), 0)
        actual_local_total = sum((day["actualLocalReceived"] for day in daily_breakdown), 0)

        return Response(
            {
                "activeSessions": active_count,
                # revenueUsd: each invoice converted at its own frozen rate (excludes UNKNOWN)
                "revenueUsd": float(revenue_usd),
                # completedRevenue: legacy aggregate (includes unknowns) — kept for compat
                "completedRevenue": total_revenue,
                "unknownTransactionCount": unknown_transaction_count,
                # todayRate: current rate so frontend can show ≈ local equivalent
                "todayRate": today_rate,
                "totalCost": total_cost,
                "inventoryNetProfit": net_profit,
                "monthlyExpenses": float(monthly_expenses),
                "netProfit": net_profit_after_expenses,
                "actualUsdReceived": _money(actual_usd_total),
                "actualLocalReceived": _money(actual_local_total),
                "mostUsedResources": list(most_used),
                "dailyBreakdown": daily_breakdown,
                "detail": {
                    "date": detail_date.isoformat(),
                    "sessions": detail_sessions,
                    "sales": detail_sales,
                },
                "dateRange": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
            }
        )
