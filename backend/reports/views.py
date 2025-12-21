# backend/reports/views.py
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, F, Count, Q, Value, DecimalField
from django.db.models.functions import TruncHour, TruncDate, TruncMonth, Coalesce
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import EmployeeLedger, PayrollPeriod
from inventory.models import Inventory, InventoryMovement, Item
from orders.models import Order, OrderItem, Payment
from attendance.models import AttendanceLog
from core.models import Employee
from core.utils.store_context import get_branch_from_request, get_store_from_request
from collections import defaultdict


def _resolve_inventory_period(now, period_type_param, period_value_param):
    period_type = (period_type_param or "day").lower()
    if period_type not in {"day", "month", "year"}:
        period_type = "day"

    today = now.date()

    if period_type == "day":
        target_date = parse_date(period_value_param) or today
        start_date = target_date
        end_date = target_date
        normalized_value = target_date.isoformat()
    elif period_type == "month":
        parsed_month = None
        if period_value_param:
            parsed_month = parse_date(f"{period_value_param}-01") or parse_date(period_value_param)

        parsed_month = parsed_month or today.replace(day=1)
        days_in_month = monthrange(parsed_month.year, parsed_month.month)[1]
        start_date = parsed_month
        end_date = parsed_month.replace(day=days_in_month)
        normalized_value = parsed_month.strftime("%Y-%m")
    else:
        try:
            parsed_year = int(period_value_param)
        except (TypeError, ValueError):
            parsed_year = today.year

        start_date = date(parsed_year, 1, 1)
        end_date = date(parsed_year, 12, 31)
        normalized_value = str(parsed_year)

    days_in_period = (end_date - start_date).days + 1
    return period_type, normalized_value, start_date, end_date, days_in_period

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

        paid_filter = Q(status='PAID') | Q(is_paid=True)

        # مبيعات اليوم / الأسبوع / الشهر (طلبات مدفوعة فقط)
        daily_qs = Order.objects.filter(created_at__date=today).filter(paid_filter)
        weekly_qs = Order.objects.filter(created_at__date__gte=week_ago).filter(paid_filter)
        monthly_qs = Order.objects.filter(created_at__date__gte=month_ago).filter(paid_filter)

        daily = daily_qs.aggregate(total=Sum('total'))['total'] or 0
        weekly = weekly_qs.aggregate(total=Sum('total'))['total'] or 0
        monthly = monthly_qs.aggregate(total=Sum('total'))['total'] or 0

        daily_orders_count = daily_qs.count()
        total_orders = Order.objects.filter(paid_filter).count()

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
            .filter(Q(order__status='PAID') | Q(order__is_paid=True))
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


def _parse_period_filter(now, period_type, period_value, request):
    """
    Return normalized period_type, period_value (string) and filter kwargs
    using dynamic lookups like created_at__date / __month / __year.
    """
    lookup_map = {
        "day": "created_at__date",
        "month": "created_at__month",
        "year": "created_at__year",
    }
    reverse_lookup = {v: k for k, v in lookup_map.items()}

    # Highest priority: explicit created_at__* query params
    for lookup in lookup_map.values():
        if lookup in request.query_params:
            raw_value = request.query_params.get(lookup)
            parsed_value, normalized = _parse_lookup_value(lookup, raw_value, now)
            return reverse_lookup[lookup], normalized, {lookup: parsed_value}

    # Fallback to period_type / period_value params
    clean_period_type = (period_type or "day").lower()
    if clean_period_type not in lookup_map:
        clean_period_type = "day"

    filter_lookup = lookup_map[clean_period_type]
    parsed_value, normalized = _parse_lookup_value(filter_lookup, period_value, now)

    return clean_period_type, normalized, {filter_lookup: parsed_value}


def _parse_lookup_value(lookup, raw_value, now):
    """
    Normalize lookup values for date/month/year filters.
    Returns (value_for_filter, normalized_value_for_response_as_str)
    """
    if lookup.endswith("__date"):
        parsed = parse_date(raw_value) if raw_value else None
        parsed = parsed or now.date()
        return parsed, parsed.isoformat()

    default_int = now.date().month if lookup.endswith("__month") else now.date().year
    parsed_int = default_int

    if raw_value:
        try:
            parsed_int = int(raw_value)
        except (TypeError, ValueError):
            # accept yyyy-mm formatted month values
            if "-" in str(raw_value):
                possible_date = parse_date(f"{raw_value}-01")
                if possible_date:
                    parsed_int = possible_date.month if lookup.endswith("__month") else possible_date.year
    if lookup.endswith("__month") and not (1 <= parsed_int <= 12):
        parsed_int = default_int
    return parsed_int, str(parsed_int)

