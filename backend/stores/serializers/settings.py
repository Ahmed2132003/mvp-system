from rest_framework import serializers
from core.models import StoreSettings

class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        exclude = ['id', 'store']