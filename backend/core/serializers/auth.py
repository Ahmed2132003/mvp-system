# core/serializers/auth.py
from rest_framework import serializers
from ..models import User, Employee
from core.models import Store


class RegisterUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=User.RoleChoices.choices, default=User.RoleChoices.STAFF)

    # ✅ جديد: اختيار الفرع للموظف/المدير
    store_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['name', 'email', 'phone', 'role', 'password', 'store_id']

    def validate(self, data):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("يجب تسجيل الدخول أولاً")

        current_user = request.user
        requested_role = data['role']
        store_id = data.get('store_id', None)

        # سوبر يوزر: يقدر يعمل أي حاجة لكن لو بيعمل MANAGER/STAFF لازم يحدد store_id
        if current_user.is_superuser:
            if requested_role != User.RoleChoices.OWNER and not store_id:
                raise serializers.ValidationError("يجب اختيار الفرع (store_id) للموظف/المدير.")
            return data

        # OWNER: يقدر يضيف MANAGER أو STAFF فقط
        if current_user.role == User.RoleChoices.OWNER:
            if requested_role not in [User.RoleChoices.MANAGER, User.RoleChoices.STAFF]:
                raise serializers.ValidationError("صاحب المكان يقدر يضيف مدير أو موظف بس")

            # ✅ owner لازم يحدد store_id (عشان عنده أكتر من ستور)
            if not store_id:
                raise serializers.ValidationError("يجب اختيار الفرع (store_id) للموظف/المدير.")
            return data

        # MANAGER: يقدر يضيف STAFF فقط (والستور = ستور المدير تلقائيًا)
        if current_user.role == User.RoleChoices.MANAGER:
            if requested_role != User.RoleChoices.STAFF:
                raise serializers.ValidationError("المدير يقدر يضيف موظفين بس")
            # هنا store_id مش مطلوب (هناخده تلقائيًا من employee.store)
            return data

        raise serializers.ValidationError("ليس لديك صلاحية لإنشاء حسابات")

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role')
        store_id = validated_data.pop('store_id', None)

        user = User(**validated_data)
        user.set_password(password)
        user.role = role
        user.is_active = False
        user.save()

        store = None
        current_user = self.context['request'].user

        # ✅ تحديد الستور حسب من أنشأ الحساب
        try:
            current_user_store = getattr(getattr(current_user, 'employee', None), 'store', None)
        except Exception:
            current_user_store = None

        # سوبر يوزر
        if current_user.is_superuser:
            if role != User.RoleChoices.OWNER:
                if not store_id:
                    user.delete()
                    raise serializers.ValidationError("يجب تحديد store_id.")
                store = Store.objects.filter(id=store_id).first()

        # OWNER
        elif current_user.role == User.RoleChoices.OWNER:
            if role != User.RoleChoices.OWNER:
                if not store_id:
                    user.delete()
                    raise serializers.ValidationError("يجب تحديد store_id.")
                store = Store.objects.filter(id=store_id, owner=current_user).first()

        # MANAGER
        elif current_user.role == User.RoleChoices.MANAGER:
            if role != User.RoleChoices.OWNER:
                # ✅ ياخد نفس ستور المدير تلقائيًا
                store = current_user_store

        # ✅ لو ماقدرناش نجيب store للموظف/المدير → نلغي اليوزر
        if role != User.RoleChoices.OWNER and not store:
            user.delete()
            raise serializers.ValidationError("لا يوجد فرع مرتبط بحسابك أو الفرع غير صحيح.")

        # ✅ إنشاء Employee وربطه بالستور إجباري
        if role != User.RoleChoices.OWNER and store:
            Employee.objects.get_or_create(user=user, defaults={'store': store})

        # إرسال لينك التفعيل
        user.send_verification_link()

        return user

    def to_representation(self, instance):
        return {
            "message": "تم إنشاء الحساب بنجاح! تم إرسال رابط التفعيل على الإيميل.",
            "email": instance.email
        }