def _parse_period_for_field(date_field, period_type_param, period_value_param, now, use_date_lookup=True):
    """
    Normalize period filters for arbitrary date/datetime fields.
    Returns (period_type, normalized_value, filter_kwargs).
    """
    period_type = (period_type_param or "day").lower()
    if period_type not in {"day", "month", "year"}:
        period_type = "day"

    if period_type == "day":
        parsed_date = parse_date(period_value_param) or now.date()
        filter_key = f"{date_field}__date" if use_date_lookup else date_field
        return period_type, parsed_date.isoformat(), {filter_key: parsed_date}

    if period_type == "month":
        parsed_month = None
        if period_value_param:
            parsed_month = parse_date(f"{period_value_param}-01") or parse_date(period_value_param)
        parsed_month = parsed_month or now.date().replace(day=1)
        return (
            period_type,
            parsed_month.strftime("%Y-%m"),
            {
                f"{date_field}__year": parsed_month.year,
                f"{date_field}__month": parsed_month.month,
            },
        )

    # year
    try:
        parsed_year = int(period_value_param)
    except (TypeError, ValueError):
        parsed_year = now.date().year

    return period_type, str(parsed_year), {f"{date_field}__year": parsed_year}


def _preset_period_range(today, preset_key):
    current_week_start = today - timedelta(days=today.weekday())
    current_month_start = today.replace(day=1)

    if preset_key == "today":
        return today, today
    if preset_key == "yesterday":
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    if preset_key == "current_week":
        return current_week_start, current_week_start + timedelta(days=6)
    if preset_key == "previous_week":
        previous_week_end = current_week_start - timedelta(days=1)
        previous_week_start = previous_week_end - timedelta(days=6)
        return previous_week_start, previous_week_end
    if preset_key == "current_month":
        days_in_month = monthrange(today.year, today.month)[1]
        return current_month_start, current_month_start.replace(day=days_in_month)
    if preset_key == "previous_month":
        prev_month = today.month - 1 or 12
        prev_year = today.year if today.month > 1 else today.year - 1
        prev_month_start = date(prev_year, prev_month, 1)
        prev_days = monthrange(prev_year, prev_month)[1]
        return prev_month_start, prev_month_start.replace(day=prev_days)

    # Default: fallback to today
    return today, today


def _resolve_period(request, prefix, now):
    preset_key = (request.query_params.get(f"{prefix}_preset") or "").lower()
    start_param = request.query_params.get(f"{prefix}_start")
    end_param = request.query_params.get(f"{prefix}_end")

    today = now.date()

    if preset_key:
        start_date, end_date = _preset_period_range(today, preset_key)
        label = preset_key
    else:
        start_date = parse_date(start_param) or today
        end_date = parse_date(end_param) or start_date
        label = "custom"

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    return label, start_date, end_date


def _serialize_products(rows):
    return [
        {
            "product_id": row["item_id"],
            "name": row["item__name"],
            "total_quantity": row["total_quantity"] or 0,
            "order_lines": row["order_lines"],
            "total_sales": float(row["total_sales"] or 0),
        }
        for row in rows
    ]


def _period_metrics(orders_qs, limit):
    total_sales = orders_qs.aggregate(total=Sum("total"))['total'] or 0
    orders_count = orders_qs.count()
    avg_order_value = (total_sales / orders_count) if orders_count else 0

    items_qs = (
        OrderItem.objects.filter(order__in=orders_qs)
        .values("item_id", "item__name")
        .annotate(
            total_quantity=Sum("quantity"),
            order_lines=Count("id"),
            total_sales=Sum(F("quantity") * F("unit_price")),
        )
        .exclude(item_id__isnull=True)
    )

    top_rows = list(items_qs.order_by("-total_quantity", "item__name")[:limit])
    bottom_rows = list(items_qs.order_by("total_quantity", "item__name")[:limit])

    return {
        "total_sales": float(total_sales or 0),
        "total_orders": orders_count,
        "avg_order_value": round(float(avg_order_value or 0), 2),
        "top_products": _serialize_products(top_rows),
        "bottom_products": _serialize_products(bottom_rows),
    }


