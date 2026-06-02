from rest_framework import serializers
from api.models.core_model import DailyReport

class DailyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyReport
        fields = [
            "id",
            "date",
            "revenue_sessions",
            "revenue_standalone",
            "total_revenue",
            "orders_cost",
            "standalone_cost",
            "total_cost",
            "net_profit",
            "active_sessions_at_close",
            "created_at",
            "metadata",
        ]
