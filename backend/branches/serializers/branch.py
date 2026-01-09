# branches/serializers.py
from rest_framework import serializers
from ..models import Branch  # صح لو الملف في نفس الـ app


class BranchSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_id = serializers.IntegerField(source='store.id', read_only=True)

    class Meta:
        model = Branch
        fields = [
            'id',
            'name',
            'store',
            'store_id',
            'store_name',
            'address',
            'phone',
            'is_active',
            'qr_menu',
            'qr_menu_base64',
            'opening_time',
            'closing_time',
            'attendance_penalty_per_15min',
        ]                   
        read_only_fields = ['store']  # الموظف ما يغيّرش المتجر من هنا
        
    # اختياري: لو عايز تمنع إنشاء فرع من غير store (للـ create)
    def create(self, validated_data):
        # في الـ view هنحدد الـ store من اليوزر، بس لو جاء في الـ payload هنتأكد
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                validated_data['store'] = request.user.employee.store
            except:
                pass
        return super().create(validated_data)