from django.contrib import admin

from plus.admin_mixins import ExportCsvAdminMixin

from .models import (
    AccountTransaction,
    MaterialUsage,
    ProductionBatch,
    ProductionOutput,
    Purchase,
    PurchaseItem,
    PurchasePayment,
    RawMaterial,
    PricingRule,
    Supplier,
)


@admin.register(Supplier)
class SupplierAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("supplier_code", "name", "item_category", "delivery_package", "phone")
    search_fields = ("supplier_code", "name")


@admin.register(RawMaterial)
class RawMaterialAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("item_code", "name", "category", "unit", "unit_price", "opening_stock", "stock_in", "stock_out")
    search_fields = ("item_code", "name", "category")
    list_filter = ("category",)


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0


class PurchasePaymentInline(admin.TabularInline):
    model = PurchasePayment
    extra = 0


@admin.register(Purchase)
class PurchaseAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("purchase_id", "purchase_date", "supplier", "total_amount", "total_paid", "outstanding_amount", "status")
    list_filter = ("status", "purchase_date")
    search_fields = ("purchase_id", "supplier__name")
    inlines = [PurchaseItemInline, PurchasePaymentInline]


class ProductionOutputInline(admin.TabularInline):
    model = ProductionOutput
    extra = 0


class MaterialUsageInline(admin.TabularInline):
    model = MaterialUsage
    extra = 0


@admin.register(ProductionBatch)
class ProductionBatchAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("batch_number", "production_date", "total_cost", "total_production_value", "profit")
    search_fields = ("batch_number",)
    list_filter = ("production_date",)
    inlines = [ProductionOutputInline, MaterialUsageInline]


@admin.register(AccountTransaction)
class AccountTransactionAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("transaction_id", "transaction_date", "entry_type", "category", "amount", "payment_method")
    list_filter = ("entry_type", "transaction_date", "category")
    search_fields = ("transaction_id", "description", "comments")


@admin.register(PricingRule)
class PricingRuleAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("price_id", "size", "pricing_category", "price")
    search_fields = ("price_id", "size", "pricing_category")
    list_filter = ("pricing_category",)
