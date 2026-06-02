from django.contrib import admin
from django.utils.html import format_html

from .models import (
    FeatureFlag,
    CurrencySettings,
    MonthlyExpense,
    MonthlyExpenseSettings,
    InventoryCategory,
    InventoryItem,
    ResourceType,
    ResourceUnit,
    Session,
    SessionOrder,
    User,
    StaffPermission,
)


@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser")
    search_fields = ("username", "email")


@admin.register(StaffPermission)
class StaffPermissionAdmin(admin.ModelAdmin):
    list_display = ("user", "can_start_session", "can_manage_inventory")
    search_fields = ("user__username",)


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ("key", "enabled")
    list_filter = ("enabled",)
    search_fields = ("key",)


@admin.register(CurrencySettings)
class CurrencySettingsAdmin(admin.ModelAdmin):
    list_display = (
        "base_currency_code",
        "local_currency_enabled",
        "local_currency_code",
        "local_currency_name",
        "local_units_per_usd",
        "updated_at",
    )


@admin.register(MonthlyExpenseSettings)
class MonthlyExpenseSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "electricity",
        "internet",
        "rent",
        "salaries",
        "maintenance",
        "other",
        "updated_at",
    )


@admin.register(MonthlyExpense)
class MonthlyExpenseAdmin(admin.ModelAdmin):
    list_display = ("month", "electricity", "internet", "rent", "salaries", "maintenance", "other")
    search_fields = ("notes",)


@admin.register(ResourceType)
class ResourceTypeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "prefix",
        "pricing_strategy",
        "base_price",
        "is_active",
    )
    list_filter = ("pricing_strategy", "is_active")
    search_fields = ("name", "code", "prefix")


@admin.register(ResourceUnit)
class ResourceUnitAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "display_name",
        "resource_type",
        "status",
        "is_active",
    )
    list_filter = ("resource_type", "status", "is_active")
    search_fields = ("code", "display_name")


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "code")
    search_fields = ("name", "code")


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "sale_price",
        "quantity_in_stock",
        "minimum_stock_level",
        "is_active",
    )
    list_filter = ("category", "is_active")
    search_fields = ("name", "sku")


class SessionOrderInline(admin.TabularInline):
    model = SessionOrder
    extra = 0
    readonly_fields = ("timestamp", "total_price")


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = (
        "customer_name",
        "resource_unit",
        "session_type",
        "get_status",
        "start_time",
        "get_total_cost_display",
    )
    list_filter = ("session_type", "is_paused", "end_time", "start_time")
    search_fields = ("customer_name", "resource_unit__code")
    inlines = [SessionOrderInline]
    readonly_fields = ("get_total_cost_display", "get_active_duration_display")

    def get_status(self, obj):
        if obj.end_time:
            return format_html('<span style="color: grey;">🏁 Completed</span>')
        if obj.is_paused:
            return format_html('<span style="color: orange;">⏸️ Paused</span>')
        return format_html('<span style="color: green;">⚡ Active</span>')

    get_status.short_description = "Status"

    def get_total_cost_display(self, obj):
        return format_html("<b>${}</b>", f"{obj.get_live_cost():.2f}")

    get_total_cost_display.short_description = "Total Cost (Live)"

    def get_active_duration_display(self, obj):
        minutes = int((obj.get_active_ms() / (1000 * 60)) % 60)
        hours = int(obj.get_active_ms() / (1000 * 60 * 60))
        return f"{hours}h {minutes}m"

    get_active_duration_display.short_description = "Active Duration"

