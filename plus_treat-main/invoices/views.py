from django.utils.dateparse import parse_date
from rest_framework import viewsets

from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("customer", "staff").prefetch_related("items", "payments")
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        customer_id = params.get("customer")
        staff_id = params.get("staff")
        start_date = parse_date(params.get("start_date", ""))
        end_date = parse_date(params.get("end_date", ""))
        status = params.get("status")

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if staff_id:
            queryset = queryset.filter(staff_id=staff_id)
        if start_date:
            queryset = queryset.filter(invoice_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(invoice_date__lte=end_date)
        if status:
            queryset = queryset.filter(status=status)

        return queryset


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice")
    serializer_class = PaymentSerializer

    def perform_create(self, serializer):
        payment = serializer.save()
        invoice = payment.invoice
        invoice.recalculate_totals()
        invoice.save(update_fields=["subtotal", "total_amount", "outstanding_balance", "updated_at"])

    def perform_update(self, serializer):
        payment = serializer.save()
        invoice = payment.invoice
        invoice.recalculate_totals()
        invoice.save(update_fields=["subtotal", "total_amount", "outstanding_balance", "updated_at"])

    def perform_destroy(self, instance):
        invoice = instance.invoice
        instance.delete()
        invoice.recalculate_totals()
        invoice.save(update_fields=["subtotal", "total_amount", "outstanding_balance", "updated_at"])
