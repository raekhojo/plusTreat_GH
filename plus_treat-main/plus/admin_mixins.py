import csv

from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.urls import path, reverse


class ExportCsvAdminMixin:
    change_list_template = "admin/export_change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        opts = self.model._meta
        custom_urls = [
            path(
                "download/",
                self.admin_site.admin_view(self.download_csv_view),
                name=f"{opts.app_label}_{opts.model_name}_download",
            ),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        opts = self.model._meta
        extra_context["download_url"] = reverse(f"admin:{opts.app_label}_{opts.model_name}_download")
        return super().changelist_view(request, extra_context=extra_context)

    def download_csv_view(self, request):
        if not self.has_view_permission(request):
            raise PermissionDenied

        changelist = self.get_changelist_instance(request)
        queryset = changelist.get_queryset(request)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{self.model._meta.model_name}.csv"'

        writer = csv.writer(response)
        field_names = [field.name for field in self.model._meta.fields]
        writer.writerow(field_names)
        for obj in queryset.iterator():
            writer.writerow([getattr(obj, field) for field in field_names])

        return response

