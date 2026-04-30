from django.conf import settings
from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import StaffProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_staff_profile_exists(sender, instance, created, **kwargs):
    if not created:
        return

    # Fallback to raw SQL for environments where the DB PK type differs from model PK type.
    try:
        StaffProfile.objects.get_or_create(user=instance)
        return
    except Exception:
        pass

    table = StaffProfile._meta.db_table
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            INSERT OR IGNORE INTO {table}
            (phone, role, is_sales_staff, created_at, updated_at, user_id)
            VALUES ('', '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, %s)
            """,
            [instance.pk],
        )
