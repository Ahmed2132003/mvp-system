#serializers\payment.py
from rest_framework import serializers
from ..models import Payment

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'gateway', 'amount', 'status', 'transaction_id', 'created_at']
        read_only_fields = ['transaction_id', 'created_at']