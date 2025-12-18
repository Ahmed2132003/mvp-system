# loyalty/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from orders.models import Order
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

@receiver(post_save, sender=Order)
def award_loyalty_points(sender, instance, created, **kwargs):
    # Only process completed orders
    if instance.status != 'COMPLETED':
        return

    store = instance.store

    # Ensure the loyalty program is available and active for this store
    if not store.loyalty_program or not store.loyalty_program.is_active:
        return

    # Avoid awarding points multiple times for the same order
    from .models import LoyaltyTransaction
    if LoyaltyTransaction.objects.filter(order=instance, type='EARN').exists():
        return

    phone = instance.customer_phone
    if not phone:
        return

    program = store.loyalty_program

    customer, _ = store.loyalty_customers.get_or_create(
        phone=phone,
        defaults={'name': instance.customer_name or phone}
    )

    # حساب النقاط
    points_to_add = int(Decimal(instance.total) / program.points_per_egp)
    if points_to_add <= 0:
        return

    customer.points += points_to_add
    customer.total_spent += instance.total
    customer.last_visit = timezone.now()
    customer.save()

    LoyaltyTransaction.objects.create(
        customer=customer,
        order=instance,
        type='EARN',
        points=points_to_add,
        note=f"طلب رقم {instance.id}"
    )