from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from api.currency import BASE_CURRENCY, convert_money, get_currency_settings, usd_to_local
from api.models import InventoryCategory, InventoryItem, User

class InventoryCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryCategory
        fields = ["id", "name", "code"]


class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.SerializerMethodField()
    sale_price_currency = serializers.CharField(
        max_length=3, write_only=True, required=False, default=BASE_CURRENCY
    )
    cost_price_currency = serializers.CharField(
        max_length=3, write_only=True, required=False, default=BASE_CURRENCY
    )
    local_sale_price = serializers.SerializerMethodField()
    local_cost_price = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = "__all__"

    def get_is_low_stock(self, obj):
        return obj.quantity_in_stock <= obj.minimum_stock_level

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_owner = bool(
            user
            and user.is_authenticated
            and (user.role == User.ROLE_OWNER or user.is_superuser)
        )
        if not is_owner and {"sale_price", "cost_price"} & set(attrs.keys()):
            raise serializers.ValidationError(
                "Only owners can modify inventory pricing fields."
            )
        settings = get_currency_settings()
        for amount_field, currency_field, original_currency_field, original_amount_field in [
            (
                "sale_price",
                "sale_price_currency",
                "original_price_currency",
                "original_price_amount",
            ),
            (
                "cost_price",
                "cost_price_currency",
                "original_cost_currency",
                "original_cost_amount",
            ),
        ]:
            currency_code = attrs.pop(currency_field, BASE_CURRENCY).strip().upper()
            if amount_field not in attrs:
                continue

            original_amount = attrs[amount_field]
            try:
                attrs[amount_field] = convert_money(
                    original_amount,
                    currency_code,
                    BASE_CURRENCY,
                    settings=settings,
                )
            except DjangoValidationError as exc:
                raise serializers.ValidationError({amount_field: exc.message})

            attrs[original_currency_field] = currency_code
            attrs[original_amount_field] = original_amount
        return attrs

    def get_local_sale_price(self, obj):
        settings = get_currency_settings()
        if not settings.local_currency_enabled:
            return None
        try:
            return usd_to_local(obj.sale_price, settings)
        except DjangoValidationError:
            return None

    def get_local_cost_price(self, obj):
        settings = get_currency_settings()
        if not settings.local_currency_enabled:
            return None
        try:
            return usd_to_local(obj.cost_price, settings)
        except DjangoValidationError:
            return None
