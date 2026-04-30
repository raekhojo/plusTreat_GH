from django.db import models
from rest_framework import viewsets

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search)
                | models.Q(phone__icontains=search)
                | models.Q(customer_code__icontains=search)
            )

        customer_category = params.get("customer_category")
        if customer_category:
            queryset = queryset.filter(customer_category__iexact=customer_category)

        pricing_category = params.get("pricing_category")
        if pricing_category:
            queryset = queryset.filter(pricing_category__iexact=pricing_category)

        customer_code = params.get("customer_code")
        if customer_code:
            queryset = queryset.filter(customer_code__iexact=customer_code)

        return queryset
