# attendance/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import AttendanceLog
from core.tasks import send_notification_whatsapp

@receiver(post_save, sender=AttendanceLog)
def employee_late_notification(sender, instance, created, **kwargs):
    if not (created and instance.is_late):
        return

    try:
        store_settings = getattr(instance.employee.store, "settings", None)
        if not store_settings:
            return

        # لو عندك notifications JSONField داخل settings
        notifications = getattr(store_settings, "notifications", {}) or {}
        if not notifications.get("late_employee_enabled", True):
            return

        numbers = notifications.get("whatsapp_numbers", [])
        if not numbers:
            return

        late_by = instance.late_minutes or 0
        message = f"{instance.employee.user.name} تأخر اليوم {late_by} دقيقة"
        send_notification_whatsapp.delay(numbers, "تأخير موظف", message)

    except Exception:
        # مهم: ما تكسرش تسجيل الحضور بسبب الاشعارات
        return
