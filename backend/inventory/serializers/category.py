#backend\serializers\category.py
from rest_framework import serializers
from ..models import Category

class CategorySerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'store', 'is_active', 'items_count']