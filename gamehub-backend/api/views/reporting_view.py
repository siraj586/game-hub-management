from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, F
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from api.date_filters import get_date_range_from_request
from api.models.core_model import DailyReport
from api.models.gaming_model import Session, SessionOrder
from api.models.sales_model import Sale
from api.pagination import StandardResultsSetPagination
from api.serializers.reporting_serializer import DailyReportSerializer
from .permissions_view import (
    IsOwner,
    CanCloseShift,
    CanViewShiftReport,
    PermissionByActionMixin,
)


class DailyReportViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    queryset = DailyReport.objects.all()
    serializer_class = DailyReportSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    permission_action_map = {
        "list": [CanViewShiftReport],
        "retrieve": [CanViewShiftReport],
        "close_day": [CanCloseShift],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        selected_date = self.request.query_params.get("date")
        if selected_date:
            parsed_date = parse_date(selected_date)
            if not parsed_date:
                raise ValidationError({"date": "Use YYYY-MM-DD."})
            return queryset.filter(date=parsed_date)

        if any(key in self.request.query_params for key in ("period", "start", "end", "date_from", "date_to")):
            start_date, end_date = get_date_range_from_request(self.request)
            return queryset.filter(date__range=(start_date, end_date))

        return queryset

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def close_day(self, request):
        requested_date = request.data.get("date")
        target_date = parse_date(requested_date) if requested_date else timezone.localdate()
        if requested_date and not target_date:
            return Response(
                {"date": "Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Sessions Revenue & Cost
        completed_sessions = Session.objects.filter(
            end_time__date=target_date
        )
        revenue_sessions = completed_sessions.aggregate(total=Sum("final_cost"))["total"] or 0

        orders_cost = SessionOrder.objects.filter(
            session__in=completed_sessions
        ).aggregate(
            total=Sum(F("quantity") * F("unit_cost"))
        )["total"] or 0

        # 2. Standalone Sales Revenue & Cost
        standalone_sales = Sale.objects.filter(
            timestamp__date=target_date
        )
        revenue_standalone = standalone_sales.aggregate(total=Sum("total_price"))["total"] or 0
        standalone_cost = standalone_sales.aggregate(total=Sum("total_cost"))["total"] or 0

        total_revenue = float(revenue_sessions) + float(revenue_standalone)
        total_cost = float(orders_cost) + float(standalone_cost)
        net_profit = total_revenue - total_cost

        active_sessions = Session.objects.filter(
            end_time__isnull=True
        ).count()

        report, created = DailyReport.objects.update_or_create(
            date=target_date,
            defaults={
                "revenue_sessions": revenue_sessions,
                "revenue_standalone": revenue_standalone,
                "total_revenue": total_revenue,
                "orders_cost": orders_cost,
                "standalone_cost": standalone_cost,
                "total_cost": total_cost,
                "net_profit": net_profit,
                "active_sessions_at_close": active_sessions,
                "metadata": {
                    "generated_by": request.user.username,
                    "timestamp": timezone.now().isoformat()
                }
            }
        )

        return Response(DailyReportSerializer(report).data)
