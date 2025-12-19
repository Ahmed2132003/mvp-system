from rest_framework import serializers
from ..models import Table
from django.conf import settings

class TableSerializer(serializers.ModelSerializer):
    qr_code_url = serializers.SerializerMethodField()
    qr_code_base64 = serializers.CharField(read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    available_at_time = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = [
            'id',
            'number',
            'capacity',
            'is_available',
            'branch',
            'branch_name',
            'available_at_time',
            'qr_code',
            'qr_code_url',
            'qr_code_base64',
        ]

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            return settings.SITE_URL + obj.qr_code.url
        return None

    def get_available_at_time(self, obj):
        availability_map = self.context.get("availability_map")
        if isinstance(availability_map, dict):
            return availability_map.get(obj.id)
        return None