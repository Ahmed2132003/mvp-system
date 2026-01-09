from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("branches", "0003_branch_attendance_penalty"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="opening_time",
            field=models.TimeField(blank=True, null=True, verbose_name="مواعيد الفتح"),
        ),
        migrations.AddField(
            model_name="branch",
            name="closing_time",
            field=models.TimeField(blank=True, null=True, verbose_name="مواعيد الإغلاق"),
        ),
    ]