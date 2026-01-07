import uuid
from django.utils import timezone

from ..models import Invoice


def generate_invoice_number(order):
    base = timezone.now().strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"INV-{order.store_id}-{base}-{order.id:06d}-{random_part}"


def ensure_invoice_for_order(order):
    """
    Create or sync an invoice for the given order.
    """
    defaults = {
        "store": order.store,
        "branch": order.branch,
        "subtotal": order.subtotal,
        "tax_rate": order.tax_rate,
        "tax_amount": order.tax_amount,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "order_type": order.order_type,
        "delivery_address": order.delivery_address,
        "notes": order.notes,        
        "total": order.total,
    }

    invoice, created = Invoice.objects.get_or_create(
        order=order,
        defaults={**defaults, "invoice_number": generate_invoice_number(order)},
    )

    updated_fields = []
    for field, value in defaults.items():
        if getattr(invoice, field) != value:
            setattr(invoice, field, value)
            updated_fields.append(field)

    if updated_fields:
        invoice.save(update_fields=updated_fields)

    return invoice