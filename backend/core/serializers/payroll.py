from rest_framework import serializers
from core.models import PayrollPeriod

class PayrollPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriod
        fields = [
            'id',
            'employee',
            'month',
            'base_salary',
            'penalties',
            'late_penalties',
            'bonuses',
            'advances',
            'net_salary',
            'is_locked',
            'created_at',            
        ]
        read_only_fields = ['net_salary', 'created_at', 'is_locked']
