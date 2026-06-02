from decimal import Decimal
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from api.currency import BASE_CURRENCY, convert_money, get_currency_settings
from api.models import (
    FeatureFlag,
    ResourceType,
    ResourceUnit,
    InventoryCategory,
    InventoryItem,
    AuditLog,
)
from .permissions_view import IsOwner


class BulkSetupView(APIView):
    permission_classes = [IsOwner]

    @transaction.atomic
    def post(self, request):
        feature_flags = request.data.get("feature_flags", [])
        resource_types = request.data.get("resource_types", [])
        resource_units = request.data.get("resource_units", [])
        inventory_categories = request.data.get("inventory_categories", [])
        inventory_items = request.data.get("inventory_items", [])

        # ─── Feature Flags ───────────────────────────────────────────────────
        FeatureFlag.objects.all().delete()
        for item in feature_flags:
            FeatureFlag.objects.create(
                key=item["key"],
                enabled=item.get("enabled", True),
                config=item.get("config", {}),
            )

        # ─── Resource Types ───────────────────────────────────────────────────
        type_map = {}
        for item in resource_types:
            existing_type = ResourceType.objects.filter(code=item["code"]).first()
            old_p = Decimal(str(existing_type.base_price)) if existing_type else None
            obj, created = ResourceType.objects.update_or_create(
                code=item["code"],
                defaults={
                    "name": item.get("name", item["code"]),
                    "prefix": item.get("prefix", item["code"][:3].upper()),
                    "pricing_strategy": item.get(
                        "pricing_strategy", ResourceType.PRICING_HOURLY
                    ),
                    "base_price": item.get("base_price", 0),
                    "metadata": item.get("metadata", {}),
                    "is_active": item.get("is_active", True),
                },
            )
            if not created and "base_price" in item:
                new_p = Decimal(str(item["base_price"]))
                if old_p != new_p:
                    AuditLog.objects.create(
                        user=request.user,
                        action_type=AuditLog.ACTION_UPDATE,
                        resource_type="Device Pricing",
                        resource_name=obj.name,
                        description=f"System update: Base price changed from {old_p} to {new_p}",
                        metadata={
                            "resource_type_id": obj.id,
                            "old_price": str(old_p),
                            "new_price": str(new_p),
                            "source": "bulk_setup",
                        },
                    )
            type_map[obj.code] = obj

        incoming_type_codes = [item["code"] for item in resource_types]
        ResourceType.objects.exclude(code__in=incoming_type_codes).update(is_active=False)

        # ─── Resource Units ───────────────────────────────────────────────────
        for item in resource_units:
            resource_type = type_map[item["resource_type_code"]]
            existing_unit = ResourceUnit.objects.filter(code=item["code"]).first()
            ResourceUnit.objects.update_or_create(
                code=item["code"],
                defaults={
                    "resource_type": resource_type,
                    "display_name": item.get("display_name", ""),
                    "status": item.get(
                        "status",
                        existing_unit.status if existing_unit else ResourceUnit.STATUS_ACTIVE,
                    ),
                    "metadata": item.get("metadata", {}),
                    "is_active": item.get("is_active", True),
                }
            )

        incoming_unit_codes = [item["code"] for item in resource_units]
        ResourceUnit.objects.exclude(code__in=incoming_unit_codes).update(is_active=False)

        # ─── Inventory ────────────────────────────────────────────────────────
        category_map = {}
        for item in inventory_categories:
            category, _ = InventoryCategory.objects.update_or_create(
                code=item["code"],
                defaults={"name": item["name"]}
            )
            category_map[category.code] = category

        incoming_item_names = [item["name"] for item in inventory_items]
        currency_settings = get_currency_settings()
        for item in inventory_items:
            category = category_map[item["category_code"]]
            existing_item = InventoryItem.objects.filter(
                category=category, name=item["name"]
            ).first()
            old_p = Decimal(str(existing_item.sale_price)) if existing_item else None
            sale_currency = item.get("sale_price_currency", BASE_CURRENCY)
            cost_currency = item.get("cost_price_currency", BASE_CURRENCY)
            try:
                sale_price_usd = convert_money(
                    item.get("sale_price", 0),
                    sale_currency,
                    BASE_CURRENCY,
                    settings=currency_settings,
                )
                cost_price_usd = convert_money(
                    item.get("cost_price", 0),
                    cost_currency,
                    BASE_CURRENCY,
                    settings=currency_settings,
                )
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"inventory_items": exc.message})

            obj, created = InventoryItem.objects.update_or_create(
                category=category,
                name=item["name"],
                defaults={
                    "sku": item.get("sku", ""),
                    "sale_price": sale_price_usd,
                    "cost_price": cost_price_usd,
                    "original_price_currency": sale_currency.strip().upper(),
                    "original_price_amount": item.get("sale_price", 0),
                    "original_cost_currency": cost_currency.strip().upper(),
                    "original_cost_amount": item.get("cost_price", 0),
                    "quantity_in_stock": item.get("quantity_in_stock", 0),
                    "minimum_stock_level": item.get("minimum_stock_level", 0),
                    "is_active": item.get("is_active", True),
                    "metadata": item.get("metadata", {}),
                }
            )
            if not created and "sale_price" in item:
                new_p = Decimal(str(item["sale_price"]))
                if old_p != new_p:
                    AuditLog.objects.create(
                        user=request.user,
                        action_type=AuditLog.ACTION_UPDATE,
                        resource_type="Inventory Pricing",
                        resource_name=obj.name,
                        description=f"System update: Price changed from {old_p} to {new_p}",
                        metadata={
                            "inventory_item_id": obj.id,
                            "old_price": str(old_p),
                            "new_price": str(new_p),
                            "source": "bulk_setup",
                        },
                    )

        InventoryItem.objects.filter(category__in=category_map.values()).exclude(
            name__in=incoming_item_names
        ).update(is_active=False)

        return Response({"message": "Bulk setup synced successfully"})
