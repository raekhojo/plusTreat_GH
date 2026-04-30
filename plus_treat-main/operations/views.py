from collections import defaultdict
from decimal import Decimal

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from invoices.models import Invoice
from products.models import Product

from .models import (
    AccountTransaction,
    ProductionBatch,
    PricingRule,
    Purchase,
    PurchasePayment,
    RawMaterial,
    Supplier,
)
from .serializers import (
    AccountTransactionSerializer,
    ProductionBatchSerializer,
    PricingRuleSerializer,
    PurchasePaymentSerializer,
    PurchaseSerializer,
    RawMaterialSerializer,
    SupplierSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class RawMaterialViewSet(viewsets.ModelViewSet):
    queryset = RawMaterial.objects.select_related("supplier").all()
    serializer_class = RawMaterialSerializer


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related("supplier").prefetch_related("items", "payments")
    serializer_class = PurchaseSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        supplier = params.get("supplier")
        start_date = parse_date(params.get("start_date", ""))
        end_date = parse_date(params.get("end_date", ""))
        status = params.get("status")

        if supplier:
            queryset = queryset.filter(supplier_id=supplier)
        if start_date:
            queryset = queryset.filter(purchase_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(purchase_date__lte=end_date)
        if status:
            queryset = queryset.filter(status=status)
        return queryset


class PurchasePaymentViewSet(viewsets.ModelViewSet):
    queryset = PurchasePayment.objects.select_related("purchase")
    serializer_class = PurchasePaymentSerializer

    def perform_create(self, serializer):
        payment = serializer.save()
        purchase = payment.purchase
        purchase.recalculate_totals()
        purchase.save(update_fields=["total_amount", "total_paid", "outstanding_amount", "status", "updated_at"])

    def perform_update(self, serializer):
        payment = serializer.save()
        purchase = payment.purchase
        purchase.recalculate_totals()
        purchase.save(update_fields=["total_amount", "total_paid", "outstanding_amount", "status", "updated_at"])

    def perform_destroy(self, instance):
        purchase = instance.purchase
        instance.delete()
        purchase.recalculate_totals()
        purchase.save(update_fields=["total_amount", "total_paid", "outstanding_amount", "status", "updated_at"])


class ProductionBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductionBatch.objects.prefetch_related("outputs", "material_usages")
    serializer_class = ProductionBatchSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        start_date = parse_date(params.get("start_date", ""))
        end_date = parse_date(params.get("end_date", ""))
        if start_date:
            queryset = queryset.filter(production_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(production_date__lte=end_date)
        return queryset


class AccountTransactionViewSet(viewsets.ModelViewSet):
    queryset = AccountTransaction.objects.select_related("production_batch")
    serializer_class = AccountTransactionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        entry_type = params.get("entry_type")
        category = params.get("category")
        start_date = parse_date(params.get("start_date", ""))
        end_date = parse_date(params.get("end_date", ""))
        if entry_type:
            queryset = queryset.filter(entry_type=entry_type)
        if category:
            queryset = queryset.filter(category=category)
        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)
        return queryset


class PricingRuleViewSet(viewsets.ModelViewSet):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer


class DashboardOverviewView(APIView):
    def get(self, request):
        today = timezone.now().date()
        year_start = today.replace(month=1, day=1)

        ytd_invoices = list(
            Invoice.objects.select_related("customer").prefetch_related("items").filter(
                invoice_date__gte=year_start,
                invoice_date__lte=today,
            )
        )
        open_invoices = list(
            Invoice.objects.select_related("customer")
            .filter(outstanding_balance__gt=0)
            .order_by("-outstanding_balance", "-invoice_date", "-created_at")
        )
        ytd_batches = list(
            ProductionBatch.objects.filter(
                production_date__gte=year_start,
                production_date__lte=today,
            )
        )
        raw_materials = list(RawMaterial.objects.all())
        products = list(Product.objects.all())
        ytd_account_entries = list(
            AccountTransaction.objects.filter(
                transaction_date__gte=year_start,
                transaction_date__lte=today,
            )
        )

        total_sales = sum((invoice.total_amount for invoice in ytd_invoices), Decimal("0.00"))
        outstanding_receivables = sum(
            (invoice.outstanding_balance for invoice in open_invoices),
            Decimal("0.00"),
        )
        total_cost = sum((batch.total_cost for batch in ytd_batches), Decimal("0.00"))
        profit_loss = total_sales - total_cost
        expense_total = sum(
            (entry.amount for entry in ytd_account_entries if entry.entry_type == AccountTransaction.EntryType.EXPENSE),
            Decimal("0.00"),
        )
        cash_collected = sum(
            ((invoice.total_amount or Decimal("0.00")) - (invoice.outstanding_balance or Decimal("0.00")) for invoice in ytd_invoices),
            Decimal("0.00"),
        )

        customer_totals = defaultdict(lambda: Decimal("0.00"))
        customer_outstanding = defaultdict(lambda: Decimal("0.00"))
        product_totals = defaultdict(lambda: {"quantity": Decimal("0.00"), "amount": Decimal("0.00")})
        product_qty_sold = defaultdict(lambda: Decimal("0.00"))

        for invoice in ytd_invoices:
            customer_name = invoice.customer.name if invoice.customer_id else "Walk-in Customer"
            customer_totals[customer_name] += invoice.total_amount or Decimal("0.00")
            for item in invoice.items.all():
                product_name = item.product.name if item.product_id else item.description or "Unassigned Product"
                product_totals[product_name]["quantity"] += item.quantity or Decimal("0.00")
                product_totals[product_name]["amount"] += item.line_total or Decimal("0.00")
                if item.product_id:
                    product_qty_sold[str(item.product_id)] += item.quantity or Decimal("0.00")

        for invoice in open_invoices:
            customer_name = invoice.customer.name if invoice.customer_id else "Walk-in Customer"
            customer_outstanding[customer_name] += invoice.outstanding_balance or Decimal("0.00")

        top_customers = [
            {"id": name, "title": name, "meta": "Total sales", "value": amount}
            for name, amount in sorted(customer_totals.items(), key=lambda item: item[1], reverse=True)[:5]
        ]
        top_products = [
            {
                "id": name,
                "title": name,
                "meta": f"{values['quantity']} sold",
                "value": values["amount"],
            }
            for name, values in sorted(product_totals.items(), key=lambda item: item[1]["amount"], reverse=True)[:5]
        ]
        raw_material_status = [
            {
                "id": str(item.id),
                "title": item.name,
                "meta": f"Reorder at {item.reorder_level} {item.unit or 'units'}",
                "value": item.stock_available,
            }
            for item in sorted(raw_materials, key=lambda material: material.stock_available)[:5]
        ]
        finished_goods_status = [
            {
                "id": str(product.id),
                "title": product.name,
                "meta": f"{product_qty_sold[str(product.id)]} sold",
                "value": product.stock_quantity,
            }
            for product in sorted(
                products,
                key=lambda item: (product_qty_sold[str(item.id)], item.stock_quantity),
                reverse=True,
            )[:5]
        ]
        top_receivables = [
            {"key": name, "customer_name": name, "amount_outstanding": amount}
            for name, amount in sorted(customer_outstanding.items(), key=lambda item: item[1], reverse=True)[:5]
        ]
        open_invoice_rows = [
            {
                "key": str(invoice.id),
                "sales_id": invoice.invoice_number,
                "customer_name": invoice.customer.name if invoice.customer_id else "Walk-in Customer",
                "amount_outstanding": invoice.outstanding_balance,
            }
            for invoice in open_invoices[:5]
        ]
        financial_snapshot = [
            {"key": "sales", "label": "Sales", "amount": total_sales},
            {"key": "collections", "label": "Cash Collected", "amount": cash_collected},
            {"key": "receivables", "label": "Outstanding Receivables", "amount": outstanding_receivables},
            {"key": "cogs", "label": "Total Cost", "amount": total_cost},
            {"key": "expenses", "label": "Expenses", "amount": expense_total},
            {"key": "profit", "label": "Profit / Loss", "amount": profit_loss},
        ]

        return Response(
            {
                "as_of_date": today.isoformat(),
                "metrics": [
                    {"label": "Total Sales (YTD)", "value": total_sales, "note": f"{len(ytd_invoices)} invoices this year"},
                    {
                        "label": "Outstanding Receivables",
                        "value": outstanding_receivables,
                        "note": f"{len(open_invoices)} open invoices",
                    },
                    {"label": "Batches", "value": len(ytd_batches), "note": "Production batches this year"},
                    {"label": "Total Cost", "value": total_cost, "note": "Production cost this year"},
                    {"label": "Profit / Loss", "value": profit_loss, "note": "Sales minus production cost"},
                ],
                "top_customers": top_customers,
                "top_products": top_products,
                "raw_material_status": raw_material_status,
                "finished_goods_status": finished_goods_status,
                "financial_snapshot": financial_snapshot,
                "top_receivables": top_receivables,
                "open_invoices": open_invoice_rows,
            }
        )
