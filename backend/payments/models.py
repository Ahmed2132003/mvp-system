# payments/models.py
from django.db import models
from orders.models import Order
import uuid

class Payment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'معلق'),
        ('SUCCESS', 'ناجح'),
        ('FAILED', 'فشل'),
        ('EXPIRED', 'منتهي'),
    ]

    GATEWAY_CHOICES = [
        ('paymob', 'PayMob'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES, default='paymob')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    iframe_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"دفع {self.order.id} - {self.status}"