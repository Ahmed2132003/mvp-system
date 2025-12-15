import django_filters
from django_filters import CharFilter, NumberFilter
from .models import Category, Item, Inventory


class CategoryFilter(django_filters.FilterSet):
    name = CharFilter(lookup_expr='icontains')

    class Meta:
        model = Category
        fields = ['name', 'is_active']


class ItemFilter(django_filters.FilterSet):
    name = CharFilter(lookup_expr='icontains')
    price_min = NumberFilter(field_name='unit_price', lookup_expr='gte')
    price_max = NumberFilter(field_name='unit_price', lookup_expr='lte')
    category = django_filters.ModelChoiceFilter(queryset=Category.objects.all())
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Item
        fields = ['name', 'category', 'is_active']


class InventoryFilter(django_filters.FilterSet):
    item_name = CharFilter(field_name='item__name', lookup_expr='icontains')
    branch = NumberFilter(field_name='branch_id')
    min_quantity = NumberFilter(field_name='quantity', lookup_expr='gte')
    max_quantity = NumberFilter(field_name='quantity', lookup_expr='lte')

    class Meta:
        model = Inventory
        fields = ['item', 'branch', 'quantity', 'is_low']
