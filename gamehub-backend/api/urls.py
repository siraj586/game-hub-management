from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalyticsView,
    AuditLogViewSet,
    BulkSetupView,
    CurrencySettingsView,
    FeatureFlagViewSet,
    MonthlyExpenseSettingsView,
    MonthlyExpenseViewSet,
    InventoryCategoryViewSet,
    InventoryItemViewSet,
    ResourceTypeViewSet,
    ResourceUnitViewSet,
    SaleViewSet,
    SessionViewSet,
    UserViewSet,
    MoneyConversionView,
    CustomObtainAuthToken,
    current_user_profile,
)
from .views.auth_view import bootstrap_register, bootstrap_status

router = DefaultRouter()
router.register(r"feature-flags", FeatureFlagViewSet, basename="feature-flag")
router.register(r"monthly-expenses", MonthlyExpenseViewSet, basename="monthly-expense")
router.register(r"resource-types", ResourceTypeViewSet, basename="resource-type")
router.register(r"resource-units", ResourceUnitViewSet, basename="resource-unit")
router.register(
    r"inventory-categories", InventoryCategoryViewSet, basename="inventory-category"
)
router.register(r"inventory-items", InventoryItemViewSet, basename="inventory-item")
router.register(r"sessions", SessionViewSet, basename="session")
router.register(r"sales", SaleViewSet, basename="sale")
router.register(r"audit-logs", AuditLogViewSet, basename="audit-log")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/", CustomObtainAuthToken.as_view(), name="auth-login"),
    path("auth/bootstrap/status/", bootstrap_status, name="auth-bootstrap-status"),
    path("auth/bootstrap/register/", bootstrap_register, name="auth-bootstrap-register"),
    path("auth/me/", current_user_profile, name="auth-me"),
    path("setup/bulk/", BulkSetupView.as_view(), name="bulk-setup"),
    path("analytics/", AnalyticsView.as_view(), name="analytics"),
    path("currency-settings/", CurrencySettingsView.as_view(), name="currency-settings"),
    path("currency-settings/convert/", MoneyConversionView.as_view(), name="currency-convert"),
    path("monthly-expense-settings/", MonthlyExpenseSettingsView.as_view(), name="monthly-expense-settings"),
    path("", include(router.urls)),
]
