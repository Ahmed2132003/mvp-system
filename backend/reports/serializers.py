# reports/serializers.py
from rest_framework import serializers

class SalesReportSerializer(serializers.Serializer):
    daily_sales = serializers.DecimalField(max_digits=10, decimal_places=2)
    weekly_sales = serializers.DecimalField(max_digits=10, decimal_places=2)
    monthly_sales = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_orders = serializers.IntegerField()

# reports/views.py (أضف)
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .views import sales_report, low_stock_report, top_selling_items

@api_view(['GET'])
def api_reports(request):
    return Response({
        'sales': sales_report(),
        'low_stock': low_stock_report(),
        'top_items': top_selling_items(),
    })