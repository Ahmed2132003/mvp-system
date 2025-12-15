#backend\serializers\inventory.py
from rest_framework import serializers
from ..models import Inventory , Item
from .item import ItemSerializer

class InventorySerializer(serializers.ModelSerializer):
    item = ItemSerializer(read_only=True)
    item_id = serializers.PrimaryKeyRelatedField(
        queryset=Item.objects.all(),  # دلوقتي Item معروف
        source='item',
        write_only=True
    )
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = Inventory
        fields = ['id', 'item', 'item_id', 'branch', 'branch_name', 'quantity', 'min_stock', 'is_low', 'last_updated']
        read_only_fields = ['is_low', 'last_updated']