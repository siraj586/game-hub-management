from rest_framework import serializers
from api.models import ResourceType, ResourceUnit

class ResourceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceType
        fields = "__all__"

class ResourceUnitSerializer(serializers.ModelSerializer):
    resource_type_name = serializers.CharField(
        source="resource_type.name", read_only=True
    )
    is_stopped = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = ResourceUnit
        fields = [
            "id",
            "resource_type",
            "resource_type_name",
            "code",
            "display_name",
            "status",
            "is_stopped",
            "status_label",
            "metadata",
            "is_active",
        ]

    def get_is_stopped(self, obj):
        return obj.status != ResourceUnit.STATUS_ACTIVE

    def get_status_label(self, obj):
        return "Working" if obj.status == ResourceUnit.STATUS_ACTIVE else "Stopped"
