from decimal import Decimal

from django.db import transaction
from django.utils.dateparse import parse_date
from django.utils.timezone import now
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from api.models.core_model import DailyReport
from api.models.gaming_model import Session
from api.models.sales_model import Sale
from .permissions_view import CanCloseShift, CanViewShiftReport, PermissionByActionMixin


class DailyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyReport
        fields = "__all__"


def _is_known(payment_currency, exchange_rate):
    return payment_currency not in (None, "", "UNKNOWN") and exchange_rate is not None


class DailyReportViewSet(PermissionByActionMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = DailyReportSerializer
    queryset = DailyReport.objects.all().order_by("-date")
    permission_action_map = {
        "list": [CanViewShiftReport],
        "retrieve": [CanViewShiftReport],
        "close_day": [CanCloseShift],
    }

    @action(detail=False, methods=["post"])
    def close_day(self, request):
        date_str = request.data.get("date")
        if not date_str:
            raise ValidationError({"date": "This field is required."})

        target_date = parse_date(str(date_str))
        if not target_date:
            raise ValidationError({"date": "Use YYYY-MM-DD format."})

        with transaction.atomic():
            report, created = DailyReport.objects.select_for_update().get_or_create(
                date=target_date
            )

            if not created and report.metadata.get("locked_at"):
                return Response(
                    {"detail": "This day has already been closed and locked.", "date": date_str},
                    status=status.HTTP_409_CONFLICT,
                )

            sessions = list(
                Session.objects.filter(
                    end_time__isnull=False,
                    end_time__date=target_date,
                ).prefetch_related("orders")
            )
            sales = list(Sale.objects.filter(timestamp__date=target_date))

            revenue_sessions = sum(
                (s.final_cost or Decimal("0") for s in sessions), Decimal("0")
            )
            revenue_standalone = sum(
                (s.total_price or Decimal("0") for s in sales), Decimal("0")
            )
            total_revenue = revenue_sessions + revenue_standalone

            orders_cost = Decimal("0")
            for session in sessions:
                for order in session.orders.all():
                    orders_cost += Decimal(str(order.quantity)) * (order.unit_cost or Decimal("0"))

            standalone_cost = sum(
                (s.total_cost or Decimal("0") for s in sales), Decimal("0")
            )
            total_cost = orders_cost + standalone_cost
            net_profit = total_revenue - total_cost

            actual_usd = Decimal("0")
            actual_local = Decimal("0")
            for session in sessions:
                cur = session.original_payment_currency
                if cur == "USD" and _is_known(cur, session.exchange_rate):
                    actual_usd += session.original_payment_amount or session.final_cost or Decimal("0")
                elif cur not in (None, "", "USD", "UNKNOWN") and _is_known(cur, session.exchange_rate):
                    actual_local += session.original_payment_amount or Decimal("0")
            for sale in sales:
                cur = sale.payment_currency
                if cur == "USD" and _is_known(cur, sale.exchange_rate):
                    actual_usd += sale.paid_amount or sale.total_price or Decimal("0")
                elif cur not in (None, "", "USD", "UNKNOWN") and _is_known(cur, sale.exchange_rate):
                    actual_local += sale.paid_amount or Decimal("0")

            active_sessions_at_close = Session.objects.filter(end_time__isnull=True).count()

            meta = dict(report.metadata or {})
            meta["locked_at"] = now().isoformat()

            report.revenue_sessions = revenue_sessions
            report.revenue_standalone = revenue_standalone
            report.total_revenue = total_revenue
            report.orders_cost = orders_cost
            report.standalone_cost = standalone_cost
            report.total_cost = total_cost
            report.actual_usd_received = actual_usd
            report.actual_local_received = actual_local
            report.net_profit = net_profit
            report.active_sessions_at_close = active_sessions_at_close
            report.metadata = meta
            report.save()

        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)
