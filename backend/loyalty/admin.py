from django.contrib import admin

# Register your models here.
from .models import LoyaltyProgram , LoyaltyTransaction , CustomerLoyalty

admin.site.register(LoyaltyProgram)
admin.site.register(LoyaltyTransaction)
admin.site.register(CustomerLoyalty)