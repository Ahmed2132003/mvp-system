#serializers\order_item.py
from rest_framework import serializers
from ..models import OrderItem

class OrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_price = serializers.DecimalField(source='item.unit_price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'item', 'item_name', 'item_price', 'quantity', 'subtotal']
        read_only_fields = ['subtotal']