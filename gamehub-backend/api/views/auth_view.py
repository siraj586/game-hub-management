from django.db import transaction
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.models import FeatureFlag, User


def _shop_name_from_flags():
    flag = FeatureFlag.objects.filter(key="shop_name").first()
    if flag and isinstance(flag.config, dict):
        return flag.config.get("name") or ""
    return ""


def _set_shop_name(name):
    FeatureFlag.objects.update_or_create(
        key="shop_name",
        defaults={
            "enabled": True,
            "config": {"name": (name or "").strip() or "GameHub Pro"},
        },
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def bootstrap_status(request):
    has_owner = User.objects.filter(role=User.ROLE_OWNER).exists()
    return Response(
        {
            "needs_setup": not has_owner,
            "has_owner": has_owner,
            "shop_name": _shop_name_from_flags() if has_owner else "",
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@transaction.atomic
def bootstrap_register(request):
    if User.objects.filter(role=User.ROLE_OWNER).exists():
        return Response(
            {"error": "تم إعداد النظام مسبقاً. سجّل الدخول بحساب المالك."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    email = (request.data.get("email") or "").strip()
    shop_name = (request.data.get("shop_name") or "").strip()

    if not username:
        return Response(
            {"error": "اسم المستخدم مطلوب."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(password) < 6:
        return Response(
            {"error": "كلمة المرور يجب أن تكون 6 أحرف على الأقل."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects.filter(username__iexact=username).exists():
        return Response(
            {"error": "اسم المستخدم مستخدم بالفعل."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        role=User.ROLE_OWNER,
    )
    _set_shop_name(shop_name or "GameHub Pro")

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user_id": user.pk,
            "username": user.username,
            "role": user.role,
            "is_superuser": user.is_superuser,
            "shop_name": _shop_name_from_flags(),
        },
        status=status.HTTP_201_CREATED,
    )
