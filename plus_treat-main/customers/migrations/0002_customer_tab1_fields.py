# Generated manually for tab-aligned customer fields.
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="customer_category",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="customer",
            name="customer_code",
            field=models.CharField(default="", max_length=40, unique=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="customer",
            name="date",
            field=models.DateField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="customer",
            name="pricing_category",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
