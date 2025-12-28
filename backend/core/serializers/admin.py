from rest_framework import serializers

from core.models import User


class AdminUserSerializer(serializers.ModelSerializer):
    owned_stores = serializers.SerializerMethodField()
    employee_store = serializers.SerializerMethodField()
    trial_days_left = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "phone",
            "role",
            "is_active",
            "is_superuser",
            "is_payment_verified",
            "trial_starts_at",
            "trial_ends_at",
            "trial_days_left",
            "is_trial_expired",
            "has_active_access",
            "access_block_reason",
            "owned_stores",
            "employee_store",
            "date_joined",
        ]
        read_only_fields = ["is_superuser", "date_joined"]

    def get_owned_stores(self, obj: User):
        return [{"id": s.id, "name": s.name} for s in obj.owned_stores.all()]

    def get_employee_store(self, obj: User):
        try:
            emp = obj.employee
        except Exception:
            return None

        if not emp or not emp.store_id:
            return None

        return {"id": emp.store_id, "name": getattr(emp.store, "name", None)}

    def get_trial_days_left(self, obj: User):
        return getattr(obj, "trial_days_left", None)

    def update(self, instance, validated_data):
        response = super().update(instance, validated_data)
        # تأكيد تحديث فترة التجربة لو رجّعنا الحساب لحالة غير مفعّلة
        instance.ensure_trial_window()
        instance.save(update_fields=["trial_starts_at", "trial_ends_at"])
        return response