from django.db import models

class ResourceType(models.Model):
    PRICING_HOURLY = "HOURLY"
    PRICING_FIXED = "FIXED"
    PRICING_PER_GAME = "PER_GAME"

    PRICING_STRATEGIES = (
        (PRICING_HOURLY, "Hourly"),
        (PRICING_FIXED, "Fixed"),
        (PRICING_PER_GAME, "Per Game"),
    )

    name = models.CharField(max_length=120)
    code = models.CharField(max_length=30, unique=True)
    prefix = models.CharField(max_length=10)
    pricing_strategy = models.CharField(
        max_length=20, choices=PRICING_STRATEGIES, default=PRICING_HOURLY
    )
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class ResourceUnit(models.Model):
    STATUS_ACTIVE = "ACTIVE"
    STATUS_STOPPED = "STOPPED"
    STATUS_AVAILABLE = STATUS_ACTIVE
    STATUS_MAINTENANCE = STATUS_STOPPED
    STATUS_DISABLED = STATUS_STOPPED

    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Working"),
        (STATUS_STOPPED, "Stopped"),
    )

    resource_type = models.ForeignKey(
        ResourceType, related_name="units", on_delete=models.PROTECT
    )
    code = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE
    )
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.display_name or self.code
