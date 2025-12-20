from datetime import timedelta

from django.conf import settings
import base64
from django.utils import timezone
from rest_framework import serializers

from ..models import Table

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
            qr_url = obj.qr_code.url
            if qr_url.startswith("http://") or qr_url.startswith("https://"):
                return qr_url

            base = settings.SITE_URL.rstrip("/")
            return f"{base}{qr_url}"
        return None
    
    def get_available_at_time(self, obj):
        availability_map = self.context.get("availability_map")
        if isinstance(availability_map, dict):
            return availability_map.get(obj.id)
        return None

    def to_representation(self, obj):
        """
        نعيد الحقول كما هي مع ضمان وجود base64 للـ QR لو الملف متاح.
        بدون أي تعديل على is_available حتى لا نكسر اختيار المستخدم.
        """
        data = super().to_representation(obj)

        if not data.get("qr_code_base64") and getattr(obj, "qr_code", None):
            try:
                obj.qr_code.file.seek(0)
                encoded = base64.b64encode(obj.qr_code.file.read()).decode("utf-8")
                data["qr_code_base64"] = encoded
            except Exception:
                pass

        return data