# backend/orders/filters.py

import django_filters
from django_filters import CharFilter, DateTimeFilter, ChoiceFilter
from .models import Order, Table, Reservation


class OrderFilter(django_filters.FilterSet):
    status = ChoiceFilter(choices=Order.STATUS_CHOICES)
    customer_name = CharFilter(lookup_expr='icontains')
    table = django_filters.NumberFilter()
    branch = django_filters.NumberFilter()
    date_from = DateTimeFilter(field_name='created_at', lookup_expr='gte')
    date_to = DateTimeFilter(field_name='created_at', lookup_expr='lte')

    # ✅ إصلاح: total بدل total_price
    min_total = django_filters.NumberFilter(field_name='total', lookup_expr='gte')
    max_total = django_filters.NumberFilter(field_name='total', lookup_expr='lte')

    class Meta:
        model = Order
        fields = ['status', 'table', 'branch', 'customer_name']


class TableFilter(django_filters.FilterSet):
    number = CharFilter(lookup_expr='icontains')
    is_available = django_filters.BooleanFilter()

    class Meta:
        model = Table
        fields = ['number', 'capacity', 'is_available']


class ReservationFilter(django_filters.FilterSet):
    status = ChoiceFilter(choices=Reservation.STATUS_CHOICES)
    table = django_filters.NumberFilter()
    customer_name = CharFilter(lookup_expr='icontains')
    date_from = DateTimeFilter(field_name='reservation_time', lookup_expr='gte')
    date_to = DateTimeFilter(field_name='reservation_time', lookup_expr='lte')

    class Meta:
        model = Reservation
        fields = ['status', 'table', 'customer_name']
