from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from products.models import Product

from .models import (
    AccountTransaction,
    MaterialUsage,
    ProductionBatch,
    ProductionOutput,
    PricingRule,
    Purchase,
    PurchaseItem,
    PurchasePayment,
    RawMaterial,
    Supplier,
)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class RawMaterialSerializer(serializers.ModelSerializer):
    stock_available = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)

    class Meta:
        model = RawMaterial
        fields = (
            "id",
            "item_code",
            "name",
            "category",
            "supplier",
            "unit_per_item",
            "item_price",
            "unit",
            "unit_price",
            "opening_stock",
            "stock_in",
            "stock_out",
            "stock_available",
            "reorder_level",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PurchaseItemSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source="raw_material.name", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = (
            "id",
            "raw_material",
            "raw_material_name",
            "item_name",
            "quantity",
            "price_per_item",
            "unit_per_item",
            "price_per_unit",
            "total_units",
            "line_total",
        )
        read_only_fields = ("id", "line_total", "total_units", "raw_material_name")


class PurchasePaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchasePayment
        fields = ("id", "purchase", "payment_date", "amount", "payment_method", "notes", "created_at")
        read_only_fields = ("id", "created_at")


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    payments = PurchasePaymentSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Purchase
        fields = (
            "id",
            "purchase_id",
            "purchase_date",
            "supplier",
            "supplier_name",
            "total_amount",
            "total_paid",
            "outstanding_amount",
            "status",
            "notes",
            "items",
            "payments",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "total_amount", "total_paid", "outstanding_amount", "created_at", "updated_at")

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        purchase = Purchase.objects.create(**validated_data)

        for item_data in items_data:
            raw_material = item_data.get("raw_material")
            item_name = item_data.get("item_name")
            quantity = Decimal(item_data["quantity"])
            unit_per_item = Decimal(item_data.get("unit_per_item") or Decimal("1.000"))
            price_per_item = Decimal(item_data["price_per_item"])
            price_per_unit = item_data.get("price_per_unit")

            if raw_material and not item_name:
                item_name = raw_material.name
            if price_per_unit is None:
                if unit_per_item == 0:
                    raise serializers.ValidationError({"items": ["unit_per_item cannot be zero."]})
                price_per_unit = price_per_item / unit_per_item

            total_units = quantity * unit_per_item
            line_total = quantity * price_per_item

            PurchaseItem.objects.create(
                purchase=purchase,
                raw_material=raw_material,
                item_name=item_name,
                quantity=quantity,
                price_per_item=price_per_item,
                unit_per_item=unit_per_item,
                price_per_unit=price_per_unit,
                total_units=total_units,
                line_total=line_total,
            )

            if raw_material:
                raw_material.adjust_stock_in(total_units)
                raw_material.save(update_fields=["stock_in", "updated_at"])

        purchase.recalculate_totals()
        purchase.save(update_fields=["total_amount", "total_paid", "outstanding_amount", "status", "updated_at"])
        return purchase

    @transaction.atomic
    def update(self, instance, validated_data):
        if "items" in validated_data:
            raise serializers.ValidationError(
                {"items": ["Updating purchase items is not supported. Create a new purchase instead."]}
            )
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.recalculate_totals()
        instance.save()
        return instance


class MaterialUsageSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source="raw_material.name", read_only=True)

    class Meta:
        model = MaterialUsage
        fields = ("id", "raw_material", "raw_material_name", "quantity_used", "amount", "notes")
        read_only_fields = ("id", "raw_material_name")


class ProductionOutputSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = ProductionOutput
        fields = (
            "id",
            "product",
            "product_name",
            "product_size",
            "quantity",
            "unit_cost",
            "amount",
            "batch_litres",
            "total_litres",
        )
        read_only_fields = ("id", "amount", "product_name")


class ProductionBatchSerializer(serializers.ModelSerializer):
    outputs = ProductionOutputSerializer(many=True)
    material_usages = MaterialUsageSerializer(many=True)

    class Meta:
        model = ProductionBatch
        fields = (
            "id",
            "batch_number",
            "production_date",
            "notes",
            "electricity_cost",
            "gas_cost",
            "production_wages",
            "total_raw_material_cost",
            "total_cost",
            "total_production_value",
            "profit",
            "outputs",
            "material_usages",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "total_raw_material_cost",
            "total_cost",
            "total_production_value",
            "profit",
            "created_at",
            "updated_at",
        )

    @transaction.atomic
    def create(self, validated_data):
        outputs_data = validated_data.pop("outputs")
        usages_data = validated_data.pop("material_usages")
        batch = ProductionBatch.objects.create(**validated_data)

        for usage_data in usages_data:
            material = usage_data["raw_material"]
            qty_used = Decimal(usage_data["quantity_used"])
            amount = usage_data.get("amount")
            if amount is None:
                amount = qty_used * material.unit_price

            try:
                material.adjust_stock_out(qty_used)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"material_usages": [str(exc)]}) from exc
            material.save(update_fields=["stock_out", "updated_at"])

            MaterialUsage.objects.create(
                batch=batch,
                raw_material=material,
                quantity_used=qty_used,
                amount=amount,
                notes=usage_data.get("notes", ""),
            )

        for output_data in outputs_data:
            product = output_data.get("product")
            quantity = Decimal(output_data["quantity"])
            unit_cost = Decimal(output_data["unit_cost"])
            amount = quantity * unit_cost

            ProductionOutput.objects.create(
                batch=batch,
                product=product,
                product_size=output_data["product_size"],
                quantity=quantity,
                unit_cost=unit_cost,
                amount=amount,
                batch_litres=Decimal(output_data.get("batch_litres") or Decimal("0.000")),
                total_litres=Decimal(output_data.get("total_litres") or Decimal("0.000")),
            )

            if product:
                product.adjust_stock(quantity)
                product.save(update_fields=["stock_quantity", "updated_at"])

        batch.recalculate_totals()
        batch.save(
            update_fields=[
                "total_raw_material_cost",
                "total_cost",
                "total_production_value",
                "profit",
                "updated_at",
            ]
        )
        return batch


class AccountTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountTransaction
        fields = "__all__"
        read_only_fields = ("id", "created_at")


class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")
