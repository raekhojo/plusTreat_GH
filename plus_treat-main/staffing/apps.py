from django.apps import AppConfig


class StaffingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "staffing"

    def ready(self):
        import staffing.signals  # noqa: F401
