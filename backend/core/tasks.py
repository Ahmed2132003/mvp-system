# core/tasks.py
from celery import shared_task
from decouple import config
import requests
import logging
from django.db.models import F

logger = logging.getLogger(__name__)

def send_whatsapp_message(to: str, body: str) -> bool:
    """إرسال رسالة واتساب - Twilio (Sandbox أو Production)"""
    account_sid = config('TWILIO_ACCOUNT_SID', default=None)
    auth_token = config('TWILIO_AUTH_TOKEN', default=None)
    from_number = config('TWILIO_WHATSAPP_NUMBER', default='whatsapp:+14155238886')  # Sandbox

    if not account_sid or not auth_token:
        logger.warning("Twilio credentials not configured. Skipping WhatsApp message.")
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    payload = {
        'From': from_number,
        'To': f'whatsapp:{to}' if not to.startswith('whatsapp:') else to,
        'Body': body
    }
    auth = (account_sid, auth_token)

    try:
        response = requests.post(url, data=payload, auth=auth, timeout=10)
        if response.status_code == 201:
            logger.info(f"WhatsApp sent successfully to {to}")
            return True
        else:
            logger.error(f"Twilio error {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"WhatsApp send exception: {str(e)}")
    return False


@shared_task
def send_notification_whatsapp(numbers, title, message):
    if not numbers:
        return
    body = f"*{title}*\n\n{message}\n\n— نظام إدارة المطاعم"
    for number in numbers:
        if number and number.startswith('+'):
            send_whatsapp_message(number, body)


@shared_task
def check_low_stock_daily():
    """مهمة يومية تفحص كل الفروع"""
    from stores.models import Store
    from inventory.models import Inventory

    for store in Store.objects.filter(is_active=True):
        low_items = Inventory.objects.filter(
            store=store,
            qty_on_hand__lte=F('reorder_level'),
            item__track_inventory=True
        ).select_related('item')

        if low_items.exists():
            items_text = "\n".join([
                f"• {i.item.name}: {i.qty_on_hand} (الحد الأدنى: {i.reorder_level})"
                for i in low_items
            ])
            message = f"تنبيه مخزون منخفض في فرع ({store.name})\n\n{items_text}"
            numbers = store.settings.get('notifications', {}).get('whatsapp_numbers', [])
            send_notification_whatsapp.delay(numbers, "تنبيه: مخزون منخفض!", message)