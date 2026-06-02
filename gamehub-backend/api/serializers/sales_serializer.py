from rest_framework import serializers
from api.models import Sale, SaleItem

class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = "__all__"

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    payment_method = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "items",
            "username",
            "timestamp",
            "total_price",
            "total_cost",
            "payment_method",
        ]

    def get_payment_method(self, obj):
        return "CASH"
