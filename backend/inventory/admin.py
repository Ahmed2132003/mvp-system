from django.contrib import admin
from .models import Item , Category  , Inventory , InventoryMovement


admin.site.register(Item)
admin.site.register(Category)
admin.site.register(Inventory)
admin.site.register(InventoryMovement)

# Register your models here.
