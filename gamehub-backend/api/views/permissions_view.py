from rest_framework.permissions import BasePermission
from api.models import User


def is_owner_user(user):
    return bool(
        user
        and user.is_authenticated
        and (user.role == User.ROLE_OWNER or user.is_superuser)
    )


def has_staff_permission(user, permission_name):
    if is_owner_user(user):
        return True
    return bool(
        user
        and user.is_authenticated
        and user.role == User.ROLE_STAFF
        and user.has_staff_permission(permission_name)
    )


def has_any_staff_permission(user, permission_names):
    if is_owner_user(user):
        return True
    return any(
        has_staff_permission(user, permission_name) for permission_name in permission_names
    )


class IsOwner(BasePermission):
    def has_permission(self, request, view):
        return is_owner_user(request.user)


class HasStaffPermission(BasePermission):
    permission_name = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not self.permission_name:
            return False
        return has_staff_permission(request.user, self.permission_name)


class CanManageSessions(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return has_any_staff_permission(request.user, [
            "can_start_session",
            "can_pause_session",
            "can_resume_session",
            "can_end_session",
            "can_add_session_order",
            "can_remove_session_order",
        ])


class CanStartSession(HasStaffPermission):
    permission_name = "can_start_session"


class CanPauseSession(HasStaffPermission):
    permission_name = "can_pause_session"


class CanResumeSession(HasStaffPermission):
    permission_name = "can_resume_session"


class CanPauseOrResumeSession(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return has_any_staff_permission(request.user, [
            "can_pause_session",
            "can_resume_session",
        ])

    def has_object_permission(self, request, view, obj):
        if is_owner_user(request.user):
            return True
        if request.user.role == User.ROLE_STAFF:
            if obj.is_paused:
                return has_staff_permission(request.user, "can_resume_session")
            else:
                return has_staff_permission(request.user, "can_pause_session")
        return False


class CanEndSession(HasStaffPermission):
    permission_name = "can_end_session"


class CanAddSessionOrder(HasStaffPermission):
    permission_name = "can_add_session_order"


class CanRemoveSessionOrder(HasStaffPermission):
    permission_name = "can_remove_session_order"


class CanCreateStandaloneSale(HasStaffPermission):
    permission_name = "can_create_standalone_sale"


class CanApplyDiscount(HasStaffPermission):
    permission_name = "can_apply_discount"


class CanViewShiftReport(HasStaffPermission):
    permission_name = "can_view_shift_report"


class CanCloseShift(HasStaffPermission):
    permission_name = "can_close_shift"


class CanManageInventory(HasStaffPermission):
    permission_name = "can_manage_inventory"


class CanUpdateStock(HasStaffPermission):
    permission_name = "can_update_stock"


class CanViewAuditLogs(HasStaffPermission):
    permission_name = "can_view_audit_logs"


class CanViewOrManageInventory(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return has_any_staff_permission(request.user, [
            "can_manage_inventory",
            "can_update_stock",
            "can_create_standalone_sale",
            "can_add_session_order",
        ])


class CanUpdateInventoryItem(BasePermission):
    pricing_fields = {"sale_price", "cost_price"}
    stock_fields = {"quantity_in_stock"}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_owner_user(request.user):
            return True

        submitted_fields = set(request.data.keys())
        if submitted_fields & self.pricing_fields:
            return False
        if submitted_fields and submitted_fields <= self.stock_fields:
            return has_any_staff_permission(request.user, [
                "can_update_stock",
                "can_manage_inventory",
            ])
        return has_staff_permission(request.user, "can_manage_inventory")


class PermissionByActionMixin:
    permission_action_map = {}

    def get_permissions(self):
        classes = self.permission_action_map.get(self.action, self.permission_classes)
        return [permission() for permission in classes]
