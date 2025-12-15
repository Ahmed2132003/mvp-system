# backend/reports/utils.py
from .views import sales_report, low_stock_report, top_selling_items

def get_all_reports():
    return {
        'sales': sales_report(),
        'low_stock': low_stock_report(),
        'top_items': top_selling_items(),
    }