def _delta(current, previous):
    absolute = float(current) - float(previous)
    if previous == 0:
        percentage = None if absolute != 0 else 0.0
    else:
        percentage = round((absolute / float(previous)) * 100, 2)

    return {
        "absolute": round(absolute, 2),
        "percentage": percentage,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def compare_sales_periods(request):
    """
    مقارنة فترتين زمنيتين (مخصصة أو Preset) مع حساب الفروق.
    - period_a_preset / period_b_preset: today | yesterday | current_week | previous_week | current_month | previous_month
    - أو period_a_start / period_a_end (و نفس الشيء لـ period_b_*)
    - limit: عدد المنتجات الأعلى/الأقل مبيعًا في كل فترة
    """
    try:
        now = timezone.now()
        limit_param = request.query_params.get("limit")
        try:
            limit = int(limit_param) if limit_param is not None else 5
            if limit <= 0:
                limit = 5
        except (TypeError, ValueError):
            limit = 5

        label_a, start_a, end_a = _resolve_period(request, "period_a", now)
        label_b, start_b, end_b = _resolve_period(request, "period_b", now)

        paid_filter = Q(status="PAID") | Q(is_paid=True)
        qs = Order.objects.filter(paid_filter)

        user = request.user
        role = getattr(user, "role", None)
        employee = getattr(user, "employee", None)

        if employee and getattr(employee, "store_id", None):
            qs = qs.filter(store=employee.store)
        elif hasattr(user, "owned_stores") and user.owned_stores.exists():
            qs = qs.filter(store_id__in=user.owned_stores.values_list("id", flat=True))
        elif role == "OWNER" or role is None or getattr(user, "is_superuser", False):
            pass
        else:
            qs = qs.none()

        store_id = request.query_params.get("store_id")
        branch_id = request.query_params.get("branch")
        if store_id:
            qs = qs.filter(store_id=store_id)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        period_a_qs = qs.filter(
            created_at__date__gte=start_a,
            created_at__date__lte=end_a,
        )
        period_b_qs = qs.filter(
            created_at__date__gte=start_b,
            created_at__date__lte=end_b,
        )

        period_a_metrics = _period_metrics(period_a_qs, limit)
        period_b_metrics = _period_metrics(period_b_qs, limit)

        deltas = {
            "total_sales": _delta(period_a_metrics["total_sales"], period_b_metrics["total_sales"]),
            "total_orders": _delta(period_a_metrics["total_orders"], period_b_metrics["total_orders"]),
            "avg_order_value": _delta(period_a_metrics["avg_order_value"], period_b_metrics["avg_order_value"]),
        }

        response_data = {
            "period_a": {
                "label": label_a,
                "start": start_a.isoformat(),
                "end": end_a.isoformat(),
                **period_a_metrics,
            },
            "period_b": {
                "label": label_b,
                "start": start_b.isoformat(),
                "end": end_b.isoformat(),
                **period_b_metrics,
            },
            "deltas": deltas,
        }

        return Response(response_data)
    except (ProgrammingError, OperationalError) as e:
        print("Compare sales DB error:", e)
        return Response(
            {
                "period_a": {
                    "label": "custom",
                    "start": None,
                    "end": None,
                    "total_sales": 0.0,
                    "total_orders": 0,
                    "avg_order_value": 0.0,
                    "top_products": [],
                    "bottom_products": [],
                },
                "period_b": {
                    "label": "custom",
                    "start": None,
                    "end": None,
                    "total_sales": 0.0,
                    "total_orders": 0,
                    "avg_order_value": 0.0,
                    "top_products": [],
                    "bottom_products": [],
                },
                "deltas": {
                    "total_sales": {"absolute": 0.0, "percentage": None},
                    "total_orders": {"absolute": 0.0, "percentage": None},
                    "avg_order_value": {"absolute": 0.0, "percentage": None},
                },
            }
        )
        
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def period_sales_statistics(request):
    """
    إحصائيات المبيعات لفترة محددة (يوم/شهر/سنة) مع المنتجات الأعلى/الأقل مبيعًا.
    - دعم فلاتر ديناميكية: created_at__date أو created_at__month أو created_at__year
    - period_type: day | month | year
    - period_value: قيمة الفترة (مثال: 2025-01-01 لليوم، أو 1 للشهر، أو 2025 للسنة)
    - limit: عدد العناصر في top_products/bottom_products
    """
    try:
        now = timezone.now()
        period_type_param = request.query_params.get("period_type")
        period_value_param = request.query_params.get("period_value")
        limit_param = request.query_params.get("limit")

        period_type, period_value, filter_kwargs = _parse_period_filter(
            now, period_type_param, period_value_param, request
        )

        try:
            limit = int(limit_param) if limit_param is not None else 5
            if limit <= 0:
                limit = 5
        except (TypeError, ValueError):
            limit = 5

        paid_filter = Q(status="PAID") | Q(is_paid=True)
        orders_qs = Order.objects.filter(paid_filter, **filter_kwargs)

        total_sales = orders_qs.aggregate(total=Sum("total"))["total"] or 0

        items_qs = (
            OrderItem.objects.filter(order__in=orders_qs)
            .values("item_id", "item__name")
            .annotate(
                total_quantity=Sum("quantity"),
                order_lines=Count("id"),
                total_sales=Sum(F("quantity") * F("unit_price")),
            )
            .exclude(item_id__isnull=True)
        )

        top_rows = list(items_qs.order_by("-total_quantity", "item__name")[:limit])
        bottom_rows = list(items_qs.order_by("total_quantity", "item__name")[:limit])

        def serialize_products(rows):
            return [
                {
                    "product_id": row["item_id"],
                    "name": row["item__name"],
                    "total_quantity": row["total_quantity"] or 0,
                    "order_lines": row["order_lines"],
                    "total_sales": float(row["total_sales"] or 0),
                }
                for row in rows
            ]

        data = {
            "period_type": period_type,
            "period_value": period_value,
            "total_sales": float(total_sales or 0),
            "top_products": serialize_products(top_rows),
            "bottom_products": serialize_products(bottom_rows),
        }

        return Response(data)
    except (ProgrammingError, OperationalError) as e:
        print("Period sales stats DB error:", e)
        return Response(
            {
                "period_type": "day",
                "period_value": None,
                "total_sales": 0.0,
                "top_products": [],
                "bottom_products": [],
            }
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expense_summary(request):
    """
    إجمالي المصروفات (رواتب + مشتريات) لفترة محددة:
    - period_type: day | month | year
    - period_value: 2024-06-01 (day), 2024-06 (month), 2024 (year)
    """
    try:
        now = timezone.now()
        period_type_param = request.query_params.get("period_type")
        period_value_param = request.query_params.get("period_value")

        period_type, normalized_value, attendance_filter = _parse_period_for_field(
            "work_date", period_type_param, period_value_param, now, use_date_lookup=False
        )
        _, _, purchase_filter = _parse_period_for_field(
            "created_at", period_type_param, period_value_param, now
        )

        attendance_rows = (
            AttendanceLog.objects.filter(**attendance_filter)
            .values("employee_id", "employee__salary")
            .annotate(days=Count("work_date", distinct=True))
        )

        payroll_total = Decimal("0")
        for row in attendance_rows:
            salary = row.get("employee__salary") or Decimal("0")
            days = row.get("days") or 0
            daily_rate = salary / Decimal("30")
            payroll_total += daily_rate * days

        purchase_qs = (
            InventoryMovement.objects.filter(movement_type="IN", change__gt=0, **purchase_filter)
            .annotate(
                cost=F("change")
                * Coalesce(F("item__cost_price"), Value(0), output_field=DecimalField(max_digits=10, decimal_places=2))
            )
        )
        purchase_total = purchase_qs.aggregate(total=Sum("cost"))["total"] or Decimal("0")

        total_expense = payroll_total + purchase_total

        return Response(
            {
                "period_type": period_type,
                "period_value": normalized_value,
                "payroll_total": float(payroll_total),
                "purchase_total": float(purchase_total),
                "total_expense": float(total_expense),
            }
        )
    except (ProgrammingError, OperationalError) as e:
        print("Expense summary DB error:", e)
        return Response(
            {
                "period_type": "day",
                "period_value": None,
                "payroll_total": 0.0,
                "purchase_total": 0.0,
                "total_expense": 0.0,
            }
        )



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
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_movements_report(request):
    """
    تجميع حركات المخزون (وارد/صادر) مع مبيعات كل صنف وفترة زمنية (يوم/شهر/سنة).
    - period_type: day | month | year
    - period_value: 2024-06-10 (day) | 2024-06 (month) | 2024 (year)
    - branch (اختياري)
    """
    try:
        now = timezone.now()
        period_type_param = request.query_params.get("period_type")
        period_value_param = request.query_params.get("period_value")

        period_type, normalized_value, start_date, end_date, days_in_period = _resolve_inventory_period(
            now, period_type_param, period_value_param
        )

        store = get_store_from_request(request)
        if not store:
            return Response(
                {
                    "period_type": period_type,
                    "period_value": normalized_value,
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": days_in_period,
                    "items": [],
                }
            )

        branch = get_branch_from_request(request, store=store)

        # احضر كل الأصناف في المتجر (ومرتبطة بالفرع إن وجد) لضمان ظهور الأصناف بلا حركة
        items_qs = Item.objects.filter(store=store)
        if branch:
            items_qs = items_qs.filter(
                Q(inventory_entries__branch=branch)
                | Q(inventory_movements__branch=branch)
                | Q(orderitem__order__branch=branch)
            )
        items_qs = items_qs.select_related("category").distinct()

        items_map = {
            item.id: {
                "item_id": item.id,
                "name": item.name,
                "category_id": item.category_id,
                "category_name": item.category.name if item.category else None,
                "incoming": 0,
                "outgoing": 0,
                "sales_quantity": 0,
                "total_outgoing": 0,
                "net_change": 0,
                "consumption_rate": 0,
                "timeline": [],
            }
            for item in items_qs
        }

        if not items_map:
            return Response(
                {
                    "period_type": period_type,
                    "period_value": normalized_value,
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": days_in_period,
                    "items": [],
                }
            )

        date_filters = {
            "created_at__date__gte": start_date,
            "created_at__date__lte": end_date,
        }

        movements_qs = InventoryMovement.objects.filter(branch__store=store, **date_filters)
        if branch:
            movements_qs = movements_qs.filter(branch=branch)

        movements_rows = movements_qs.values("item_id").annotate(
            incoming=Coalesce(Sum("change", filter=Q(change__gt=0)), Value(0)),
            outgoing=Coalesce(-Sum("change", filter=Q(change__lt=0)), Value(0)),
        )

        for row in movements_rows:
            item_id = row["item_id"]
            if item_id not in items_map:
                continue
            items_map[item_id]["incoming"] = float(row["incoming"] or 0)
            items_map[item_id]["outgoing"] = float(row["outgoing"] or 0)

        paid_filter = Q(order__status="PAID") | Q(order__is_paid=True)
        sales_qs = OrderItem.objects.filter(
            paid_filter,
            order__store=store,
            order__created_at__date__gte=start_date,
            order__created_at__date__lte=end_date,
        )
        if branch:
            sales_qs = sales_qs.filter(order__branch=branch)

        sales_rows = sales_qs.values("item_id").annotate(
            sales_qty=Coalesce(Sum("quantity"), Value(0)),
        )

        for row in sales_rows:
            item_id = row["item_id"]
            if item_id not in items_map:
                continue
            items_map[item_id]["sales_quantity"] = float(row["sales_qty"] or 0)

        # تجميع سلاسل زمنية
        trunc_map = {
            "day": TruncHour("created_at"),
            "month": TruncDate("created_at"),
            "year": TruncMonth("created_at"),
        }
        trunc = trunc_map.get(period_type, TruncDate("created_at"))
        sales_trunc_map = {
            "day": TruncHour("order__created_at"),
            "month": TruncDate("order__created_at"),
            "year": TruncMonth("order__created_at"),
        }
        sales_trunc = sales_trunc_map.get(period_type, TruncDate("order__created_at"))

        movement_series = movements_qs.annotate(period=trunc).values("item_id", "period").annotate(
            incoming=Coalesce(Sum("change", filter=Q(change__gt=0)), Value(0)),
            outgoing=Coalesce(-Sum("change", filter=Q(change__lt=0)), Value(0)),
        )

        sales_series = sales_qs.annotate(period=sales_trunc).values("item_id", "period").annotate(
            sales_qty=Coalesce(Sum("quantity"), Value(0)),
        )

        timeline_map = defaultdict(lambda: defaultdict(lambda: {"incoming": 0, "outgoing": 0, "sales": 0}))

        for row in movement_series:
            item_id = row["item_id"]
            if item_id not in items_map or row["period"] is None:
                continue
            timeline_map[item_id][row["period"]]["incoming"] += float(row["incoming"] or 0)
            timeline_map[item_id][row["period"]]["outgoing"] += float(row["outgoing"] or 0)

        for row in sales_series:
            item_id = row["item_id"]
            if item_id not in items_map or row["period"] is None:
                continue
            timeline_map[item_id][row["period"]]["sales"] += float(row["sales_qty"] or 0)

        days_divisor = max(days_in_period, 1)
        for item_id, payload in items_map.items():
            sales_qty = payload["sales_quantity"]
            total_outgoing = payload["outgoing"] + sales_qty
            payload["total_outgoing"] = total_outgoing
            payload["net_change"] = payload["incoming"] - total_outgoing
            payload["consumption_rate"] = round(sales_qty / days_divisor, 2)

            periods = sorted(timeline_map[item_id].keys())
            for period in periods:
                stats = timeline_map[item_id][period]
                if period_type == "day":
                    label = period.strftime("%Y-%m-%d %H:00")
                elif period_type == "year":
                    label = period.strftime("%Y-%m")
                else:
                    label = period.strftime("%Y-%m-%d")

                total_out = stats["outgoing"] + stats["sales"]
                payload["timeline"].append(
                    {
                        "label": label,
                        "incoming": stats["incoming"],
                        "outgoing": stats["outgoing"],
                        "sales": stats["sales"],
                        "total_outgoing": total_out,
                        "net_change": stats["incoming"] - total_out,
                    }
                )

        items_payload = sorted(items_map.values(), key=lambda x: x["name"].lower())

        return Response(
            {
                "period_type": period_type,
                "period_value": normalized_value,
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": days_in_period,
                "items": items_payload,
            }
        )
    except (ProgrammingError, OperationalError) as e:
        print("Inventory movements report DB error:", e)
        return Response(
            {
                "period_type": period_type_param or "day",
                "period_value": period_value_param,
                "start": None,
                "end": None,
                "days": 0,
                "items": [],
            }
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_value_report(request):
    """
    إجمالي قيمة المخزون (تكلفة الشراء وقيمة البيع المتوقعة) مع دعم ترشيح:
    - store (ضمنيًا من المستخدم أو store_id)
    - branch (branch / branch_id)
    - category
    """
    try:
        store = get_store_from_request(request)
        if not store:
            return Response(
                {
                    "total_cost_value": 0.0,
                    "total_sale_value": 0.0,
                    "total_margin": 0.0,
                    "items": [],
                }
            )

        qs = Inventory.objects.select_related("item", "branch").for_store(store)

        branch = get_branch_from_request(request, store=store)
        if branch:
            qs = qs.filter(branch=branch)

        category_id = request.query_params.get("category")
        if category_id:
            qs = qs.filter(item__category_id=category_id)

        annotated = qs.with_value_totals()

        totals = annotated.aggregate(
            total_cost=Coalesce(
                Sum("total_cost_value"),
                Value(0),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            total_sale=Coalesce(
                Sum("total_sale_value"),
                Value(0),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )

        items_payload = [
            {
                "item_id": row["item_id"],
                "name": row["item__name"],
                "category_id": row["item__category_id"],
                "category_name": row["item__category__name"],
                "quantity": row["total_quantity"],
                "cost_value": float(row["total_cost_value"] or 0),
                "sale_value": float(row["total_sale_value"] or 0),
                "margin": float((row["total_sale_value"] or 0) - (row["total_cost_value"] or 0)),
            }
            for row in annotated
        ]

        total_cost = totals["total_cost"] or 0
        total_sale = totals["total_sale"] or 0

        return Response(
            {
                "total_cost_value": float(total_cost),
                "total_sale_value": float(total_sale),
                "total_margin": float(total_sale - total_cost),
                "items": items_payload,
            }
        )
    except (ProgrammingError, OperationalError) as e:
        print("Inventory value report DB error:", e)
        return Response(
            {
                "total_cost_value": 0.0,
                "total_sale_value": 0.0,
                "total_margin": 0.0,
                "items": [],
            }
        )