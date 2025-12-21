from django.urls import path
from .views import api_accounting, api_reports, compare_sales_periods, expense_summary, period_sales_statistics, sales_report

urlpatterns = [
    # Summary للداشبورد
    path('', api_reports, name='api_reports'),
    path('api/reports/', api_reports, name='api_reports_v1'),  # لو كنت بتستخدمه قبل كده

    # تقرير المبيعات للـ Reports Page
    path('sales/', sales_report, name='sales_report'),
    path('sales/period-stats/', period_sales_statistics, name='period_sales_statistics'),
    path('sales/compare/', compare_sales_periods, name='compare_sales_periods'),
    path('accounting/', api_accounting, name='api_reports_accounting'),
    path('expenses/', expense_summary, name='expense_summary'),

]