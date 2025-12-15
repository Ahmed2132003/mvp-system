# attendance/filters.py
import django_filters
from django_filters import DateFromToRangeFilter
from .models import AttendanceLog

class AttendanceLogFilter(django_filters.FilterSet):
    employee = django_filters.NumberFilter(field_name='employee__id')
    date = django_filters.DateFromToRangeFilter(field_name='check_in')
    method = django_filters.ChoiceFilter(choices=AttendanceLog.METHOD_CHOICES)
    is_late = django_filters.BooleanFilter(method='filter_late')
    present_now = django_filters.BooleanFilter(method='filter_present_now')

    class Meta:
        model = AttendanceLog
        fields = ['employee', 'method']

    def filter_late(self, queryset, name, value):
        if value:
            return queryset.late()  # من الـ QuerySet اللي عملناه قبل كده
        return queryset

    def filter_present_now(self, queryset, name, value):
        if value:
            return queryset.filter(check_out__isnull=True)
        return queryset