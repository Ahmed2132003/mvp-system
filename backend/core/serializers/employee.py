# core/serializers/employee.py

from rest_framework import serializers
from django.conf import settings
from core.models import Employee
from attendance.models import AttendanceLog
from .user import UserSerializer


class EmployeeSerializer(serializers.ModelSerializer):
    # User info
    user = UserSerializer(read_only=True)

    store_name = serializers.CharField(source='store.name', read_only=True)

    # Attendance / Status
    is_present = serializers.SerializerMethodField()

    # ✅ NEW: QR attendance الموحد من store
    store_qr_attendance_base64 = serializers.CharField(source="store.qr_attendance_base64", read_only=True)
    store_qr_attendance_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "store",
            "store_name",
            "hire_date",
            "salary",
            "advances",

            "is_present",

            # ✅ Store QR (موحد)
            "store_qr_attendance_base64",
            "store_qr_attendance_url",
        ]

    def get_store_qr_attendance_url(self, obj):
        if obj.store and obj.store.qr_attendance:
            return f"{settings.SITE_URL}{obj.store.qr_attendance.url}"
        return None

    def get_is_present(self, obj):
        return AttendanceLog.objects.filter(employee=obj, check_out__isnull=True).exists()
