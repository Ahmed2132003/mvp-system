import base64
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
            "id",
            "number",
            "capacity",
            "is_available",
            "branch",
            "branch_name",
            "available_at_time",
            "qr_code",
            "qr_code_url",
            "qr_code_base64",
        ]

    def get_qr_code_url(self, obj):
        """
        ✅ الحل النهائي (Docker-safe + Nginx-safe):

        - نرجّع URL نسبي فقط: /media/...
        - من غير SITE_URL
        - من غير request.build_absolute_uri
        - Nginx هو المسؤول عن تقديم الصورة
        """
        if not obj.qr_code:
            return None

        try:
            # مثال: /media/qr_codes/table_12.png
            return obj.qr_code.url
        except Exception:
            return None

    def get_available_at_time(self, obj):
        availability_map = self.context.get("availability_map")
        if isinstance(availability_map, dict):
            return availability_map.get(obj.id)
        return None

    def to_representation(self, obj):
        """
        Fallback اختياري:
        لو لأي سبب URL فشل، يبقى عندك base64 جاهز
        (مفيد جدًا في debugging)
        """
        data = super().to_representation(obj)

        if not data.get("qr_code_base64") and getattr(obj, "qr_code", None):
            try:
                obj.qr_code.file.seek(0)
                data["qr_code_base64"] = base64.b64encode(
                    obj.qr_code.file.read()
                ).decode("utf-8")
            except Exception:
                pass

        return data
