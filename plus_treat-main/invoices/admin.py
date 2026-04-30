from django.contrib import admin

from plus.admin_mixins import ExportCsvAdminMixin

from .models import Invoice, InvoiceItem, Payment


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = (
        "invoice_number",
        "invoice_date",
        "customer",
        "staff",
        "subtotal",
        "discount_amount",
        "total_amount",
        "outstanding_balance",
        "status",
    )
    list_filter = ("status", "invoice_date")
    search_fields = ("invoice_number", "customer__name", "staff__user__username")
    inlines = [InvoiceItemInline, PaymentInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("invoice", "description", "unit_price", "quantity", "line_total")
    search_fields = ("invoice__invoice_number", "description", "product__name")


@admin.register(Payment)
class PaymentAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("invoice", "amount", "method", "payment_date", "reference")
    list_filter = ("method", "payment_date")
    search_fields = ("invoice__invoice_number", "reference")
