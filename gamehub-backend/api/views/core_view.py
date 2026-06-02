from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.currency import get_currency_settings
from api.models import MonthlyExpense, MonthlyExpenseSettings, FeatureFlag
from api.serializers import (
    CurrencySettingsSerializer,
    FeatureFlagSerializer,
    MonthlyExpenseSerializer,
    MonthlyExpenseSettingsSerializer,
    MoneyConversionSerializer,
)
from .permissions_view import IsOwner

class FeatureFlagViewSet(viewsets.ModelViewSet):
    queryset = FeatureFlag.objects.all()
    serializer_class = FeatureFlagSerializer
    permission_classes = [IsOwner]


class CurrencySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [IsOwner()]
        return super().get_permissions()

    def get(self, request):
        settings = get_currency_settings()
        return Response(CurrencySettingsSerializer(settings).data)

    def patch(self, request):
        settings = get_currency_settings()
        serializer = CurrencySettingsSerializer(
            settings, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        settings = get_currency_settings()
        serializer = CurrencySettingsSerializer(settings, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MonthlyExpenseSettingsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        settings = MonthlyExpenseSettings.get_solo()
        return Response(MonthlyExpenseSettingsSerializer(settings).data)

    def patch(self, request):
        settings = MonthlyExpenseSettings.get_solo()
        serializer = MonthlyExpenseSettingsSerializer(
            settings, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        settings = MonthlyExpenseSettings.get_solo()
        serializer = MonthlyExpenseSettingsSerializer(settings, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MonthlyExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = MonthlyExpenseSerializer
    permission_classes = [IsOwner]
    queryset = MonthlyExpense.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        month = self.request.query_params.get("month")
        if month:
            parsed = parse_date(f"{month}-01") if len(month) == 7 else parse_date(month)
            if parsed:
                queryset = queryset.filter(month=parsed.replace(day=1))
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        month = serializer.validated_data["month"]
        obj, _ = MonthlyExpense.objects.update_or_create(
            month=month,
            defaults={
                key: serializer.validated_data.get(key, getattr(MonthlyExpense(), key))
                for key in [
                    "electricity",
                    "internet",
                    "rent",
                    "salaries",
                    "maintenance",
                    "other",
                    "notes",
                ]
            },
        )
        return Response(self.get_serializer(obj).data, status=status.HTTP_200_OK)


class MoneyConversionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        settings = get_currency_settings()
        serializer = MoneyConversionSerializer(
            data=request.data,
            context={"currency_settings": settings},
        )
        serializer.is_valid(raise_exception=True)
        try:
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DjangoValidationError as exc:
            return Response({"error": exc.message}, status=status.HTTP_400_BAD_REQUEST)
