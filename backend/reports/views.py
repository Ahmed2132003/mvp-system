# backend/reports/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.db.models import Sum, F, Count
from django.db.models.functions import TruncHour, TruncDate, TruncMonth
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import timedelta

from orders.models import Order, OrderItem, Payment
from inventory.models import Inventory
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from datetime import date

from core.models import PayrollPeriod, EmployeeLedger


def _empty_summary():
    return {
        "sales": {
            "daily": 0.0,
            "weekly": 0.0,
            "monthly": 0.0,
            "total_orders": 0,
            "daily_orders": 0,
            "avg_ticket": 0.0,
        },
        "sales_over_time": [],
        "low_stock": [],
        "top_selling_items": [],
    }


# ==========================
# 1) Summary للـ Dashboard (زي ما هو تقريبا)
# ==========================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_reports(request):
    """
    API Summary للداشبورد:
    - مبيعات اليومية / الأسبوعية / الشهرية
    - عدد الطلبات المدفوعة
    - مبيعات اليوم موزعة على الساعات
    - أعلى الأصناف مبيعًا
    - أصناف قليلة في المخزون
    """
    try:
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        # مبيعات اليوم / الأسبوع / الشهر (طلبات مدفوعة فقط)
        daily_qs = Order.objects.filter(created_at__date=today, status='PAID')
        weekly_qs = Order.objects.filter(created_at__date__gte=week_ago, status='PAID')
        monthly_qs = Order.objects.filter(created_at__date__gte=month_ago, status='PAID')

        daily = daily_qs.aggregate(total=Sum('total'))['total'] or 0
        weekly = weekly_qs.aggregate(total=Sum('total'))['total'] or 0
        monthly = monthly_qs.aggregate(total=Sum('total'))['total'] or 0

        daily_orders_count = daily_qs.count()
        total_orders = Order.objects.filter(status='PAID').count()

        avg_ticket = daily / daily_orders_count if daily_orders_count > 0 else 0

        # مبيعات اليوم موزعة على الساعات
        sales_over_time_qs = (
            daily_qs
            .annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(total=Sum('total'))
            .order_by('hour')
        )

        sales_over_time = [
            {
                "label": f"{row['hour'].hour}:00",
                "value": float(row['total'] or 0),
            }
            for row in sales_over_time_qs
        ]

        # أصناف قليلة في المخزون
        low_stock_qs = Inventory.objects.filter(
            quantity__lt=F('min_stock')
        ).select_related('item', 'branch')

        low_stock_list = [
            {
                'item': inv.item.name,
                'branch': getattr(inv.branch, "name", "غير محدد"),
                'current': inv.quantity,
                'min': inv.min_stock,
            }
            for inv in low_stock_qs
        ]

        # أعلى الأصناف مبيعًا
        top_items_qs = (
            OrderItem.objects
            .filter(order__status='PAID')
            .values('item__name')
            .annotate(total_sold=Sum('quantity'))
            .order_by('-total_sold')[:5]
        )

        top_items = [
            {
                "name": row['item__name'],
                "total_sold": row['total_sold'],
            }
            for row in top_items_qs
        ]

        data = {
            "sales": {
                "daily": float(daily),
                "weekly": float(weekly),
                "monthly": float(monthly),
                "total_orders": total_orders,
                "daily_orders": daily_orders_count,
                "avg_ticket": float(avg_ticket),
            },
            "sales_over_time": sales_over_time,
            "low_stock": low_stock_list,
            "top_selling_items": top_items,
        }

        return Response(data)

    except (ProgrammingError, OperationalError) as e:
        # لو الـtables مش جاهزة
        print("Dashboard summary DB error:", e)
        return Response(_empty_summary())


