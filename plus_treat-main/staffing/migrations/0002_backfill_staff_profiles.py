from django.conf import settings
from django.db import migrations


def create_missing_staff_profiles(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    StaffProfile = apps.get_model("staffing", "StaffProfile")

    user_table = User._meta.db_table
    staff_table = StaffProfile._meta.db_table

    schema_editor.execute(
        f"""
        INSERT INTO {staff_table} (phone, role, is_sales_staff, created_at, updated_at, user_id)
        SELECT '', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, u.id
        FROM {user_table} u
        LEFT JOIN {staff_table} s ON s.user_id = u.id
        WHERE s.user_id IS NULL
        """
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("staffing", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(create_missing_staff_profiles, noop_reverse),
    ]
