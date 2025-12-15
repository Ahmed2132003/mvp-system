# backend/orders/models.py
from django.db import models
import qrcode
from io import BytesIO
from django.core.files import File
from django.conf import settings

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .utils import update_inventory_for_order
from django.core.exceptions import ValidationError
import base64

class TableQuerySet(models.QuerySet):
    def available(self):
        return self.filter(is_available=True)

    def at_store(self, store):
        return self.filter(store=store)

    def for_capacity(self, min_capacity):
        return self.filter(capacity__gte=min_capacity)

    def available_at_time(self, reservation_time, duration_minutes=60):  # افتراضي ساعة حجز
        from django.utils import timezone
        from datetime import timedelta
        end_time = reservation_time + timedelta(minutes=duration_minutes)
        
        # فلتر الطاولات اللي مفيش حجز يتداخل مع الوقت ده
        return self.exclude(
            reservations__reservation_time__lt=end_time,
            reservations__reservation_time__gte=reservation_time - timedelta(minutes=duration_minutes),  # تداخل من الجهتين
            reservations__status__in=['PENDING', 'CONFIRMED']
        ).filter(is_available=True)

class TableManager(models.Manager):
    def get_queryset(self):
        return TableQuerySet(self.model, using=self._db)

    def available(self, *args, **kwargs):
        return self.get_queryset().available(*args, **kwargs)

    def at_store(self, *args, **kwargs):
        return self.get_queryset().at_store(*args, **kwargs)

    def for_capacity(self, *args, **kwargs):
        return self.get_queryset().for_capacity(*args, **kwargs)

    def available_at_time(self, *args, **kwargs):
        return self.get_queryset().available_at_time(*args, **kwargs)

class Table(models.Model):
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='tables')
    number = models.CharField(max_length=20)  # رقم الطاولة
    capacity = models.PositiveSmallIntegerField(default=4)
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)
    objects = TableManager()
    qr_code_base64 = models.TextField(blank=True, null=True, editable=False)

    class Meta:
        unique_together = ('store', 'number')

    def __str__(self):
        return f"Table {self.number} - {self.store.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)  # نحفظ الأول عشان نضمن الـ ID

        if not self.qr_code and self.store:
            table_url = f"{settings.SITE_URL}/table/{self.id}/menu/"
            
            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(table_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            buffer = BytesIO()
            img.save(buffer, format='PNG')
            filename = f"qr_table_{self.store.id}_{self.number}.png"
            
            self.qr_code.save(filename, File(buffer), save=False)
            
            buffer.seek(0)
            self.qr_code_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            
            Table.objects.filter(pk=self.pk).update(
                qr_code=self.qr_code,
                qr_code_base64=self.qr_code_base64
            )        
class OrderQuerySet(models.QuerySet):
    def pending(self):
        return self.filter(status='PENDING')

    def preparing(self):
        return self.filter(status='PREPARING')

    def ready(self):
        return self.filter(status='READY')

    def today(self):
        from django.utils import timezone
        today = timezone.now().date()
        return self.filter(created_at__date=today)

    def at_branch(self, branch):
        return self.filter(branch=branch)

    def paid(self):
        return self.filter(status='PAID')

    def unpaid(self):
        return self.exclude(status='PAID')

    def with_table(self):
        return self.filter(table__isnull=False)

    def total_sales_today(self):
        from django.db.models import Sum
        from django.utils import timezone
        today = timezone.now().date()
        return self.filter(
            status='PAID',
            created_at__date=today
        ).aggregate(total=Sum('total'))['total'] or 0


class OrderManager(models.Manager):
    def get_queryset(self):
        return OrderQuerySet(self.model, using=self._db)

    def today(self, *args, **kwargs):
        return self.get_queryset().today(*args, **kwargs)

    def total_sales_today(self, *args, **kwargs):
        return self.get_queryset().total_sales_today(*args, **kwargs)

    def pending(self, *args, **kwargs):
        return self.get_queryset().pending(*args, **kwargs)

    def at_branch(self, *args, **kwargs):
        return self.get_queryset().at_branch(*args, **kwargs)
        
class Order(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PREPARING', 'Preparing'),
        ('READY', 'Ready'),
        ('SERVED', 'Served'),
        ('PAID', 'Paid'),
        ('CANCELLED', 'Cancelled'),
    ]

    ORDER_TYPE_CHOICES = [
        ('IN_STORE', 'In store'),
        ('DELIVERY', 'Delivery'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('PAYMOB', 'PayMob'),
    ]

    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='orders')
    branch = models.ForeignKey('branches.Branch',on_delete=models.PROTECT,  related_name='orders')
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')

    # ✅ جديد:
    order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES, default='IN_STORE')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='CASH')
    delivery_address = models.TextField(blank=True, null=True)

    customer_name = models.CharField(max_length=255, blank=True, null=True)
    customer_phone = models.CharField(max_length=20, blank=True, null=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True, null=True)
    objects = OrderManager()

    def __str__(self):
        return f"Order #{self.id} - {self.total} EGP"

    def update_total(self):
        total = sum(item.subtotal for item in self.items.all())
        self.total = total
        self.save(update_fields=['total'])

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.update_total()


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey('inventory.Item', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    def __str__(self):
        return f"{self.quantity}x {self.item.name}"

    def save(self, *args, **kwargs):
        self.unit_price = self.item.unit_price
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)
        self.order.update_total()
        
