from rest_framework import serializers
from core.models import Store, User, Employee
from .settings import StoreSettingsSerializer


class StoreSerializer(serializers.ModelSerializer):
    settings = StoreSettingsSerializer(read_only=True)
    branches_count = serializers.IntegerField(source='branches.count', read_only=True)
    employees_count = serializers.IntegerField(source='employees.count', read_only=True)

    def validate_paymob_keys(self, value):
        """
        paymob_keys schema:
        {
          "enabled": bool,
          "sandbox_mode": bool,
          "api_key": str,
          "iframe_id": str,
          "integration_id_card": str/int,
          "integration_id_wallet": str/int,
          "hmac_secret": str
        }
        """
        value = value or {}
        enabled = bool(value.get("enabled", False))

        if not enabled:
            return {
                "enabled": False,
                "sandbox_mode": value.get("sandbox_mode", True),
                "api_key": value.get("api_key", "") or "",
                "iframe_id": value.get("iframe_id", "") or "",
                "integration_id_card": value.get("integration_id_card", "") or "",
                "integration_id_wallet": value.get("integration_id_wallet", "") or "",
                "hmac_secret": value.get("hmac_secret", "") or "",
            }

        required = ["api_key", "iframe_id", "integration_id_card", "hmac_secret"]
        missing = []

        for k in required:
            v = value.get(k, "")
            if v is None or str(v).strip() == "":
                missing.append(k)

        if missing:
            raise serializers.ValidationError(
                f"لا يمكن تفعيل PayMob بدون إدخال: {', '.join(missing)}"
            )

        return value

    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'address',
            'phone',
            'paymob_keys',

            # Menu QR
            'qr_menu',
            'qr_menu_base64',

            # ✅ Attendance QR (Unified Store QR)
            'qr_attendance',
            'qr_attendance_base64',

            'settings',
            'branches_count',
            'employees_count',
        ]


# ============================
# ✅ جديد — سوبر يوزر فقط
# ============================
class StoreCreateSerializer(serializers.ModelSerializer):
    """
    السوبر يوزر بيعمل Store
    وبيختار Owner أو Manager من قاعدة البيانات
    """

    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=['OWNER', 'MANAGER']),
        write_only=True
    )

    class Meta:
        model = Store
        fields = [
            'name',
            'address',
            'phone',
            'paymob_keys',
            'owner_id',
        ]

    def create(self, validated_data):
        owner_or_manager = validated_data.pop('owner_id')

        store = Store.objects.create(
            owner=owner_or_manager if owner_or_manager.role == 'OWNER' else None,
            **validated_data
        )

        # لو Manager → نربطه كموظف في الفرع
        if owner_or_manager.role == 'MANAGER':
            emp, _ = Employee.objects.get_or_create(user=owner_or_manager)
            emp.store = store
            emp.save()

        return store
