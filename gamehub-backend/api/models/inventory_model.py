from django.db import models

class InventoryCategory(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class InventoryItem(models.Model):
    category = models.ForeignKey(
        InventoryCategory, related_name="items", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=50, blank=True)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    original_price_currency = models.CharField(max_length=3, blank=True, default="USD")
    original_price_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )
    original_cost_currency = models.CharField(max_length=3, blank=True, default="USD")
    original_cost_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )
    quantity_in_stock = models.PositiveIntegerField(default=0)
    minimum_stock_level = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["category__name", "name"]

    def __str__(self):
        return self.name