# ==========================
# 2) Sales Report للـ Reports Page
# ==========================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_report(request):
    """
    تقرير مبيعات مرن للصفحة Reports:
    - فلترة بالتاريخ (from, to)
    - فلترة بالفرع (branch)
    - group_by: day | month
    - summary + series + top_items + payment_breakdown
    """
    try:
        user = request.user
        role = getattr(user, "role", None)

        # أساس الكويري: طلبات مدفوعة فقط
        qs = Order.objects.filter(status='PAID')

        # تقييد حسب المتجر لو المستخدم Employee
        employee = getattr(user, "employee", None)
        if employee and getattr(employee, "store_id", None):
            qs = qs.filter(store=employee.store)
        elif role == "OWNER":
            # صاحب السيستم/المتجر → يشوف الكل (أو نقدر نفلتر بـ store_id من query params لو حبيت بعدين)
            pass
        else:
            qs = qs.none()

        # --- فلترة التاريخ ---
        today = timezone.now().date()
        default_from = today - timedelta(days=30)

        from_param = request.query_params.get("from")
        to_param = request.query_params.get("to")

        from_date = parse_date(from_param) if from_param else default_from
        to_date = parse_date(to_param) if to_param else today

        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)

        # --- فلترة الفرع (اختيارية) ---
        branch_id = request.query_params.get("branch")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        # --- Summary ---
        total_sales = qs.aggregate(total=Sum('total'))['total'] or 0
        total_orders = qs.count()
        avg_ticket = (total_sales / total_orders) if total_orders else 0

        # --- Group by (day / month) ---
        group_by = request.query_params.get("group_by", "day")
        if group_by == "month":
            trunc = TruncMonth('created_at')
        else:
            trunc = TruncDate('created_at')

        series_qs = (
            qs.annotate(period=trunc)
            .values('period')
            .annotate(
                total=Sum('total'),
                orders=Count('id'),
            )
            .order_by('period')
        )

        series = [
            {
                "date": row['period'].strftime('%Y-%m-%d'),
                "total_sales": float(row['total'] or 0),
                "orders": row['orders'],
            }
            for row in series_qs
        ]

        # --- Top Selling Items ---
        top_items_qs = (
            OrderItem.objects
            .filter(order__in=qs)
            .values('item_id', 'item__name')
            .annotate(
                qty_sold=Sum('quantity'),
                total_sales=Sum(F('quantity') * F('unit_price')),
            )
            .order_by('-qty_sold')[:10]
        )

        top_items = [
            {
                "item_id": row['item_id'],
                "name": row['item__name'],
                "qty_sold": row['qty_sold'],
                "total_sales": float(row['total_sales'] or 0),
            }
            for row in top_items_qs
        ]

        # --- Payment breakdown ---
        payments_qs = (
            Payment.objects
            .filter(order__in=qs, status='SUCCESS')
            .values('gateway')
            .annotate(
                amount=Sum('amount'),
                count=Count('id'),
            )
        )

        payment_breakdown = [
            {
                "gateway": row['gateway'],
                "amount": float(row['amount'] or 0),
                "count": row['count'],
            }
            for row in payments_qs
        ]

        data = {
            "summary": {
                "from": from_date.isoformat() if from_date else None,
                "to": to_date.isoformat() if to_date else None,
                "total_sales": float(total_sales or 0),
                "total_orders": total_orders,
                "avg_ticket": float(avg_ticket or 0),
            },
            "series": series,
            "top_items": top_items,
            "payment_breakdown": payment_breakdown,
        }

        return Response(data)

    except (ProgrammingError, OperationalError) as e:
        print("Sales report DB error:", e)
        return Response({
            "summary": {
                "from": None,
                "to": None,
                "total_sales": 0.0,
                "total_orders": 0,
                "avg_ticket": 0.0,
            },
            "series": [],
            "top_items": [],
            "payment_breakdown": [],
        })
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_accounting(request):
    """
    Returns accounting summary:
    - total_salaries (locked payrolls sum)
    - total_penalties (ledger PENALTY sum)
    - total_advances (ledger ADVANCE sum)
    - total_bonuses (ledger BONUS sum)
    - net_out (salaries + bonuses - penalties - advances)  [simple view]
    """

    # optional: month query ?month=2025-12-01
    month_str = request.query_params.get('month')
    month_date = None
    if month_str:
        try:
            y, m, d = month_str.split('-')
            month_date = date(int(y), int(m), int(d))
        except Exception:
            month_date = None

    payroll_qs = PayrollPeriod.objects.filter(is_locked=True)
    ledger_qs = EmployeeLedger.objects.all()

    if month_date:
        payroll_qs = payroll_qs.filter(month=month_date)
        # لو حابب تربط الليدجر بالـ payroll لنفس الشهر:
        ledger_qs = ledger_qs.filter(payroll__month=month_date)

    total_salaries = payroll_qs.aggregate(v=Sum('net_salary'))['v'] or 0
    total_penalties = ledger_qs.filter(entry_type='PENALTY').aggregate(v=Sum('amount'))['v'] or 0
    total_advances = ledger_qs.filter(entry_type='ADVANCE').aggregate(v=Sum('amount'))['v'] or 0
    total_bonuses = ledger_qs.filter(entry_type='BONUS').aggregate(v=Sum('amount'))['v'] or 0

    net_out = (total_salaries + total_bonuses) - (total_penalties + total_advances)

    return Response({
        "month": month_date,
        "total_salaries": total_salaries,
        "total_penalties": total_penalties,
        "total_advances": total_advances,
        "total_bonuses": total_bonuses,
        "net_out": net_out,
        "generated_at": timezone.now(),
    })
