from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("branches", "0002_branch_qr_menu_branch_qr_menu_base64"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="attendance_penalty_per_15min",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=8,
                null=True,
                verbose_name="غرامة التأخير لكل 15 دقيقة",
            ),
        ),
    ]