# core/filters.py
import django_filters
from .models import Employee, User

class EmployeeFilter(django_filters.FilterSet):
    role = django_filters.ChoiceFilter(field_name='user__role', choices=User.RoleChoices.choices)
    store = django_filters.NumberFilter(field_name='store__id')
    name = django_filters.CharFilter(field_name='user__name', lookup_expr='icontains')
    phone = django_filters.CharFilter(field_name='user__phone', lookup_expr='icontains')
    present_today = django_filters.BooleanFilter(method='filter_present_today')

    class Meta:
        model = Employee
        fields = ['role', 'store']

    def filter_present_today(self, queryset, name, value):
        if value:
            return queryset.present_today()
        return queryset