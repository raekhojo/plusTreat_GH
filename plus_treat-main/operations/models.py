from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class Supplier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier_code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=255)
    item_category = models.CharField(max_length=100, blank=True)
    delivery_package = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class RawMaterial(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="materials")
    unit_per_item = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("1.000"))
    item_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    unit = models.CharField(max_length=50, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0.0000"))
    opening_stock = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    stock_in = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    stock_out = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    reorder_level = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.item_code})"

    @property
    def stock_available(self) -> Decimal:
        return self.opening_stock + self.stock_in - self.stock_out

    def adjust_stock_in(self, qty: Decimal) -> None:
        self.stock_in += Decimal(qty)

    def adjust_stock_out(self, qty: Decimal) -> None:
        qty = Decimal(qty)
        if self.stock_available - qty < 0:
            raise ValidationError(f"Insufficient stock for raw material '{self.name}'.")
        self.stock_out += qty


class Purchase(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_id = models.CharField(max_length=50, unique=True)
    purchase_date = models.DateField(default=timezone.now)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchases")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    outstanding_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-purchase_date", "-created_at"]

    def __str__(self) -> str:
        return self.purchase_id

    def recalculate_totals(self) -> None:
        line_sum = self.items.aggregate(total=Sum("line_total")).get("total") or Decimal("0.00")
        paid_sum = self.payments.aggregate(total=Sum("amount")).get("total") or Decimal("0.00")
        self.total_amount = line_sum
        self.total_paid = paid_sum
        self.outstanding_amount = self.total_amount - self.total_paid
        if self.outstanding_amount <= 0:
            self.status = self.Status.PAID
        elif self.total_paid > 0:
            self.status = self.Status.PARTIALLY_PAID
        elif self.status == self.Status.DRAFT:
            self.status = self.Status.DRAFT
        else:
            self.status = self.Status.OPEN


class PurchaseItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_items")
    item_name = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    price_per_item = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    unit_per_item = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("1.000"))
    price_per_unit = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0.0000"))
    total_units = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.item_name} ({self.quantity})"


class PurchasePayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="payments")
    payment_date = models.DateField(default=timezone.now)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=100)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-id"]


class ProductionBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch_number = models.CharField(max_length=60, unique=True)
    production_date = models.DateField(default=timezone.now)
    notes = models.CharField(max_length=255, blank=True)
    electricity_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    gas_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    production_wages = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_raw_material_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_production_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-production_date", "-created_at"]

    def __str__(self) -> str:
        return self.batch_number

    def recalculate_totals(self) -> None:
        material_total = self.material_usages.aggregate(total=Sum("amount")).get("total") or Decimal("0.00")
        output_total = self.outputs.aggregate(total=Sum("amount")).get("total") or Decimal("0.00")
        self.total_raw_material_cost = material_total
        self.total_production_value = output_total
        self.total_cost = material_total + self.electricity_cost + self.gas_cost + self.production_wages
        self.profit = self.total_production_value - self.total_cost


class ProductionOutput(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name="outputs")
    product = models.ForeignKey("products.Product", on_delete=models.SET_NULL, null=True, blank=True, related_name="production_outputs")
    product_size = models.CharField(max_length=50)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    batch_litres = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))
    total_litres = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0.000"))

    class Meta:
        ordering = ["id"]


class MaterialUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ProductionBatch, on_delete=models.CASCADE, related_name="material_usages")
    raw_material = models.ForeignKey(RawMaterial, on_delete=models.PROTECT, related_name="usages")
    quantity_used = models.DecimalField(max_digits=12, decimal_places=3)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]


class AccountTransaction(models.Model):
    class EntryType(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"
        ASSET = "asset", "Asset"
        LIABILITY = "liability", "Liability"
        EQUITY = "equity", "Equity"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_id = models.CharField(max_length=50, unique=True)
    transaction_date = models.DateField(default=timezone.now)
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    category = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=100, blank=True)
    comments = models.CharField(max_length=255, blank=True)
    production_batch = models.ForeignKey(
        ProductionBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name="account_entries"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-transaction_date", "-id"]


class PricingRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    price_id = models.CharField(max_length=40, unique=True)
    size = models.CharField(max_length=50)
    pricing_category = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["size", "pricing_category"]
        unique_together = ("size", "pricing_category")

    def __str__(self) -> str:
        return f"{self.size} - {self.pricing_category}"
