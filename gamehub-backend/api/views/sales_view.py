from decimal import Decimal

from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.response import Response

from api.models import AuditLog, InventoryItem, Sale, SaleItem
from api.pagination import StandardResultsSetPagination
from api.serializers import SaleSerializer
from .permissions_view import CanCreateStandaloneSale, IsOwner, PermissionByActionMixin


class SaleViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [CanCreateStandaloneSale]
    queryset = Sale.objects.all().prefetch_related("items")
    pagination_class = StandardResultsSetPagination
    permission_action_map = {
        "list": [CanCreateStandaloneSale],
        "retrieve": [CanCreateStandaloneSale],
        "create": [CanCreateStandaloneSale],
        "update": [IsOwner],
        "partial_update": [IsOwner],
        "destroy": [IsOwner],
    }

    def _parse_quantity(self, value, item_name):
        try:
            quantity = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                {"items": f"Quantity for {item_name} must be a whole number."}
            )
        if quantity <= 0:
            raise serializers.ValidationError(
                {"items": f"Quantity for {item_name} must be greater than zero."}
            )
        return quantity

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        items_data = request.data.get("items", [])

        if not items_data:
            raise serializers.ValidationError({"items": "At least one item is required."})

        total_price = Decimal("0.00")
        total_cost = Decimal("0.00")
        audit_items = []

        sale = Sale.objects.create(user=request.user)

        for item in items_data:
            item_id = item.get("id")

            try:
                inventory_item = InventoryItem.objects.select_for_update().get(
                    id=item_id, is_active=True
                )
            except InventoryItem.DoesNotExist:
                raise serializers.ValidationError(
                    {"items": f"Inventory item with ID {item_id} does not exist."}
                )

            quantity = self._parse_quantity(
                item.get("quantity", 1), inventory_item.name
            )

            if inventory_item.quantity_in_stock < quantity:
                raise serializers.ValidationError(
                    {
                        "items": (
                            f"Insufficient stock for {inventory_item.name} "
                            f"(Available: {inventory_item.quantity_in_stock}, "
                            f"Requested: {quantity})"
                        )
                    }
                )

            inventory_item.quantity_in_stock -= quantity
            inventory_item.save(update_fields=["quantity_in_stock"])

            item_price = inventory_item.sale_price * quantity
            item_cost = inventory_item.cost_price * quantity

            sale_item = SaleItem.objects.create(
                sale=sale,
                inventory_item=inventory_item,
                item_name=inventory_item.name,
                quantity=quantity,
                unit_price=inventory_item.sale_price,
                unit_cost=inventory_item.cost_price,
                total_price=item_price,
            )
            audit_items.append(
                {
                    "inventory_item_id": inventory_item.id,
                    "sale_item_id": sale_item.id,
                    "name": inventory_item.name,
                    "quantity": quantity,
                    "unit_price": str(inventory_item.sale_price),
                    "stock_after": inventory_item.quantity_in_stock,
                }
            )
            total_price += item_price
            total_cost += item_cost

        sale.total_price = max(Decimal("0.00"), total_price)
        sale.total_cost = max(Decimal("0.00"), total_cost)
        sale.save(update_fields=["total_price", "total_cost"])

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ACTION_CREATE,
            resource_type="Standalone Sale",
            resource_name=f"Sale #{sale.id}",
            description="Created standalone POS sale.",
            metadata={
                "sale_id": sale.id,
                "items": audit_items,
                "total_price": str(sale.total_price),
                "total_cost": str(sale.total_cost),
            },
        )

        serializer = self.get_serializer(sale)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        return Response(
            {"error": "Edit sales by cancelling the sale and creating a corrected one."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        sale = self.get_object()
        restored_items = []
        for sale_item in sale.items.select_related("inventory_item").all():
            if not sale_item.inventory_item:
                continue
            inventory_item = InventoryItem.objects.select_for_update().get(
                id=sale_item.inventory_item_id
            )
            inventory_item.quantity_in_stock += sale_item.quantity
            inventory_item.save(update_fields=["quantity_in_stock"])
            restored_items.append(
                {
                    "inventory_item_id": inventory_item.id,
                    "sale_item_id": sale_item.id,
                    "quantity": sale_item.quantity,
                    "stock_after": inventory_item.quantity_in_stock,
                }
            )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ACTION_DELETE,
            resource_type="Standalone Sale",
            resource_name=f"Sale #{sale.id}",
            description="Deleted standalone POS sale and restored stock.",
            metadata={
                "sale_id": sale.id,
                "restored_items": restored_items,
                "old_value": {
                    "total_price": str(sale.total_price),
                    "total_cost": str(sale.total_cost),
                },
            },
        )
        sale.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
