from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from api.models import AuditLog, ResourceType, ResourceUnit
from api.serializers import ResourceTypeSerializer, ResourceUnitSerializer
from .permissions_view import PermissionByActionMixin, IsOwner, CanManageSessions


class ResourceTypeViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    queryset = ResourceType.objects.filter(is_active=True)
    serializer_class = ResourceTypeSerializer
    permission_classes = [IsOwner]
    permission_action_map = {
        "list": [IsAuthenticated],
        "retrieve": [IsAuthenticated],
        "create": [IsOwner],
        "update": [IsOwner],
        "partial_update": [IsOwner],
        "destroy": [IsOwner],
    }

    def perform_update(self, serializer):
        old_obj = self.get_object()
        old_price = old_obj.base_price
        instance = serializer.save()
        if "base_price" in serializer.validated_data and old_price != instance.base_price:
            AuditLog.objects.create(
                user=self.request.user,
                action_type=AuditLog.ACTION_UPDATE,
                resource_type="Device Pricing",
                resource_name=instance.name,
                description=(
                    f"Changed base price from {old_price} to {instance.base_price}"
                ),
                metadata={
                    "resource_type_id": instance.id,
                    "old_price": str(old_price),
                    "new_price": str(instance.base_price),
                },
            )


class ResourceUnitViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    queryset = ResourceUnit.objects.select_related("resource_type").filter(is_active=True)
    serializer_class = ResourceUnitSerializer
    permission_classes = [IsOwner]
    permission_action_map = {
        "list": [CanManageSessions],
        "retrieve": [CanManageSessions],
        "create": [IsOwner],
        "update": [IsOwner],
        "partial_update": [IsOwner],
        "destroy": [IsOwner],
        "activate": [IsOwner],
        "stop": [IsOwner],
    }

    def _set_status(self, status_value):
        unit = self.get_object()
        old_status = unit.status
        unit.status = status_value
        unit.save(update_fields=["status"])
        AuditLog.objects.create(
            user=self.request.user,
            action_type=AuditLog.ACTION_UPDATE,
            resource_type="Device Status",
            resource_name=unit.code,
            description=f"Changed device status from {old_status} to {unit.status}",
            metadata={
                "resource_unit_id": unit.id,
                "old_value": old_status,
                "new_value": unit.status,
            },
        )
        return Response(self.get_serializer(unit).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return self._set_status(ResourceUnit.STATUS_ACTIVE)

    @action(detail=True, methods=["post"])
    def stop(self, request, pk=None):
        return self._set_status(ResourceUnit.STATUS_STOPPED)
