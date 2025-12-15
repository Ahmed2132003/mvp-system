from rest_framework import serializers
from core.models import EmployeeLedger


class EmployeeLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeLedger
        fields = [
            'id',
            'employee',
            'payroll',
            'entry_type',
            'amount',
            'description',
            'created_at',
        ]
        read_only_fields = ['created_at']
