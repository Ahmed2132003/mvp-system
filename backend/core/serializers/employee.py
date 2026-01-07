# core/serializers/employee.py

from rest_framework import serializers
from django.conf import settings
from core.models import Employee, User
from branches.models import Branch
from attendance.models import AttendanceLog
from .user import UserSerializer


class EmployeeSerializer(serializers.ModelSerializer):
    # User info
    user = UserSerializer(read_only=True)

    # Writable user fields
    user_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_email = serializers.EmailField(write_only=True, required=False)
    user_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
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
    # ✅ Per-employee QR (ثابت لكن الرابط متغيّر عبر السيرفر)␊
    qr_attendance_base64 = serializers.SerializerMethodField()    
    qr_code_attendance_base64 = serializers.CharField(source="qr_attendance_base64", read_only=True)
    qr_attendance_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "user_name",
            "user_email",
            "user_phone",
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

            # ✅ Employee QR
            "qr_attendance_base64",
            "qr_code_attendance_base64",
            "qr_attendance_url",
        ]
        
    def validate(self, attrs):
        store = attrs.get("store") or getattr(self.instance, "store", None)
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        
        if branch and store and branch.store_id != store.id:
            raise serializers.ValidationError({
                "branch": "يجب أن يكون الفرع تابعًا لنفس المتجر."
            })

        return attrs

    def validate_user_email(self, value):
        if not value:
            return value

        qs = User.objects.filter(email=value)
        if self.instance and getattr(self.instance, "user_id", None):
            qs = qs.exclude(id=self.instance.user_id)

        if qs.exists():
            raise serializers.ValidationError("البريد الإلكتروني مستخدم بالفعل.")

        return value

    def _update_user(self, instance, validated_data):
        user_data = {}

        if "user_name" in validated_data:
            user_data["name"] = validated_data.pop("user_name")

        if "user_email" in validated_data and validated_data.get("user_email"):
            user_data["email"] = validated_data.pop("user_email")

        if "user_phone" in validated_data:
            user_data["phone"] = validated_data.pop("user_phone")

        if user_data:
            for field, value in user_data.items():
                setattr(instance.user, field, value)
            instance.user.save(update_fields=list(user_data.keys()))

        return validated_data

    def update(self, instance, validated_data):
        validated_data = self._update_user(instance, validated_data)
        return super().update(instance, validated_data)
        
    def get_store_qr_attendance_url(self, obj):
        if obj.store and obj.store.qr_attendance:
            return f"{settings.SITE_URL}{obj.store.qr_attendance.url}"
        return None

    def get_qr_attendance_base64(self, obj):
        try:
            return obj.build_attendance_qr_base64()
        except Exception:
            return getattr(obj, "qr_attendance_base64", None)

    def get_qr_attendance_url(self, obj):
        if obj.qr_attendance:
            return f"{settings.SITE_URL}{obj.qr_attendance.url}"
        return None
    
    def get_is_present(self, obj):
        return AttendanceLog.objects.filter(employee=obj, check_out__isnull=True).exists()