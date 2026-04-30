from django.contrib import admin

from plus.admin_mixins import ExportCsvAdminMixin

from .models import StaffProfile


@admin.register(StaffProfile)
class StaffProfileAdmin(ExportCsvAdminMixin, admin.ModelAdmin):
    list_display = ("user", "role", "phone", "is_sales_staff", "updated_at")
    list_filter = ("is_sales_staff",)
    search_fields = ("user__username", "user__email", "role")
