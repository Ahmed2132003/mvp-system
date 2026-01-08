# backend/orders/models.py
from django.db import models
from decimal import Decimal, ROUND_HALF_UP
import qrcode
from io import BytesIO
from django.core.files import File
from django.conf import settings

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .utils import update_inventory_for_order
from django.core.exceptions import ValidationError
import base64
from django.core.mail import EmailMessage, get_connection

class TableQuerySet(models.QuerySet):
    def at_branch(self, branch):
        if branch is None:
            return self
        return self.filter(models.Q(branch=branch) | models.Q(branch__isnull=True))

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

    def at_branch(self, *args, **kwargs):
        return self.get_queryset().at_branch(*args, **kwargs)

    def at_store(self, *args, **kwargs):
        return self.get_queryset().at_store(*args, **kwargs)
    
    def for_capacity(self, *args, **kwargs):
        return self.get_queryset().for_capacity(*args, **kwargs)

    def available_at_time(self, *args, **kwargs):
        return self.get_queryset().available_at_time(*args, **kwargs)

class Table(models.Model):
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='tables')
    branch = models.ForeignKey('branches.Branch', on_delete=models.CASCADE, related_name='tables', null=True, blank=True)
    number = models.CharField(max_length=20)  # رقم الطاولة
    capacity = models.PositiveSmallIntegerField(default=4)    
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)
    objects = TableManager()
    qr_code_base64 = models.TextField(blank=True, null=True, editable=False)

    class Meta:
        unique_together = ('store', 'branch', 'number')

    def __str__(self):
        branch_label = f" - {self.branch.name}" if self.branch else ""
        return f"Table {self.number}{branch_label} - {self.store.name}"
    
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
        elif self.qr_code and not self.qr_code_base64:
            try:
                self.qr_code.file.seek(0)
                encoded = base64.b64encode(self.qr_code.file.read()).decode("utf-8")
                self.qr_code_base64 = encoded
                Table.objects.filter(pk=self.pk).update(qr_code_base64=encoded)
            except Exception:
                # لو الملف مش موجود لأي سبب، نتجاهل بدون ما نكسر الحفظ
                pass        
                             
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
    is_paid = models.BooleanField(default=False)
    delivery_address = models.TextField(blank=True, null=True)

    customer_name = models.CharField(max_length=255, blank=True, null=True)    
    customer_phone = models.CharField(max_length=20, blank=True, null=True)
    customer_email = models.EmailField(max_length=254, blank=True, null=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)    
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)    
    notes = models.TextField(blank=True, null=True)
    objects = OrderManager()

    def __str__(self):
        return f"Order #{self.id} - {self.total} EGP"

    def update_total(self):
        from core.models import StoreSettings

        subtotal = sum((item.subtotal for item in self.items.all()), Decimal("0"))

        try:
            tax_rate = Decimal(self.store.settings.tax_rate)
        except StoreSettings.DoesNotExist:
            tax_rate = Decimal("0")

        tax_amount = (subtotal * tax_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total = (subtotal + tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        self.subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.tax_rate = tax_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        self.tax_amount = tax_amount
        self.total = total
        self.save(update_fields=['subtotal', 'tax_rate', 'tax_amount', 'total'])
        
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


class Invoice(models.Model):
    order = models.OneToOneField('Order', on_delete=models.CASCADE, related_name='invoice')
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='invoices')
    branch = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    invoice_number = models.CharField(max_length=64, unique=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    customer_phone = models.CharField(max_length=20, blank=True, null=True)
    order_type = models.CharField(max_length=20, choices=Order.ORDER_TYPE_CHOICES)
    delivery_address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)    
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice {self.invoice_number}"
        
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
    instance._previous_status = old_status
    instance._status_changed = old_status != new_status
    
    # لو اتحولت الحالة لـ PAID نسجل الدفع بدون ما نخرج من دورة الـ KDS
    if new_status == 'PAID' and not instance.is_paid:
        instance.is_paid = True

    # خصم المخزون يحصل عند أول انتقال لـ READY فقط
    instance._deduct_stock = old_status != 'READY' and new_status == 'READY'

    # إرجاع المخزون فقط لو كان الطلب وصل READY أو أبعد
    if new_status == 'CANCELLED' and old_status in ['READY', 'SERVED', 'PAID']:
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
        "store": order.store_id,
        "branch": order.branch_id,
        "branch_name": order.branch.name if order.branch else None,
        "table_number": order.table.number if order.table else None,
        "customer_name": order.customer_name,
        "total": float(order.total),
        "is_paid": order.is_paid,
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


@receiver(post_save, sender=Order)
def ensure_invoice_exists(sender, instance: Order, **kwargs):  
    """
    تأكد من إنشاء فاتورة لكل طلب وتحديث بياناتها الأساسية.
    """
    try:
        from .services.invoice import ensure_invoice_for_order
    except Exception:
        return

    ensure_invoice_for_order(instance)


@receiver(post_save, sender=Order)
def notify_customer_on_status_change(sender, instance: Order, created, **kwargs):
    if created:
        return

    if not getattr(instance, "_status_changed", False):
        return

    if not instance.customer_email:
        return

    store_settings = getattr(instance.store, "settings", None)
    if not store_settings:
        return

    if not store_settings.notification_email or not store_settings.notification_email_password:
        return

    status_map = {
        "PENDING": "جديد",
        "PREPARING": "قيد التحضير",
        "READY": "جاهز",
        "SERVED": "تم التقديم",
        "PAID": "مدفوع",
        "CANCELLED": "ملغي",
    }
    status_label = status_map.get(instance.status, instance.status)
    store_name = instance.store.name or "المطعم"

    subject = f"تحديث حالة الطلب #{instance.id}"
    body = (
        f"مرحبًا{(' ' + instance.customer_name) if instance.customer_name else ''},\n\n"
        f"تم تحديث حالة طلبك رقم #{instance.id} في {store_name}.\n"
        f"الحالة الحالية: {status_label}.\n\n"
        "شكرًا لتعاملك معنا."
    )

    try:
        connection = get_connection(
            username=store_settings.notification_email,
            password=store_settings.notification_email_password,
            fail_silently=False,
        )
        message = EmailMessage(
            subject=subject,
            body=body,
            from_email=store_settings.notification_email,
            to=[instance.customer_email],
            connection=connection,
        )
        message.send(fail_silently=False)
    except Exception:
        return