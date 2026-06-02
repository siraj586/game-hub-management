from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from api.models import AuditLog
from api.pagination import StandardResultsSetPagination
from api.serializers import AuditLogSerializer
from .permissions_view import PermissionByActionMixin, IsOwner, CanViewAuditLogs


class AuditLogViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.select_related("user").all()
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    permission_action_map = {
        "list": [CanViewAuditLogs],
        "retrieve": [CanViewAuditLogs],
    }

    @action(detail=False, methods=["post"])
    def clear_logs(self, request):
        AuditLog.objects.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
