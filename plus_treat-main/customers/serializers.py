from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = (
            "id",
            "date",
            "customer_code",
            "name",
            "customer_category",
            "pricing_category",
            "phone",
            "email",
            "address",
            "previous_balance",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
