# backend/reports/views.py
from calendar import monthrange
from datetime import date, timedelta

from django.db.models import Sum, F, Count, Q
from django.db.models.functions import TruncHour, TruncDate, TruncMonth
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import EmployeeLedger, PayrollPeriod
from inventory.models import Inventory
from orders.models import Order, OrderItem, Payment


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
