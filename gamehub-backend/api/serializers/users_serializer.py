from rest_framework import serializers
from api.models import User, StaffPermission


class StaffPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffPermission
        fields = StaffPermission.PERMISSION_FIELDS


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    is_superuser = serializers.BooleanField(read_only=True)
    permissions = StaffPermissionSerializer(source="staff_permissions", required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "role",
            "email",
            "is_active",
            "is_superuser",
            "permissions",
        ]
        read_only_fields = ["id", "is_superuser"]

    def validate_role(self, value):
        allowed_roles = {
            User.ROLE_OWNER,
            User.ROLE_STAFF,
        }
        if value not in allowed_roles:
            raise serializers.ValidationError("Invalid role.")
        return value

    def create(self, validated_data):
        permissions_data = validated_data.pop("staff_permissions", None)
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "This field is required."})

        instance = User(**validated_data)
        instance.set_password(password)
        instance.save()

        if instance.role == User.ROLE_STAFF:
            StaffPermission.objects.update_or_create(
                user=instance,
                defaults=permissions_data or {}
            )
        return instance

    def update(self, instance, validated_data):
        permissions_data = validated_data.pop("staff_permissions", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if instance.role == User.ROLE_STAFF:
            StaffPermission.objects.update_or_create(
                user=instance,
                defaults=permissions_data or {}
            )
        else:
            StaffPermission.objects.filter(user=instance).delete()

        return instance
