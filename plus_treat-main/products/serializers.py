from decimal import Decimal

from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = (
            "id",
            "sku",
            "name",
            "description",
            "unit_price",
            "stock_quantity",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class StockUpdateSerializer(serializers.Serializer):
    quantity_change = serializers.DecimalField(max_digits=12, decimal_places=2)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate_quantity_change(self, value: Decimal) -> Decimal:
        if value == Decimal("0"):
            raise serializers.ValidationError("quantity_change cannot be 0.")
        return value

