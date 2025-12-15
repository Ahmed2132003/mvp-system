# loyalty/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from orders.models import Order
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

@receiver(post_save, sender=Order)
def award_loyalty_points(sender, instance, created, **kwargs):
    if not created and instance.tracker.has_changed('status') and instance.status == 'COMPLETED':
        store = instance.store
        if not store.loyalty_program or not store.loyalty_program.is_active:
            return

        program = store.loyalty_program
        phone = instance.customer_phone

        customer, _ = store.loyalty_customers.get_or_create(
            phone=phone,
            defaults={'name': instance.customer_name or phone}
        )

        # حساب النقاط
        points_to_add = int(instance.total_amount / program.points_per_egp)
        if points_to_add <= 0:
            return

        customer.points += points_to_add
        customer.total_spent += instance.total_amount
        customer.last_visit = timezone.now()
        customer.save()

        from .models import LoyaltyTransaction
        LoyaltyTransaction.objects.create(
            customer=customer,
            order=instance,
            type='EARN',
            points=points_to_add,
            note=f"طلب رقم {instance.id}"
        )