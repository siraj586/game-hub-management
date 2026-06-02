from decimal import Decimal
from django.db import models
from .users_model import User
from .inventory_model import InventoryItem

class Sale(models.Model):
    user = models.ForeignKey(User, related_name="sales", on_delete=models.PROTECT)

    timestamp = models.DateTimeField(auto_now_add=True)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def profit(self):
        return self.total_price - self.total_cost

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"Direct Sale {self.id} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, related_name="items", on_delete=models.CASCADE)
    inventory_item = models.ForeignKey(
        InventoryItem, on_delete=models.SET_NULL, null=True, blank=True
    )
    item_name = models.CharField(max_length=150)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        self.total_price = Decimal(str(self.unit_price)) * Decimal(str(self.quantity))
        super().save(*args, **kwargs)
