from django.urls import path
from .views import api_accounting, api_reports, period_sales_statistics, sales_report

urlpatterns = [
    # Summary للداشبورد
    path('', api_reports, name='api_reports'),
    path('api/reports/', api_reports, name='api_reports_v1'),  # لو كنت بتستخدمه قبل كده

    # تقرير المبيعات للـ Reports Page
    path('sales/', sales_report, name='sales_report'),
    path('sales/period-stats/', period_sales_statistics, name='period_sales_statistics'),
    path('accounting/', api_accounting, name='api_reports_accounting'),

]