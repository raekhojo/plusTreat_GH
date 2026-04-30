from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"

    def adjust_stock(self, quantity_change: Decimal) -> None:
        new_stock = self.stock_quantity + Decimal(quantity_change)
        if new_stock < 0:
            raise ValidationError("Insufficient stock for this adjustment.")
        self.stock_quantity = new_stock
