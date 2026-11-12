from decimal import Decimal
from io import BytesIO

from django.db import transaction
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from django.utils.timezone import now
from openpyxl import Workbook
from openpyxl.styles import Font
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from api.business_day import business_today, day_bounds
from api.models.core_model import DailyReport
from api.models.gaming_model import Session
from api.models.sales_model import Sale
from .permissions_view import CanCloseShift, CanViewShiftReport, PermissionByActionMixin

CENT = Decimal("0.01")

FIGURE_FIELDS = (
    "revenue_sessions",
    "revenue_standalone",
    "total_revenue",
    "orders_cost",
    "standalone_cost",
    "total_cost",
    "actual_usd_received",
    "actual_local_received",
    "net_profit",
)

EXPORT_COLUMNS = (
    ("date", "Date", "التاريخ"),
    ("revenue_sessions", "Session revenue", "إيراد الجلسات"),
    ("revenue_standalone", "Sales revenue", "إيراد المبيعات"),
    ("total_revenue", "Total revenue", "إجمالي الإيراد"),
    ("total_cost", "Total cost", "إجمالي التكلفة"),
    ("net_profit", "Net profit", "صافي الربح"),
    ("actual_usd_received", "Expected USD", "الدولار المتوقع"),
    ("counted_usd", "Counted USD", "الدولار المعدود"),
    ("usd_variance", "USD difference", "فرق الدولار"),
    ("actual_local_received", "Expected local", "المحلي المتوقع"),
    ("counted_local", "Counted local", "المحلي المعدود"),
    ("local_variance", "Local difference", "فرق المحلي"),
    ("active_sessions_at_close", "Running at close", "جلسات شغالة عند الإغلاق"),
)


def _variance(counted, expected):
    return None if counted is None else counted - expected


class DailyReportSerializer(serializers.ModelSerializer):
    usd_variance = serializers.SerializerMethodField()
    local_variance = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    closed_by = serializers.SerializerMethodField()

    class Meta:
        model = DailyReport
        fields = "__all__"

    def get_usd_variance(self, obj):
        value = _variance(obj.counted_usd, obj.actual_usd_received)
        return None if value is None else str(value)

    def get_local_variance(self, obj):
        value = _variance(obj.counted_local, obj.actual_local_received)
        return None if value is None else str(value)

    def get_is_locked(self, obj):
        return bool(obj.metadata.get("locked_at"))

    def get_closed_by(self, obj):
        return obj.metadata.get("closed_by") or obj.metadata.get("generated_by")


class CloseDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    counted_usd = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True
    )
    counted_local = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True
    )


def _is_known(payment_currency, exchange_rate):
    return payment_currency not in (None, "", "UNKNOWN") and exchange_rate is not None


def _day_sessions(target_date):
    start, end = day_bounds(target_date)
    return Session.objects.filter(end_time__gte=start, end_time__lt=end)


def _day_figures(target_date):
    start, end = day_bounds(target_date)
    sessions = list(_day_sessions(target_date).prefetch_related("orders"))
    sales = list(Sale.objects.filter(timestamp__gte=start, timestamp__lt=end))

    revenue_sessions = sum((s.final_cost or Decimal("0") for s in sessions), Decimal("0"))
    revenue_standalone = sum((s.total_price or Decimal("0") for s in sales), Decimal("0"))

    orders_cost = Decimal("0")
    for session in sessions:
        for order in session.orders.all():
            orders_cost += Decimal(str(order.quantity)) * (order.unit_cost or Decimal("0"))
    standalone_cost = sum((s.total_cost or Decimal("0") for s in sales), Decimal("0"))

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

    total_revenue = revenue_sessions + revenue_standalone
    total_cost = orders_cost + standalone_cost
    figures = {
        "revenue_sessions": revenue_sessions,
        "revenue_standalone": revenue_standalone,
        "total_revenue": total_revenue,
        "orders_cost": orders_cost,
        "standalone_cost": standalone_cost,
        "total_cost": total_cost,
        "actual_usd_received": actual_usd,
        "actual_local_received": actual_local,
        "net_profit": total_revenue - total_cost,
    }
    return {key: Decimal(value).quantize(CENT) for key, value in figures.items()}


def _figures_changed(report, figures):
    return any(getattr(report, field) != figures[field] for field in FIGURE_FIELDS)