class Payment(models.Model):
    GATEWAY_CHOICES = [
        ('PAYMOB', 'PayMob'),
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.transaction_id or ''} - {self.amount} EGP" 
    
class Reservation(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
        ('NO_SHOW', 'No Show'),
    ]

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='reservations')
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=20)
    reservation_time = models.DateTimeField()
    party_size = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)
    duration = models.PositiveSmallIntegerField(default=60)

    def __str__(self):
        return f"Reservation for {self.customer_name} at {self.reservation_time}"
    

@receiver(post_save, sender=Reservation)
def update_table_availability(sender, instance, **kwargs):
    table = instance.table
    if instance.status == 'CONFIRMED':
        table.is_available = False
    elif instance.status in ['CANCELLED', 'NO_SHOW']:
        table.is_available = True
    table.save(update_fields=['is_available'])

@receiver(pre_save, sender=Reservation)
def check_availability_before_save(sender, instance, **kwargs):
    if instance.pk is None or instance.status == 'CONFIRMED':  # حجز جديد أو تغيير إلى Confirmed
        # تحقق من التوافر قبل الحفظ
        available_tables = Table.objects.available_at_time(instance.reservation_time, instance.duration)
        if not available_tables.filter(id=instance.table.id).exists():
            raise ValidationError(f"الطاولة {instance.table.number} غير متوفرة في {instance.reservation_time}")

@receiver(pre_save, sender=Order)
def prepare_inventory_change(sender, instance, **kwargs):
    if instance.pk is None:
        return  # طلب جديد

    try:
        old = Order.objects.only('status').get(pk=instance.pk)
    except Order.DoesNotExist:
        return

    old_status = old.status
    new_status = instance.status

    # هل هيتحول من PENDING إلى PREPARING أو أي حالة تأكيد؟
    if old_status == 'PENDING' and new_status in ['PREPARING', 'READY', 'PAID', 'SERVED']:
        instance._deduct_stock = True
    else:
        instance._deduct_stock = False

    # هل هيتحول إلى CANCELLED؟
    if new_status == 'CANCELLED' and old_status != 'CANCELLED':
        instance._return_stock = True
    else:
        instance._return_stock = False


@receiver(post_save, sender=Order)
def execute_inventory_change(sender, instance, created, **kwargs):
    if created:
        return

    if getattr(instance, '_deduct_stock', False):
        update_inventory_for_order(instance, reverse=False)

    if getattr(instance, '_return_stock', False):
        update_inventory_for_order(instance, reverse=True)
        
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def serialize_order_for_kds(order: Order):
    # هنستخدم داتا خفيفة، كفاية للـ UI
    return {
        "id": order.id,
        "status": order.status,
        "table_number": order.table.number if order.table else None,
        "customer_name": order.customer_name,
        "total": float(order.total),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "notes": order.notes,
        "items": [
            {
                "id": oi.id,
                "name": oi.item.name,
                "quantity": oi.quantity,
            }
            for oi in order.items.select_related("item").all()
        ],
    }


@receiver(post_save, sender=Order)
def notify_kds_on_order_change(sender, instance: Order, created, **kwargs):
    """
    أي تغيير في Order → نبعت تحديث للـ KDS
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    event_type = "kds_order_created" if created else "kds_order_updated"
    payload = {
        "type": event_type,
        "order": serialize_order_for_kds(instance),
    }

    # حالياً جروب واحد لكل السيستم (MVP)
    async_to_sync(channel_layer.group_send)("kds", payload)
