from rest_framework import serializers
from ..models import LoyaltyTransaction

class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    class Meta:
        model = LoyaltyTransaction
        fields = ['id', 'customer', 'customer_phone', 'order', 'type', 'points', 'created_at']
        read_only_fields = ['created_at']