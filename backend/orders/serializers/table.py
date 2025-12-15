#serializers\table.py
from rest_framework import serializers
from ..models import Table
from django.conf import settings

class TableSerializer(serializers.ModelSerializer):
    qr_code_url = serializers.SerializerMethodField()
    qr_code_base64 = serializers.CharField(read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'number', 'capacity', 'is_available', 'qr_code', 'qr_code_url', 'qr_code_base64']

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            return settings.SITE_URL + obj.qr_code.url
        return None