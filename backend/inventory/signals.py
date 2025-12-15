# inventory/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Inventory
from core.tasks import check_low_stock

@receiver(post_save, sender=Inventory)
def inventory_updated(sender, instance, **kwargs):
    # كل ما يتعدل المخزون، نشيك لو وصل للحد الأدنى
    if instance.qty_on_hand <= instance.reorder_level and instance.item.track_inventory:
        check_low_stock.delay(instance.store.id)