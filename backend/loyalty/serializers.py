# loyalty/serializers.py
from rest_framework import serializers
from .models import LoyaltyProgram, CustomerLoyalty, LoyaltyTransaction

class LoyaltyProgramSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_id = serializers.IntegerField(source='store.id', read_only=True)

    class Meta:
        model = LoyaltyProgram
        fields = [
            'id', 'store_id', 'store_name', 'is_active', 'points_per_egp',
            'egp_per_point', 'min_points_to_redeem', 'expiry_months'
        ]


class CustomerLoyaltySerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = CustomerLoyalty
        fields = ['id', 'phone', 'name', 'points', 'total_spent', 'last_visit', 'store_name', 'created_at']
        read_only_fields = ['points', 'total_spent', 'last_visit', 'created_at']


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)

    class Meta:
        model = LoyaltyTransaction
        fields = ['id', 'customer_phone', 'customer_name', 'order', 'type', 'points', 'note', 'created_at']
        read_only_fields = ['created_at']