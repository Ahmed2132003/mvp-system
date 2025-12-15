#backend/orders/utils.py  

from django.db import transaction
from django.db.models import F
from inventory.models import Inventory
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

@transaction.atomic
def update_inventory_for_order(order, reverse=False):
    if order.status in ['PENDING', 'CANCELLED'] and not reverse:
        return

    store_settings = order.store.store_settings
    allow_without_stock = store_settings.allow_order_without_stock

    for order_item in order.items.all():
        try:
            inventory = Inventory.objects.select_for_update().get(
                item=order_item.item,
                branch=order.branch
            )
        except Inventory.DoesNotExist:
            if not allow_without_stock:
                raise ValidationError(f"الصنف {order_item.item.name} غير موجود في المخزون")
            continue

        qty = order_item.quantity

        if reverse:
            # إرجاع المخزون (ممنوع يزيد عن الليميت؟ لا طبعًا، خليه يرجع كله)
            inventory.quantity += qty
            logger.info(f"إرجاع {qty} من {order_item.item.name}")
        else:
            # خصم المخزون
            if not allow_without_stock and inventory.quantity < qty:
                raise ValidationError(f"الكمية غير كافية: {order_item.item.name}")

            # لو مسموح بدون مخزون → خصم على قد ما يقدر بس
            deductible = min(inventory.quantity, qty) if allow_without_stock else qty
            inventory.quantity -= deductible

            # لو خصمنا أقل من المطلوب → نسجل عجز (اختياري لاحقًا)
            if deductible < qty:
                shortage = qty - deductible
                logger.warning(f"عجز في المخزون: {order_item.item.name} بكمية {shortage}")

        inventory.save()