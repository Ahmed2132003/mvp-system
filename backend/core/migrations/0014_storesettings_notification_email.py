from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_employee_shift_times'),
        ('core', '0013_user_reset_password_token_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='storesettings',
            name='notification_email',
            field=models.EmailField(blank=True, max_length=254, null=True, verbose_name='بريد الإشعارات'),
        ),
        migrations.AddField(
            model_name='storesettings',
            name='notification_email_password',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='App Password للإيميل'),
        ),
    ]