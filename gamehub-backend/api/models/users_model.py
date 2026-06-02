from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_OWNER = "OWNER"
    ROLE_STAFF = "STAFF"
    DEPRECATED_ROLES = ("MANAGER", "CASHIER")

    ROLE_CHOICES = (
        (ROLE_OWNER, "Owner"),
        (ROLE_STAFF, "Staff"),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STAFF)
    pin = models.CharField(max_length=10, unique=True, null=True, blank=True)

    def __str__(self):
        return self.username

    def has_staff_permission(self, perm_name):
        if self.role == self.ROLE_OWNER or self.is_superuser:
            return True
        if perm_name not in StaffPermission.PERMISSION_FIELDS:
            return False
        if self.role == self.ROLE_STAFF:
            try:
                return getattr(self.staff_permissions, perm_name, False)
            except StaffPermission.DoesNotExist:
                return False
        return False


class StaffPermission(models.Model):
    PERMISSION_FIELDS = (
        "can_start_session",
        "can_pause_session",
        "can_resume_session",
        "can_end_session",
        "can_add_session_order",
        "can_remove_session_order",
        "can_create_standalone_sale",
        "can_apply_discount",
        "can_view_shift_report",
        "can_close_shift",
        "can_manage_inventory",
        "can_update_stock",
        "can_view_audit_logs",
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_permissions")
    can_start_session = models.BooleanField(default=False)
    can_pause_session = models.BooleanField(default=False)
    can_resume_session = models.BooleanField(default=False)
    can_end_session = models.BooleanField(default=False)
    can_add_session_order = models.BooleanField(default=False)
    can_remove_session_order = models.BooleanField(default=False)
    can_create_standalone_sale = models.BooleanField(default=False)
    can_apply_discount = models.BooleanField(default=False)
    can_view_shift_report = models.BooleanField(default=False)
    can_close_shift = models.BooleanField(default=False)
    can_manage_inventory = models.BooleanField(default=False)
    can_update_stock = models.BooleanField(default=False)
    can_view_audit_logs = models.BooleanField(default=False)

    def __str__(self):
        return f"Permissions for {self.user.username}"
