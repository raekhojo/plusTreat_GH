# Generated manually for the coding task.
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductionBatch",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("batch_number", models.CharField(max_length=60, unique=True)),
                ("production_date", models.DateField(default=django.utils.timezone.now)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("electricity_cost", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("gas_cost", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("production_wages", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_raw_material_cost", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_cost", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_production_value", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("profit", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-production_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="Supplier",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("supplier_code", models.CharField(max_length=40, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("item_category", models.CharField(blank=True, max_length=100)),
                ("delivery_package", models.CharField(blank=True, max_length=100)),
                ("phone", models.CharField(blank=True, max_length=50)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="RawMaterial",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("item_code", models.CharField(max_length=40, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("category", models.CharField(blank=True, max_length=100)),
                ("unit_per_item", models.DecimalField(decimal_places=3, default=1, max_digits=12)),
                ("item_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("unit", models.CharField(blank=True, max_length=50)),
                ("unit_price", models.DecimalField(decimal_places=4, default=0, max_digits=12)),
                ("opening_stock", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("stock_in", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("stock_out", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("reorder_level", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "supplier",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="materials", to="operations.supplier"),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Purchase",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("purchase_id", models.CharField(max_length=50, unique=True)),
                ("purchase_date", models.DateField(default=django.utils.timezone.now)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_paid", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("outstanding_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Draft"), ("open", "Open"), ("partially_paid", "Partially Paid"), ("paid", "Paid")],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("supplier", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="purchases", to="operations.supplier")),
            ],
            options={"ordering": ["-purchase_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="ProductionOutput",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("product_size", models.CharField(max_length=50)),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=12)),
                ("unit_cost", models.DecimalField(decimal_places=2, max_digits=12)),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("batch_litres", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("total_litres", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("batch", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="outputs", to="operations.productionbatch")),
                (
                    "product",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="production_outputs",
                        to="products.product",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="PurchasePayment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("payment_date", models.DateField(default=django.utils.timezone.now)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(max_length=100)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("purchase", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="operations.purchase")),
            ],
            options={"ordering": ["-payment_date", "-id"]},
        ),
        migrations.CreateModel(
            name="PurchaseItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("item_name", models.CharField(max_length=255)),
                ("quantity", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("price_per_item", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("unit_per_item", models.DecimalField(decimal_places=3, default=1, max_digits=12)),
                ("price_per_unit", models.DecimalField(decimal_places=4, default=0, max_digits=12)),
                ("total_units", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("line_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("purchase", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="operations.purchase")),
                (
                    "raw_material",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="purchase_items",
                        to="operations.rawmaterial",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="MaterialUsage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("quantity_used", models.DecimalField(decimal_places=3, max_digits=12)),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("notes", models.CharField(blank=True, max_length=255)),
                ("batch", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="material_usages", to="operations.productionbatch")),
                ("raw_material", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="usages", to="operations.rawmaterial")),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="AccountTransaction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("transaction_id", models.CharField(max_length=50, unique=True)),
                ("transaction_date", models.DateField(default=django.utils.timezone.now)),
                (
                    "entry_type",
                    models.CharField(
                        choices=[
                            ("income", "Income"),
                            ("expense", "Expense"),
                            ("asset", "Asset"),
                            ("liability", "Liability"),
                            ("equity", "Equity"),
                        ],
                        max_length=20,
                    ),
                ),
                ("category", models.CharField(max_length=100)),
                ("description", models.CharField(max_length=255)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(blank=True, max_length=100)),
                ("comments", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "production_batch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="account_entries",
                        to="operations.productionbatch",
                    ),
                ),
            ],
            options={"ordering": ["-transaction_date", "-id"]},
        ),
        migrations.CreateModel(
            name="PricingRule",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("price_id", models.CharField(max_length=40, unique=True)),
                ("size", models.CharField(max_length=50)),
                ("pricing_category", models.CharField(max_length=100)),
                ("price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["size", "pricing_category"], "unique_together": {("size", "pricing_category")}},
        ),
    ]
