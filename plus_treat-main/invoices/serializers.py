from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from products.models import Product

from .models import Invoice, InvoiceItem, Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "amount", "payment_date", "method", "reference", "notes", "created_at")
        read_only_fields = ("id", "created_at")


class InvoiceItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source="product",
        queryset=Product.objects.filter(is_active=True),
        allow_null=True,
        required=False,
        write_only=True,
    )
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = InvoiceItem
        fields = (
            "id",
            "product_id",
            "product_name",
            "description",
            "unit_price",
            "quantity",
            "line_total",
        )
        read_only_fields = ("id", "line_total", "product_name")

    def validate(self, attrs):
        product = attrs.get("product")
        description = attrs.get("description")
        unit_price = attrs.get("unit_price")

        if not description and not product:
            raise serializers.ValidationError("Either description or product_id is required.")
        if unit_price is None and product is None:
            raise serializers.ValidationError("unit_price is required when product_id is not supplied.")
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    staff_name = serializers.CharField(source="staff.user.get_full_name", read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "invoice_number",
            "invoice_date",
            "customer",
            "customer_name",
            "staff",
            "staff_name",
            "subtotal",
            "discount_amount",
            "total_amount",
            "previous_balance",
            "outstanding_balance",
            "status",
            "notes",
            "items",
            "payments",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "subtotal", "total_amount", "outstanding_balance", "created_at", "updated_at")

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        invoice = Invoice.objects.create(**validated_data)

        subtotal = Decimal("0.00")
        for item_data in items_data:
            product = item_data.get("product")
            quantity = Decimal(item_data["quantity"])
            unit_price = item_data.get("unit_price")
            description = item_data.get("description")

            if product:
                if not description:
                    description = product.name
                if unit_price is None:
                    unit_price = product.unit_price
                if product.stock_quantity < quantity:
                    raise serializers.ValidationError(
                        {"items": [f"Insufficient stock for product '{product.name}'."]}
                    )
                product.adjust_stock(-quantity)
                product.save(update_fields=["stock_quantity", "updated_at"])

            line_total = Decimal(unit_price) * quantity
            InvoiceItem.objects.create(
                invoice=invoice,
                product=product,
                description=description,
                unit_price=unit_price,
                quantity=quantity,
                line_total=line_total,
            )
            subtotal += line_total

        invoice.subtotal = subtotal
        discounted_total = invoice.subtotal - invoice.discount_amount
        invoice.total_amount = discounted_total if discounted_total > 0 else Decimal("0.00")
        invoice.outstanding_balance = invoice.previous_balance + invoice.total_amount
        invoice.save(update_fields=["subtotal", "total_amount", "outstanding_balance", "updated_at"])
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        if "items" in validated_data:
            raise serializers.ValidationError(
                {"items": ["Updating invoice line items is not supported. Create a new invoice instead."]}
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.recalculate_totals()
        instance.save()
        return instance
