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
            'order_type', 'payment_method', 'is_paid', 'delivery_address',   # ✅
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

    def create(self, validated_data):
        # Handle nested order items creation explicitly
        items_data = validated_data.pop('items', [])
        requested_status = validated_data.pop('status', None)
        is_paid = validated_data.pop('is_paid', False) or requested_status == 'PAID'

        # Always start new orders as PENDING so they appear in the KDS as "جديد"
        validated_data['status'] = 'PENDING'

        order = Order.objects.create(is_paid=is_paid, **validated_data)

        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)

        # Totals are recalculated after each item save, but ensure consistency
        order.update_total()
        return order

    def update(self, instance, validated_data):
        # لو المستخدم علّم الطلب كـ PAID في الـ POS، نسجل الدفع لكن نكمل دورة الـ KDS
        new_status = validated_data.get('status', instance.status)
        if new_status == 'PAID':
            validated_data.setdefault('is_paid', True)

            # لو الطلب لسه جديد أو قيد التحضير نخليه يكمل السايكل بدل ما يختفي من الـ KDS
            if instance.status in ['PENDING', 'PREPARING']:
                validated_data['status'] = instance.status

        return super().update(instance, validated_data)