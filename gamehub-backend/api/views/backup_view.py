from django.http import FileResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.backups import (
    BackupError,
    backup_dir,
    create_backup,
    list_backups,
    resolve_backup,
    restore_backup,
)
from api.models import AuditLog, User
from .permissions_view import IsOwner


def _audit_backup(user, description, name):
    AuditLog.objects.create(
        user=user,
        action_type=AuditLog.ACTION_UPDATE,
        resource_type="Backup",
        resource_name=name,
        description=description,
        metadata={"backup": name},
    )


class BackupListView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        return Response({"directory": str(backup_dir()), "backups": list_backups()})

    def post(self, request):
        path = create_backup()
        _audit_backup(request.user, "Created a database backup.", path.name)
        return Response({"name": path.name}, status=status.HTTP_201_CREATED)


class BackupDownloadView(APIView):
    permission_classes = [IsOwner]

    def get(self, request, name):
        try:
            path = resolve_backup(name)
        except BackupError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(path.open("rb"), as_attachment=True, filename=path.name)


class BackupRestoreView(APIView):
    permission_classes = [IsOwner]

    def post(self, request, name):
        try:
            safety_copy = restore_backup(name)
        except BackupError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        # The restored data may not contain the user who requested the restore.
        actor = (
            User.objects.filter(pk=request.user.pk).first()
            or User.objects.filter(role=User.ROLE_OWNER).first()
        )
        if actor:
            _audit_backup(actor, "Restored the database from a backup.", name)
        return Response({"restored": name, "safety_copy": safety_copy.name})
