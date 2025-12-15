#backend\serializers\item.py
from rest_framework import serializers
from ..models import Item

class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = Item
        fields = ['id', 'name', 'category', 'category_name', 'unit_price', 'cost_price', 'barcode', 'store', 'is_active']
        read_only_fields = ['store']