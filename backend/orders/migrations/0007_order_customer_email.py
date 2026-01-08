from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_invoice_subtotal_invoice_tax_amount_invoice_tax_rate_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='customer_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
    ]