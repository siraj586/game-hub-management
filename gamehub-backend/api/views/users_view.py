from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

from api.models import User, FeatureFlag, StaffPermission
from .auth_view import _shop_name_from_flags
from api.serializers import UserSerializer
from .permissions_view import IsOwner


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsOwner]


class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "token": token.key,
                "user_id": user.pk,
                "username": user.username,
                "role": user.role,
                "is_superuser": user.is_superuser,
            }
        )


def build_permissions(user):
    permission_fields = StaffPermission.PERMISSION_FIELDS
    if user.is_superuser or user.role == User.ROLE_OWNER:
        return {
            "manage_users": True,
            "manage_settings": True,
            "manage_feature_flags": True,
            "view_audit_logs": True,
            "manage_inventory": True,
            "manage_sessions": True,
            "view_analytics": True,
            **{permission: True for permission in permission_fields},
        }

    if user.role == User.ROLE_STAFF:
        try:
            perms = user.staff_permissions
            granular = {
                permission: getattr(perms, permission)
                for permission in permission_fields
            }
        except StaffPermission.DoesNotExist:
            granular = {permission: False for permission in permission_fields}

        return {
            "manage_users": False,
            "manage_settings": False,
            "manage_feature_flags": False,
            "view_audit_logs": granular["can_view_audit_logs"],
            "manage_inventory": granular["can_manage_inventory"],
            "manage_sessions": any([
                granular["can_start_session"], granular["can_end_session"],
                granular["can_pause_session"], granular["can_resume_session"],
                granular["can_add_session_order"],
                granular["can_remove_session_order"],
            ]),
            "view_analytics": False,
            **granular,
        }

    return {
        "manage_users": False,
        "manage_settings": False,
        "manage_feature_flags": False,
        "view_audit_logs": False,
        "manage_inventory": False,
        "manage_sessions": False,
        "view_analytics": False,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user_profile(request):
    user = request.user
    permissions = build_permissions(user)

    flags = FeatureFlag.objects.all()
    feature_flags = {flag.key: flag.enabled for flag in flags}

    shop_name = _shop_name_from_flags()

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_superuser": user.is_superuser,
            "permissions": permissions,
            "features": feature_flags,
            "shop_name": shop_name,
        }
    )
