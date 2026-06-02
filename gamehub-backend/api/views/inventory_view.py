from rest_framework import viewsets
from api.models import InventoryCategory, InventoryItem, AuditLog
from api.serializers import InventoryCategorySerializer, InventoryItemSerializer
from .permissions_view import (
    PermissionByActionMixin,
    CanManageInventory,
    CanUpdateInventoryItem,
    CanViewOrManageInventory,
    IsOwner,
)

class InventoryCategoryViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    queryset = InventoryCategory.objects.all()
    serializer_class = InventoryCategorySerializer
    permission_classes = [CanManageInventory]
    permission_action_map = {
        "list": [CanViewOrManageInventory],
        "retrieve": [CanViewOrManageInventory],
        "create": [CanManageInventory],
        "update": [CanManageInventory],
        "partial_update": [CanManageInventory],
        "destroy": [IsOwner],
    }

class InventoryItemViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    queryset = InventoryItem.objects.select_related("category")
    serializer_class = InventoryItemSerializer
    permission_classes = [CanManageInventory]
    permission_action_map = {
        "list": [CanViewOrManageInventory],
        "retrieve": [CanViewOrManageInventory],
        "create": [CanManageInventory],
        "update": [CanUpdateInventoryItem],
        "partial_update": [CanUpdateInventoryItem],
        "destroy": [IsOwner],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        include_inactive = self.request.query_params.get("include_inactive")
        if include_inactive == "true" and IsOwner().has_permission(self.request, self):
            return queryset
        return queryset.filter(is_active=True)

    def perform_update(self, serializer):
        old_obj = self.get_object()
        old_price = old_obj.sale_price
        old_stock = old_obj.quantity_in_stock
        new_price = serializer.validated_data.get("sale_price")
        instance = serializer.save()

        if new_price is not None and old_price != instance.sale_price:
            AuditLog.objects.create(
                user=self.request.user,
                action_type=AuditLog.ACTION_UPDATE,
                resource_type="Inventory Pricing",
                resource_name=instance.name,
                description=(
                    f"Changed sale price from {old_price} to {instance.sale_price}"
                ),
                metadata={
                    "inventory_item_id": instance.id,
                    "old_price": str(old_price),
                    "new_price": str(instance.sale_price),
                },
            )
        if (
            "quantity_in_stock" in serializer.validated_data
            and old_stock != instance.quantity_in_stock
        ):
            AuditLog.objects.create(
                user=self.request.user,
                action_type=AuditLog.ACTION_UPDATE,
                resource_type="Inventory Stock",
                resource_name=instance.name,
                description=(
                    f"Changed stock from {old_stock} to {instance.quantity_in_stock}"
                ),
                metadata={
                    "inventory_item_id": instance.id,
                    "old_stock": old_stock,
                    "new_stock": instance.quantity_in_stock,
                },
            )
