from rest_framework import serializers

from ..models import Invoice
from .order_item import OrderItemSerializer


class InvoiceSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(source='order.items', many=True, read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, allow_null=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    table_number = serializers.CharField(source='order.table.number', read_only=True, allow_null=True)
    order_status = serializers.CharField(source='order.status', read_only=True)
    payment_method = serializers.CharField(source='order.payment_method', read_only=True)
    order_created_at = serializers.DateTimeField(source='order.created_at', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'order_id',
            'store',
            'store_name',
            'branch',
            'branch_name',
            'customer_name',
            'customer_phone',
            'order_type',
            'payment_method',
            'delivery_address',
            'notes',
            'total',
            'created_at',
            'order_created_at',
            'order_status',
            'table_number',
            'items',
        ]
        read_only_fields = [
            'invoice_number',
            'order_id',
            'store',
            'store_name',
            'branch_name',
            'created_at',
            'order_created_at',
            'order_status',
            'table_number',
            'items',
        ]