class DailyReportViewSet(PermissionByActionMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = DailyReportSerializer
    queryset = DailyReport.objects.all().order_by("-date")
    permission_action_map = {
        "list": [CanViewShiftReport],
        "retrieve": [CanViewShiftReport],
        "export": [CanViewShiftReport],
        "preview": [CanCloseShift],
        "close_day": [CanCloseShift],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        for param, lookup in (("start", "date__gte"), ("end", "date__lte")):
            raw = self.request.query_params.get(param)
            if raw:
                parsed = parse_date(raw)
                if not parsed:
                    raise ValidationError({param: "Use YYYY-MM-DD format."})
                queryset = queryset.filter(**{lookup: parsed})
        return queryset

    @action(detail=False, methods=["get"])
    def preview(self, request):
        """What closing a day would record, without changing anything."""
        target_date = parse_date(request.query_params.get("date") or "") or business_today()

        figures = _day_figures(target_date)
        report = DailyReport.objects.filter(date=target_date).first()
        is_closed = bool(report and report.metadata.get("locked_at"))
        running = Session.objects.filter(end_time__isnull=True).select_related("resource_unit")
        return Response(
            {
                "date": target_date.isoformat(),
                **{key: str(value) for key, value in figures.items()},
                "already_closed": is_closed,
                "has_changes": is_closed and _figures_changed(report, figures),
                "counted_usd": str(report.counted_usd) if report and report.counted_usd is not None else None,
                "counted_local": str(report.counted_local) if report and report.counted_local is not None else None,
                "running_sessions": [
                    {"id": s.id, "name": s.customer_name, "stationId": s.resource_unit.code}
                    for s in running
                ],
            }
        )

    @action(detail=False, methods=["post"])
    def close_day(self, request):
        payload = CloseDaySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target_date = payload.validated_data["date"]
        if target_date > business_today():
            raise ValidationError({"date": "This day has not happened yet."})

        with transaction.atomic():
            report, created = DailyReport.objects.select_for_update().get_or_create(
                date=target_date
            )
            figures = _day_figures(target_date)
            was_locked = not created and bool(report.metadata.get("locked_at"))
            counted = {
                field: payload.validated_data[field]
                for field in ("counted_usd", "counted_local")
                if payload.validated_data.get(field) is not None
            }
            cash_changed = any(getattr(report, f) != v for f, v in counted.items())

            Session.hide_from_activity(_day_sessions(target_date))

            if was_locked and not cash_changed and not _figures_changed(report, figures):
                return Response(
                    {
                        "detail": "This day is already closed and nothing has changed.",
                        "date": target_date.isoformat(),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            meta = dict(report.metadata or {})
            if was_locked:
                # Keep what the report said before late sessions or corrections updated it.
                meta["revisions"] = [
                    *meta.get("revisions", []),
                    {
                        "replaced_at": now().isoformat(),
                        "closed_by": meta.get("closed_by"),
                        "locked_at": meta.get("locked_at"),
                        "counted_usd": str(report.counted_usd) if report.counted_usd is not None else None,
                        "counted_local": str(report.counted_local) if report.counted_local is not None else None,
                        **{field: str(getattr(report, field)) for field in FIGURE_FIELDS},
                    },
                ]
            meta["locked_at"] = now().isoformat()
            meta["closed_by"] = request.user.username

            for field, value in {**figures, **counted}.items():
                setattr(report, field, value)
            report.active_sessions_at_close = Session.objects.filter(end_time__isnull=True).count()
            report.metadata = meta
            report.save()

        return Response(self.get_serializer(report).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def export(self, request):
        arabic = request.query_params.get("lang") == "ar"
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "التقارير" if arabic else "Daily reports"
        sheet.sheet_view.rightToLeft = arabic

        sheet.append([arabic_label if arabic else label for _, label, arabic_label in EXPORT_COLUMNS])
        for cell in sheet[1]:
            cell.font = Font(bold=True)

        for row in self.get_serializer(self.get_queryset(), many=True).data:
            sheet.append(
                [
                    row[key] if key in ("date", "active_sessions_at_close") or row[key] is None
                    else float(row[key])
                    for key, _, _ in EXPORT_COLUMNS
                ]
            )
        sheet.freeze_panes = "A2"
        for column in sheet.columns:
            sheet.column_dimensions[column[0].column_letter].width = 18

        buffer = BytesIO()
        workbook.save(buffer)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="daily-reports.xlsx"'
        return response
