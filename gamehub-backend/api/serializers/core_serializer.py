from rest_framework import serializers
from api.currency import BASE_CURRENCY, convert_money, round_money
from api.models import CurrencySettings, FeatureFlag, MonthlyExpense, MonthlyExpenseSettings

class FeatureFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeatureFlag
        fields = "__all__"


class CurrencySettingsSerializer(serializers.ModelSerializer):
    base_currency_code = serializers.CharField(read_only=True)

    class Meta:
        model = CurrencySettings
        fields = [
            "id",
            "base_currency_code",
            "local_currency_enabled",
            "local_currency_code",
            "local_currency_name",
            "local_units_per_usd",
            "updated_at",
        ]
        read_only_fields = ["id", "base_currency_code", "updated_at"]

    def validate(self, attrs):
        enabled = attrs.get(
            "local_currency_enabled",
            getattr(self.instance, "local_currency_enabled", False),
        )
        code = attrs.get("local_currency_code", getattr(self.instance, "local_currency_code", ""))
        name = attrs.get("local_currency_name", getattr(self.instance, "local_currency_name", ""))
        rate = attrs.get("local_units_per_usd", getattr(self.instance, "local_units_per_usd", None))

        if code:
            code = code.strip().upper()
            attrs["local_currency_code"] = code

        if enabled:
            if not code:
                raise serializers.ValidationError(
                    {"local_currency_code": "Local currency code is required when enabled."}
                )
            if code == BASE_CURRENCY:
                raise serializers.ValidationError(
                    {"local_currency_code": "Local currency must be different from USD."}
                )
            if not name:
                raise serializers.ValidationError(
                    {"local_currency_name": "Local currency name is required when enabled."}
                )
            if rate is None:
                raise serializers.ValidationError(
                    {"local_units_per_usd": "Exchange rate is required when local currency is enabled."}
                )
            if rate <= 0:
                raise serializers.ValidationError(
                    {"local_units_per_usd": "Exchange rate must be greater than 0."}
                )
        elif rate is not None and rate <= 0:
            raise serializers.ValidationError(
                {"local_units_per_usd": "Exchange rate must be greater than 0."}
            )

        return attrs


class MoneyConversionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    from_currency = serializers.CharField(max_length=3)
    to_currency = serializers.CharField(max_length=3)
    converted_amount = serializers.SerializerMethodField()

    def validate(self, attrs):
        settings = self.context.get("currency_settings")
        try:
            convert_money(
                attrs["amount"],
                attrs["from_currency"],
                attrs["to_currency"],
                settings=settings,
            )
        except Exception as exc:
            raise serializers.ValidationError({"amount": str(exc)})
        return attrs

    def get_converted_amount(self, obj):
        settings = self.context.get("currency_settings")
        return round_money(
            convert_money(
                obj["amount"],
                obj["from_currency"],
                obj["to_currency"],
                settings=settings,
            )
        )


class MonthlyExpenseSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyExpenseSettings
        fields = [
            "id",
            "electricity",
            "internet",
            "rent",
            "salaries",
            "maintenance",
            "other",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class MonthlyExpenseSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = MonthlyExpense
        fields = [
            "id",
            "month",
            "electricity",
            "internet",
            "rent",
            "salaries",
            "maintenance",
            "other",
            "notes",
            "total",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total", "created_at", "updated_at"]

    def validate_month(self, value):
        return value.replace(day=1)

    def validate(self, attrs):
        for field in [
            "electricity",
            "internet",
            "rent",
            "salaries",
            "maintenance",
            "other",
        ]:
            if attrs.get(field, 0) < 0:
                raise serializers.ValidationError({field: "Expense cannot be negative."})
        return attrs
