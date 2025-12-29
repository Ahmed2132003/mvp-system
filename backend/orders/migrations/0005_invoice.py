from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_alter_table_unique_together_table_branch_and_more'),
        ('branches', '0002_branch_qr_menu_branch_qr_menu_base64'),
        ('core', '0003_payrollperiod_employeeledger'),
    ]

    operations = [
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('invoice_number', models.CharField(max_length=64, unique=True)),
                ('customer_name', models.CharField(blank=True, max_length=255, null=True)),
                ('customer_phone', models.CharField(blank=True, max_length=20, null=True)),
                ('order_type', models.CharField(choices=[('IN_STORE', 'In store'), ('DELIVERY', 'Delivery')], max_length=20)),
                ('delivery_address', models.TextField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invoices', to='branches.branch')),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='invoice', to='orders.order')),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to='core.store')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]