from rest_framework import serializers
from ..models import CustomerLoyalty

class CustomerLoyaltySerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = CustomerLoyalty
        fields = ['id', 'phone', 'name', 'points', 'total_spent', 'last_visit', 'store_name']
        read_only_fields = ['points', 'total_spent', 'last_visit']