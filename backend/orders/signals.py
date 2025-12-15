# orders/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Order
from core.tasks import send_notification_whatsapp


@receiver(post_save, sender=Order)
def new_order_notification(sender, instance, created, **kwargs):
    """
    إرسال إشعار واتساب عند إنشاء Order جديد.
    ملاحظة: في موديل Order عندك الحالات: PENDING, PREPARING, READY, SERVED, PAID, CANCELLED
    ولا يوجد CONFIRMED — لذلك حذفنا CONFIRMED لتفادي لبس.
    """
    if not created:
        return

    if instance.status not in ["PENDING"]:
        return

    store = instance.store
    if not store:
        return

    settings = getattr(store, "settings", {}) or {}
    notifications = settings.get("notifications", {}) or {}

    if not notifications.get("new_order_enabled", True):
        return

    numbers = notifications.get("whatsapp_numbers", []) or []
    if not numbers:
        return

    table_number = instance.table.number if instance.table else "غير محدد"
    message = (
        f"طلب جديد #{instance.id}\n"
        f"الإجمالي: {instance.total} جنيه\n"
        f"الطاولة: {table_number}"
    )

    send_notification_whatsapp.delay(numbers, f"طلب جديد في {store.name}", message)
