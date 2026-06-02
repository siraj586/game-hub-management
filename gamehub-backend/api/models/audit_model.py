from django.db import models
from .users_model import User

class AuditLog(models.Model):
    ACTION_UPDATE = "UPDATE"
    ACTION_DELETE = "DELETE"
    ACTION_CREATE = "CREATE"

    user = models.ForeignKey(User, related_name="audit_logs", on_delete=models.PROTECT)
    action_type = models.CharField(max_length=20, default=ACTION_UPDATE)
    resource_type = models.CharField(max_length=50)  # e.g., 'Device', 'Cafe'
    resource_name = models.CharField(max_length=200)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user.username} - {self.action_type} {self.resource_type} - {self.timestamp}"
