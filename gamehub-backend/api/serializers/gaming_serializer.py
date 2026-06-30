from datetime import timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from api.currency import BASE_CURRENCY, convert_money, get_currency_settings, round_money
from api.models import Session, SessionOrder, ResourceUnit

class SessionOrderSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="item_name", read_only=True)
    price = serializers.DecimalField(
        source="total_price", max_digits=10, decimal_places=2, read_only=True
    )
    time = serializers.DateTimeField(source="timestamp", read_only=True)

    class Meta:
        model = SessionOrder
        fields = [
            "id",
            "inventory_item",
            "item_name",
            "quantity",
            "unit_price",
            "total_price",
            "timestamp",
            "name",
            "price",
            "time",
        ]

class SessionSerializer(serializers.ModelSerializer):
    orders = SessionOrderSerializer(many=True, read_only=True)
    durationMinutes = serializers.SerializerMethodField()
    totalCost = serializers.SerializerMethodField()
    ordersCost = serializers.SerializerMethodField()
    live_cost = serializers.SerializerMethodField()
    elapsed_time = serializers.SerializerMethodField()
    effective_rate = serializers.SerializerMethodField()
    final_total = serializers.SerializerMethodField()
    paused_duration = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    resourceType = serializers.CharField(
        source="resource_unit.resource_type.code", read_only=True
    )
    stationId = serializers.CharField(source="resource_unit.code", read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "customer_name",
            "resource_unit",
            "resourceType",
            "stationId",
            "session_type",
            "custom_price_per_hour",
            "fixed_price",
            "prepaid_amount_usd",
            "original_payment_currency",
            "original_payment_amount",
            "duration_hours",
            "start_time",
            "planned_end_time",
            "end_time",
            "is_paused",
            "last_pause_time",
            "total_paused_ms",
            "discount",
            "metadata",
            "orders",
            "durationMinutes",
            "totalCost",
            "ordersCost",
            "live_cost",
            "elapsed_time",
            "effective_rate",
            "final_total",
            "paused_duration",
            "payment_method",
        ]

    def get_durationMinutes(self, obj):
        if obj.final_duration_minutes is not None:
            return float(obj.final_duration_minutes)
        return round(obj.get_active_ms() / 60000, 2)

    def get_totalCost(self, obj):
        cost = obj.final_cost if obj.final_cost is not None else obj.get_live_cost()
        return str(round_money(cost))

    def get_ordersCost(self, obj):
        return str(round_money(obj.get_orders_cost()))

    def get_live_cost(self, obj):
        return str(round_money(obj.get_live_cost()))

    def get_elapsed_time(self, obj):
        if obj.final_duration_minutes is not None:
            return float(obj.final_duration_minutes)
        return round(obj.get_active_ms() / 60000, 2)

    def get_effective_rate(self, obj):
        return str(round_money(obj.effective_hourly_rate))

    def get_final_total(self, obj):
        cost = obj.final_cost if obj.final_cost is not None else obj.get_live_cost()
        return str(round_money(cost))

    def get_paused_duration(self, obj):
        paused_ms = obj.total_paused_ms
        if obj.is_paused and obj.last_pause_time and not obj.end_time:
            paused_ms += int((timezone.now() - obj.last_pause_time).total_seconds() * 1000)
        return round(paused_ms / 60000, 2)

    def get_payment_method(self, obj):
        return "CASH"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "name": data["customer_name"],
            "deviceType": data["resourceType"],
            "stationId": data["stationId"],
            "resourceUnitId": data["resource_unit"],
            "sessionType": data["session_type"],
            "pricePerHour": data["custom_price_per_hour"],
            "fixedPrice": data["fixed_price"],
            "prepaidAmountUsd": data["prepaid_amount_usd"],
            "originalPaymentCurrency": data["original_payment_currency"],
            "originalPaymentAmount": data["original_payment_amount"],
            "durationHours": (
                float(data["duration_hours"])
                if data["duration_hours"] is not None
                else 0
            ),
            "startTime": data["start_time"],
            "plannedEndTime": data["planned_end_time"],
            "endTime": data["end_time"],
            "isPaused": data["is_paused"],
            "lastPauseTime": data["last_pause_time"],
            "totalPausedMs": data["total_paused_ms"],
            "discount": data["discount"],
            "orders": data["orders"],
            "durationMinutes": data["durationMinutes"],
            "ordersCost": data["ordersCost"],
            "totalCost": data["totalCost"],
            "live_cost": data["live_cost"],
            "elapsed_time": data["elapsed_time"],
            "effective_rate": data["effective_rate"],
            "final_total": data["final_total"],
            "paused_duration": data["paused_duration"],
            "payment_method": data["payment_method"],
            "paymentMethod": data["payment_method"],
            "liveCost": data["live_cost"],
            "elapsedTime": data["elapsed_time"],
            "effectiveRate": data["effective_rate"],
            "finalTotal": data["final_total"],
            "pausedDuration": data["paused_duration"],
            "metadata": data["metadata"],
            "alerted10min": False,
        }

class SessionCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    resourceUnitId = serializers.IntegerField(required=False)
    stationId = serializers.CharField(required=False)
    sessionType = serializers.ChoiceField(
        choices=[Session.SESSION_PREPAID, Session.SESSION_POSTPAID],
        default=Session.SESSION_POSTPAID,
    )
    pricePerHour = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    fixedPrice = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    priceCurrency = serializers.CharField(
        max_length=3, required=False, default=BASE_CURRENCY, allow_blank=True
    )
    paymentCurrency = serializers.CharField(
        max_length=3, required=False, allow_null=True, allow_blank=True
    )
    prepaidAmount = serializers.DecimalField(
        max_digits=18, decimal_places=2, required=False, allow_null=True
    )
    durationHours = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, allow_null=True
    )
    metadata = serializers.JSONField(required=False, allow_null=True)

    def validate(self, attrs):
        unit = None
        if attrs.get("resourceUnitId"):
            unit = (
                ResourceUnit.objects.filter(
                    id=attrs["resourceUnitId"],
                    is_active=True,
                    status=ResourceUnit.STATUS_ACTIVE,
                )
                .select_related("resource_type")
                .first()
            )
        elif attrs.get("stationId"):
            unit = (
                ResourceUnit.objects.filter(
                    code=attrs["stationId"],
                    is_active=True,
                    status=ResourceUnit.STATUS_ACTIVE,
                )
                .select_related("resource_type")
                .first()
            )

        if not unit:
            raise serializers.ValidationError(
                {"resourceUnitId": "Valid resource unit is required."}
            )

        if Session.objects.filter(resource_unit=unit, end_time__isnull=True).exists():
            raise serializers.ValidationError(
                {"stationId": f"Station {unit.code} is already occupied."}
            )

        attrs["resource_unit"] = unit

        settings = get_currency_settings()
        price_currency = (attrs.get("priceCurrency") or BASE_CURRENCY).strip().upper()
        for price_field in ["pricePerHour", "fixedPrice"]:
            if attrs.get(price_field) is None:
                continue
            try:
                attrs[price_field] = convert_money(
                    attrs[price_field],
                    price_currency,
                    BASE_CURRENCY,
                    settings=settings,
                )
            except DjangoValidationError as exc:
                raise serializers.ValidationError({price_field: exc.message})

        prepaid_amount = attrs.get("prepaidAmount")
        if prepaid_amount is not None:
            if prepaid_amount <= 0:
                raise serializers.ValidationError(
                    {"prepaidAmount": "Prepaid amount must be greater than 0."}
                )
            # Phase 1: paymentCurrency is required for prepaid sessions
            payment_currency_raw = attrs.get("paymentCurrency")
            if not payment_currency_raw or not str(payment_currency_raw).strip():
                raise serializers.ValidationError(
                    {"paymentCurrency": "Payment currency is required for prepaid sessions."}
                )
            payment_currency = str(payment_currency_raw).strip().upper()
            try:
                prepaid_amount_usd = convert_money(
                    prepaid_amount,
                    payment_currency,
                    BASE_CURRENCY,
                    settings=settings,
                )
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"prepaidAmount": exc.message})

            attrs["prepaid_amount_usd"] = prepaid_amount_usd
            attrs["original_payment_currency"] = payment_currency
            attrs["original_payment_amount"] = prepaid_amount

            hourly_rate = Decimal(str(attrs.get("pricePerHour") or unit.resource_type.base_price))
            if (
                attrs["sessionType"] == Session.SESSION_PREPAID
                and hourly_rate > 0
            ):
                attrs["durationHours"] = round_money(prepaid_amount_usd / hourly_rate)

        if attrs["sessionType"] == Session.SESSION_PREPAID and attrs.get(
            "durationHours"
        ):
            attrs["planned_end_time"] = timezone.now() + timedelta(
                hours=float(attrs["durationHours"])
            )
        else:
            attrs["planned_end_time"] = None
        return attrs
