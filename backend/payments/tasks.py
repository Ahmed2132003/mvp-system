# payments/tasks.py
from celery import shared_task
from orders.models import Order
from inventory.models import Inventory

@shared_task
def process_successful_payment(order_id):
    try:
        order = Order.objects.select_related('store').prefetch_related('items').get(id=order_id)
        
        # 1. خصم المخزون
        for order_item in order.items.all():
            inventory = Inventory.objects.get(store=order.store, item=order_item.item)
            inventory.qty_on_hand -= order_item.quantity
            inventory.save()

        # 2. إضافة نقاط الولاء (لو مفعل)
        if order.store.loyalty_enabled and order.customer:
            from loyalty.models import LoyaltyAccount
            account, _ = LoyaltyAccount.objects.get_or_create(
                customer=order.customer, store=order.store
            )
            points_earned = int(order.total * order.store.loyalty_points_per_pound)
            account.points += points_earned
            account.save()

        # 3. إرسال إشعار واتساب/طباعة (اختياري لاحقًا)

    except Exception as e:
        # مهم جدًا: تسجيل الخطأ
        print(f"Error processing payment for order {order_id}: {e}")