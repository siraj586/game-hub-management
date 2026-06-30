from django.db import models

class FeatureFlag(models.Model):
    key = models.CharField(max_length=100, unique=True)
    enabled = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key

class CurrencySettings(models.Model):
    BASE_CURRENCY_CODE = "USD"

    local_currency_enabled = models.BooleanField(default=False)
    local_currency_code = models.CharField(max_length=3, blank=True, default="")
    local_currency_name = models.CharField(max_length=50, blank=True, default="")
    local_units_per_usd = models.DecimalField(
        max_digits=18, decimal_places=6, null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Currency settings"
        verbose_name_plural = "Currency settings"

    @property
    def base_currency_code(self):
        return self.BASE_CURRENCY_CODE

    def __str__(self):
        if not self.local_currency_enabled:
            return "USD only"
        return f"1 USD = {self.local_units_per_usd} {self.local_currency_code}"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

class DailyReport(models.Model):
    date = models.DateField(unique=True)
    
    revenue_sessions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    revenue_standalone = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    orders_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    standalone_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Multi-Currency Tills
    actual_usd_received = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_local_received = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    
    net_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active_sessions_at_close = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"Report - {self.date}"


class MonthlyExpenseSettings(models.Model):
    electricity = models.BooleanField(default=False)
    internet = models.BooleanField(default=False)
    rent = models.BooleanField(default=False)
    salaries = models.BooleanField(default=False)
    maintenance = models.BooleanField(default=False)
    other = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Monthly expense settings"
        verbose_name_plural = "Monthly expense settings"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Monthly expense settings"


class MonthlyExpense(models.Model):
    month = models.DateField(unique=True)
    electricity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    internet = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rent = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    salaries = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    maintenance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-month"]

    @property
    def total(self):
        return (
            self.electricity
            + self.internet
            + self.rent
            + self.salaries
            + self.maintenance
            + self.other
        )

    def __str__(self):
        return f"Expenses - {self.month:%Y-%m}"
