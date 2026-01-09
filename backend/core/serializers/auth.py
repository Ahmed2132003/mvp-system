# core/serializers/auth.py
from rest_framework import serializers
from ..models import User, Employee
from core.models import Store


class RegisterUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=User.RoleChoices.choices, default=User.RoleChoices.STAFF)

    # ✅ جديد: اختيار الفرع للموظف/المدير
    store_id = serializers.IntegerField(required=False, allow_null=True)
    # ✅ اختيار إنشاء فرع جديد
    create_store = serializers.BooleanField(required=False, default=False)
    store_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    store_address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    store_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    class Meta:
        model = User
        fields = [
            'name',
            'email',
            'phone',
            'role',
            'password',
            'store_id',
            'create_store',
            'store_name',
            'store_address',
            'store_phone',
        ]
        
    def validate(self, data):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("يجب تسجيل الدخول أولاً")

        current_user = request.user
        requested_role = data['role']
        store_id = data.get('store_id', None)
        create_store = data.get('create_store', False)
        store_name = data.get('store_name')

        # سوبر يوزر: يقدر يعمل أي حاجة لكن لو بيعمل MANAGER/STAFF لازم يحدد store_id
        if current_user.is_superuser:
            if store_id and create_store:
                raise serializers.ValidationError("اختر فرع موجود أو إنشاء فرع جديد، ليس كلاهما.")
            if requested_role in [User.RoleChoices.OWNER, User.RoleChoices.MANAGER]:
                if not store_id and not create_store:
                    raise serializers.ValidationError("يجب اختيار فرع موجود أو إنشاء فرع جديد.")
                if create_store and not store_name:
                    raise serializers.ValidationError("يجب إدخال اسم الفرع عند إنشاء فرع جديد.")
            elif requested_role == User.RoleChoices.STAFF and not store_id:
                raise serializers.ValidationError("يجب اختيار الفرع (store_id) للموظف/المدير.")
            return data

        # OWNER: يقدر يضيف MANAGER أو STAFF فقط
        if current_user.role == User.RoleChoices.OWNER:
            if create_store:
                raise serializers.ValidationError("لا يمكن إنشاء فرع جديد من حساب المالك.")
            if requested_role not in [User.RoleChoices.MANAGER, User.RoleChoices.STAFF]:
                raise serializers.ValidationError("صاحب المكان يقدر يضيف مدير أو موظف بس")
            
            # ✅ owner لازم يحدد store_id (عشان عنده أكتر من ستور)
            if not store_id:
                raise serializers.ValidationError("يجب اختيار الفرع (store_id) للموظف/المدير.")
            return data

        # MANAGER: يقدر يضيف STAFF فقط (والستور = ستور المدير تلقائيًا)
        if current_user.role == User.RoleChoices.MANAGER:
            if create_store:
                raise serializers.ValidationError("لا يمكن إنشاء فرع جديد من حساب المدير.")
            if requested_role != User.RoleChoices.STAFF:
                raise serializers.ValidationError("المدير يقدر يضيف موظفين بس")            
            # هنا store_id مش مطلوب (هناخده تلقائيًا من employee.store)
            return data

        raise serializers.ValidationError("ليس لديك صلاحية لإنشاء حسابات")

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role')
        store_id = validated_data.pop('store_id', None)
        create_store = validated_data.pop('create_store', False)
        store_name = validated_data.pop('store_name', None)
        store_address = validated_data.pop('store_address', None)
        store_phone = validated_data.pop('store_phone', None)

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
            if create_store and role in [User.RoleChoices.OWNER, User.RoleChoices.MANAGER]:
                store = Store.objects.create(
                    name=store_name,
                    address=store_address,
                    phone=store_phone,
                    owner=user if role == User.RoleChoices.OWNER else None,
                )
            elif store_id:
                store = Store.objects.filter(id=store_id).first()
                if store and role == User.RoleChoices.OWNER:
                    store.owner = user
                    store.save(update_fields=["owner"])
            elif role != User.RoleChoices.OWNER:
                user.delete()
                raise serializers.ValidationError("يجب تحديد store_id.")

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

        # ✅ لو ماقدرناش نجيب store للموظف/المدير → نلغي اليوزر␊
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
