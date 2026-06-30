from decimal import Decimal
from django.db import models
from django.utils import timezone
from .resource_model import ResourceUnit, ResourceType
from .inventory_model import InventoryItem

class Session(models.Model):
    SESSION_PREPAID = "PRE"
    SESSION_POSTPAID = "POST"
    SESSION_TYPES = (
        (SESSION_PREPAID, "Prepaid"),
        (SESSION_POSTPAID, "Postpaid"),
    )

    customer_name = models.CharField(max_length=200)
    resource_unit = models.ForeignKey(
        ResourceUnit, related_name="sessions", on_delete=models.PROTECT
    )

    session_type = models.CharField(
        max_length=4, choices=SESSION_TYPES, default=SESSION_POSTPAID
    )

    custom_price_per_hour = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    fixed_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    prepaid_amount_usd = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    original_payment_currency = models.CharField(max_length=3, blank=True, default="USD")
    original_payment_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    duration_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    start_time = models.DateTimeField(default=timezone.now)
    planned_end_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)

    is_paused = models.BooleanField(default=False)
    last_pause_time = models.DateTimeField(null=True, blank=True)
    total_paused_ms = models.BigIntegerField(default=0)

    final_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    final_duration_minutes = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-start_time"]

    @property
    def pricing_strategy(self):
        return self.resource_unit.resource_type.pricing_strategy

    @property
    def effective_hourly_rate(self) -> Decimal:
        if self.custom_price_per_hour is not None:
            return Decimal(str(self.custom_price_per_hour))
        return Decimal(str(self.resource_unit.resource_type.base_price))

    def get_active_ms(self, ref_time=None):
        ref_time = ref_time or self.end_time or timezone.now()
        paused_ms = self.total_paused_ms

        if self.is_paused and self.last_pause_time and not self.end_time:
            paused_ms += int((ref_time - self.last_pause_time).total_seconds() * 1000)

        total_ms = int((ref_time - self.start_time).total_seconds() * 1000)
        return max(0, total_ms - paused_ms)

    def get_rental_cost(self, ref_time=None) -> Decimal:
        strategy = self.pricing_strategy
        if strategy == ResourceType.PRICING_FIXED:
            return Decimal(
                str(self.fixed_price or self.resource_unit.resource_type.base_price)
            )
        if strategy == ResourceType.PRICING_PER_GAME:
            return Decimal(
                str(self.fixed_price or self.resource_unit.resource_type.base_price)
            )

        # For prepaid sessions, charge only for the purchased duration
        if self.session_type == self.SESSION_PREPAID and self.prepaid_amount_usd is not None:
            return Decimal(str(self.prepaid_amount_usd)).quantize(Decimal("0.01"))

        if self.session_type == self.SESSION_PREPAID and self.duration_hours:
            prepaid_hours = Decimal(str(self.duration_hours))
            return (prepaid_hours * self.effective_hourly_rate).quantize(Decimal("0.01"))

        active_ms = self.get_active_ms(ref_time)
        active_hours = Decimal(active_ms) / Decimal(3600000)
        return (active_hours * self.effective_hourly_rate).quantize(Decimal("0.01"))

    def get_orders_cost(self) -> Decimal:
        return sum((order.total_price for order in self.orders.all()), Decimal("0.00"))

    def get_live_cost(self, ref_time=None) -> Decimal:
        raw_total = (
            self.get_rental_cost(ref_time)
            + self.get_orders_cost()
            - Decimal(str(self.discount))
        )
        return max(Decimal("0.00"), raw_total.quantize(Decimal("0.01")))

    def process_auto_end(self):
        if (
            not self.end_time
            and self.planned_end_time
            and not self.is_paused
            and timezone.now() >= self.planned_end_time
        ):
            self.end_session(ref_time=self.planned_end_time)

    def end_session(self, ref_time=None):
        if self.end_time:
            return

        ref_time = ref_time or timezone.now()
        if self.is_paused and self.last_pause_time:
            self.total_paused_ms += int(
                (ref_time - self.last_pause_time).total_seconds() * 1000
            )
            self.is_paused = False
            self.last_pause_time = None

        active_ms = self.get_active_ms(ref_time)
        self.final_duration_minutes = (Decimal(active_ms) / Decimal(60000)).quantize(
            Decimal("0.01")
        )
        self.final_cost = self.get_live_cost(ref_time)
        self.end_time = ref_time
        self.save()

    def __str__(self):
        return f"{self.customer_name} - {self.resource_unit.code}"

class SessionOrder(models.Model):
    session = models.ForeignKey(
        Session, related_name="orders", on_delete=models.CASCADE
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        related_name="session_orders",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    item_name = models.CharField(max_length=150)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def save(self, *args, **kwargs):
        self.total_price = Decimal(str(self.unit_price)) * Decimal(str(self.quantity))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} x{self.quantity}"
