from django.contrib import admin

from plus.admin_mixins import ExportCsvAdminMixin

from .models import Product


@admin.register(Product)
class ProductAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("sku", "name", "unit_price", "stock_quantity", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("sku", "name")
