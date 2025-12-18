# core/serializers/employee.py

from rest_framework import serializers
from django.conf import settings
from core.models import Employee
from branches.models import Branch
from attendance.models import AttendanceLog
from .user import UserSerializer


class EmployeeSerializer(serializers.ModelSerializer):
    # User info
    user = UserSerializer(read_only=True)

    store_name = serializers.CharField(source='store.name', read_only=True)
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), allow_null=True, required=False
    )
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    
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
            "branch",
            "branch_name",
            "hire_date",
            "salary",
            "advances",
            
            "is_present",

            # ✅ Store QR (موحد)
            "store_qr_attendance_base64",
            "store_qr_attendance_url",
        ]

    def validate(self, attrs):
        store = attrs.get("store") or getattr(self.instance, "store", None)
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)

        if branch and store and branch.store_id != store.id:
            raise serializers.ValidationError({
                "branch": "يجب أن يكون الفرع تابعًا لنفس المتجر."
            })

        return attrs
    
    def get_store_qr_attendance_url(self, obj):
        if obj.store and obj.store.qr_attendance:
            return f"{settings.SITE_URL}{obj.store.qr_attendance.url}"
        return None

    def get_is_present(self, obj):
        return AttendanceLog.objects.filter(employee=obj, check_out__isnull=True).exists()
