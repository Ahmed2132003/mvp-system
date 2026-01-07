from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0012_user_is_payment_verified_user_trial_ends_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="employee",
            name="shift_end_time",
            field=models.TimeField(blank=True, null=True, verbose_name="نهاية شفت الموظف"),
        ),
        migrations.AddField(
            model_name="employee",
            name="shift_start_time",
            field=models.TimeField(blank=True, null=True, verbose_name="بداية شفت الموظف"),
        ),
    ]