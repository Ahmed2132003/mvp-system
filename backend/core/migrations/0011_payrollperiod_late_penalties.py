from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_add_payroll_base_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="payrollperiod",
            name="late_penalties",
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
    ]