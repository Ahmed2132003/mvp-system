#serializers\order.py
from rest_framework import serializers
from ..models import Order
from .order_item import OrderItemSerializer
from .payment import PaymentSerializer
from ..models import OrderItem

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    items_write = OrderItemSerializer(many=True, source='items', write_only=True)
    table_number = serializers.CharField(source='table.number', read_only=True, allow_null=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'store', 'branch', 'branch_name', 'table', 'table_number',
            'customer_name', 'customer_phone',
            'order_type', 'payment_method', 'delivery_address',   # ✅
            'total', 'status', 'created_at',
            'updated_at', 'notes', 'items', 'items_write', 'payments'
        ]
        read_only_fields = ['total', 'created_at', 'updated_at', 'store', 'branch']
        
    def validate(self, data):
        order_type = data.get('order_type', 'IN_STORE')
        delivery_address = data.get('delivery_address')

        if order_type == 'DELIVERY' and not delivery_address:
            raise serializers.ValidationError({
                "delivery_address": "العنوان مطلوب في حالة الدليفري."
            })

        return data
