from django.contrib import admin

from plus.admin_mixins import ExportCsvAdminMixin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("customer_code", "name", "customer_category", "pricing_category", "phone", "updated_at")
    search_fields = ("customer_code", "name", "phone", "email")
    list_filter = ("customer_category", "pricing_category")
