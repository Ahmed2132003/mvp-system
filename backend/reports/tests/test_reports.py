# reports/tests/test_reports.py
from datetime import datetime, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from django.db.models import Q
from core.models import Employee, Store, User
from attendance.models import AttendanceLog
from inventory.models import Category, Inventory, InventoryMovement, Item
from orders.models import Order, OrderItem

@pytest.fixture
def reporting_setup(db):
    user = User.objects.create_user(
        email="owner@example.com", password="pass", is_active=True
    )
    store = Store.objects.create(name="Main Store", owner=user)
    branch = Branch.objects.create(name="Main Branch", store=store)
    category = Category.objects.create(name="Food", store=store)
    burger = Item.objects.create(
        name="Burger", store=store, category=category, unit_price=50, cost_price=25
    )
    pizza = Item.objects.create(
        name="Pizza", store=store, category=category, unit_price=80, cost_price=40
    )
    salad = Item.objects.create(
        name="Salad", store=store, category=category, unit_price=30, cost_price=15
    )

    client = APIClient()
    client.force_authenticate(user=user)

    return {
        "user": user,
        "store": store,
        "branch": branch,
        "items": {"burger": burger, "pizza": pizza, "salad": salad},
        "client": client,
    }


def create_order_with_items(store, branch, created_at, items_quantities):
    """Helper to create a paid order with specific created_at and attached items."""
    order = Order.objects.create(
        store=store,
        branch=branch,        
        status="PAID",
        is_paid=True,
        total=0,
        created_at=created_at,
    )
    # auto_now_add may override; enforce the provided timestamp
    Order.objects.filter(pk=order.pk).update(created_at=created_at)
    order.refresh_from_db()

    for item, qty in items_quantities:
        OrderItem.objects.create(order=order, item=item, quantity=qty, unit_price=item.unit_price)

    return order


@pytest.fixture
def expense_setup(db):
    user = User.objects.create_user(email="owner2@example.com", password="pass", is_active=True)
    store = Store.objects.create(name="Expense Store", owner=user)
    branch = Branch.objects.create(name="Expense Branch", store=store)
    category = Category.objects.create(name="Supplies", store=store)
    item = Item.objects.create(
        name="Cheese",
        store=store,
        category=category,
        unit_price=50,
        cost_price=25,
    )
    inventory = Inventory.objects.create(item=item, branch=branch, quantity=0, min_stock=0)
    employee = Employee.objects.create(
        user=User.objects.create_user(
            email="employee@example.com",
            password="pass",
            is_active=True,
        ),
        store=store,
        branch=branch,
        salary=3000,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    return {
        "user": user,
        "store": store,
        "branch": branch,
        "item": item,
        "inventory": inventory,
        "employee": employee,
        "client": client,
    }

@pytest.mark.django_db
def test_period_stats_filters_by_day_and_returns_top_and_bottom(reporting_setup):
    client = reporting_setup["client"]
    branch = reporting_setup["branch"]
    store = reporting_setup["store"]
    items = reporting_setup["items"]

    target_day = timezone.make_aware(datetime(2024, 5, 1, 10, 0))
    other_day = timezone.make_aware(datetime(2024, 5, 2, 12, 0))

    create_order_with_items(
        store,
        branch,
        target_day,
        [
            (items["burger"], 2),
            (items["pizza"], 1),
        ],
    )
    create_order_with_items(store, branch, target_day, [(items["salad"], 3)])
    # خارج اليوم المطلوب
    create_order_with_items(store, branch, other_day, [(items["burger"], 1)])

    response = client.get(
        "/api/v1/reports/sales/period-stats/",
        {
            "created_at__date": target_day.date().isoformat(),
            "limit": 2,
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["period_type"] == "day"
    assert payload["period_value"] == target_day.date().isoformat()
    # burger:2*50 + pizza:1*80 + salad:3*30 = 270
    assert payload["total_sales"] == 270.0

    assert len(payload["top_products"]) == 2
    assert payload["top_products"][0]["name"] == "Salad"
    assert payload["top_products"][0]["total_quantity"] == 3

    assert len(payload["bottom_products"]) == 2
    assert payload["bottom_products"][0]["name"] == "Pizza"
    assert payload["bottom_products"][0]["total_quantity"] == 1


@pytest.mark.django_db
def test_period_stats_filters_by_month_and_year(reporting_setup):
    client = reporting_setup["client"]
    branch = reporting_setup["branch"]
    store = reporting_setup["store"]
    items = reporting_setup["items"]
    
    june_date = timezone.make_aware(datetime(2024, 6, 15, 9, 0))
    july_date = timezone.make_aware(datetime(2024, 7, 3, 18, 30))
    past_year_date = timezone.make_aware(datetime(2023, 12, 25, 14, 0))

    create_order_with_items(store, branch, june_date, [(items["burger"], 1)])
    create_order_with_items(store, branch, july_date, [(items["pizza"], 4)])
    create_order_with_items(store, branch, past_year_date, [(items["salad"], 2)])

    # Month filter (June)
    month_response = client.get(
        "/api/v1/reports/sales/period-stats/",
        {
            "period_type": "month",
            "period_value": 6,
            "limit": 1,
        },
    )
    assert month_response.status_code == 200
    month_payload = month_response.json()

    assert month_payload["period_type"] == "month"
    assert month_payload["period_value"] == "6"
    assert month_payload["total_sales"] == 50.0
    assert month_payload["top_products"][0]["name"] == "Burger"
    assert month_payload["bottom_products"][0]["name"] == "Burger"

    # Year filter (2023) via created_at__year
    year_response = client.get(
        "/api/v1/reports/sales/period-stats/",
        {
            "created_at__year": 2023,
            "limit": 2,
        },
    )
    assert year_response.status_code == 200
    year_payload = year_response.json()

    assert year_payload["period_type"] == "year"
    assert year_payload["period_value"] == "2023"
    assert year_payload["total_sales"] == 60.0
    assert year_payload["top_products"][0]["name"] == "Salad"
    assert year_payload["bottom_products"][0]["name"] == "Salad"


@pytest.mark.django_db
def test_compare_sales_periods_with_presets(reporting_setup, monkeypatch):
    client = reporting_setup["client"]
    branch = reporting_setup["branch"]
    store = reporting_setup["store"]
    items = reporting_setup["items"]

    frozen_now = timezone.make_aware(datetime(2024, 6, 10, 12, 0))
    monkeypatch.setattr(timezone, "now", lambda: frozen_now)

    current_week_day1 = timezone.make_aware(datetime(2024, 6, 10, 9, 0))
    current_week_day3 = timezone.make_aware(datetime(2024, 6, 12, 15, 30))
    previous_week_day1 = timezone.make_aware(datetime(2024, 6, 3, 11, 0))
    previous_week_day5 = timezone.make_aware(datetime(2024, 6, 7, 18, 45))

    create_order_with_items(store, branch, current_week_day1, [(items["burger"], 2)])
    create_order_with_items(
        store,
        branch,
        current_week_day3,
        [
            (items["pizza"], 1),
            (items["salad"], 1),
        ],
    )
    create_order_with_items(store, branch, previous_week_day1, [(items["pizza"], 1)])
    create_order_with_items(store, branch, previous_week_day5, [(items["salad"], 2)])

    assert Order.objects.count() == 4
    paid_filter = Q(status="PAID") | Q(is_paid=True)
    assert Order.objects.filter(paid_filter).count() == 4

    response = client.get(
        "/api/v1/reports/sales/compare/",
        {
            "period_a_preset": "current_week",
            "period_b_preset": "previous_week",
            "limit": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["period_a"]["label"] == "current_week"
    assert payload["period_b"]["label"] == "previous_week"

    assert payload["period_a"]["total_sales"] == 210.0  # 2*50 + 80 + 30
    assert payload["period_b"]["total_sales"] == 140.0  # 80 + 2*30

    assert payload["period_a"]["total_orders"] == 2
    assert payload["period_b"]["total_orders"] == 2

    assert payload["period_a"]["avg_order_value"] == 105.0
    assert payload["period_b"]["avg_order_value"] == 70.0

    assert payload["deltas"]["total_sales"]["absolute"] == 70.0
    assert payload["deltas"]["total_sales"]["percentage"] == 50.0
    assert payload["deltas"]["avg_order_value"]["absolute"] == 35.0

    assert payload["period_a"]["top_products"][0]["name"] == "Burger"
    assert payload["period_b"]["top_products"][0]["name"] == "Salad"


@pytest.mark.django_db
def test_compare_sales_periods_custom_and_empty(reporting_setup, monkeypatch):
    client = reporting_setup["client"]
    branch = reporting_setup["branch"]
    store = reporting_setup["store"]
    items = reporting_setup["items"]
    
    frozen_now = timezone.make_aware(datetime(2024, 5, 5, 9, 0))
    monkeypatch.setattr(timezone, "now", lambda: frozen_now)

    create_order_with_items(
        store,
        branch,
        timezone.make_aware(datetime(2024, 5, 1, 10, 0)),
        [(items["burger"], 1)],
    )
    create_order_with_items(
        store,
        branch,
        timezone.make_aware(datetime(2024, 5, 2, 11, 30)),
        [(items["pizza"], 1)],
    )

    assert Order.objects.count() == 2
    paid_filter = Q(status="PAID") | Q(is_paid=True)
    assert Order.objects.filter(paid_filter).count() == 2

    response = client.get(
        "/api/v1/reports/sales/compare/",
        {
            "period_a_start": "2024-05-01",
            "period_a_end": "2024-05-02",
            "period_b_start": "2024-05-04",
            "period_b_end": "2024-05-05",
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["period_a"]["label"] == "custom"
    assert payload["period_b"]["label"] == "custom"

    assert payload["period_a"]["total_sales"] == 130.0
    assert payload["period_a"]["total_orders"] == 2
    assert payload["period_a"]["avg_order_value"] == 65.0

    assert payload["period_b"]["total_sales"] == 0.0
    assert payload["period_b"]["total_orders"] == 0
    assert payload["period_b"]["avg_order_value"] == 0.0

    assert payload["deltas"]["total_sales"]["absolute"] == 130.0
    assert payload["deltas"]["total_sales"]["percentage"] is None
    assert payload["period_a"]["top_products"][0]["name"] in {"Burger", "Pizza"}
    assert payload["period_b"]["top_products"] == []


@pytest.mark.django_db
def test_expense_summary_daily_attendance_only(expense_setup):
    client = expense_setup["client"]
    employee = expense_setup["employee"]

    target_date = timezone.make_aware(datetime(2024, 6, 1, 9, 0))
    AttendanceLog.objects.create(
        employee=employee,
        check_in=target_date,
        check_out=target_date + timedelta(hours=8),
        work_date=target_date.date(),
    )

    response = client.get(
        "/api/v1/reports/expenses/",
        {"period_type": "day", "period_value": target_date.date().isoformat()},
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["payroll_total"] == 100.0  # 3000 / 30 * 1 day
    assert payload["purchase_total"] == 0.0
    assert payload["total_expense"] == 100.0
    assert payload["period_type"] == "day"
    assert payload["period_value"] == target_date.date().isoformat()


@pytest.mark.django_db
def test_expense_summary_monthly_attendance_and_purchases(expense_setup):    
    client = expense_setup["client"]
    employee = expense_setup["employee"]
    inventory = expense_setup["inventory"]
    item = expense_setup["item"]

    AttendanceLog.objects.create(
        employee=employee,
        check_in=timezone.make_aware(datetime(2024, 7, 1, 9, 0)),
        check_out=timezone.make_aware(datetime(2024, 7, 1, 17, 0)),
        work_date=datetime(2024, 7, 1).date(),
    )
    AttendanceLog.objects.create(
        employee=employee,
        check_in=timezone.make_aware(datetime(2024, 7, 2, 9, 0)),
        check_out=timezone.make_aware(datetime(2024, 7, 2, 17, 0)),
        work_date=datetime(2024, 7, 2).date(),
    )

    movement = InventoryMovement.objects.create(
        inventory=inventory,
        item=item,
        branch=expense_setup["branch"],
        change=10,
        movement_type="IN",
        created_by=None,
        reason="Restock",
    )
    # اضبط وقت الإدخال ليتماشى مع الفلتر الشهري
    july_created_at = timezone.make_aware(datetime(2024, 7, 5, 12, 0))
    InventoryMovement.objects.filter(pk=movement.pk).update(created_at=july_created_at)

    response = client.get("/api/v1/reports/expenses/", {"period_type": "month", "period_value": "2024-07"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["period_type"] == "month"
    assert payload["period_value"] == "2024-07"
    assert payload["payroll_total"] == 200.0  # 2 days * 100
    assert payload["purchase_total"] == 250.0  # 10 * cost_price 25
    assert payload["total_expense"] == 450.0


@pytest.mark.django_db
def test_inventory_value_report_respects_sales_deductions(reporting_setup):
    client = reporting_setup["client"]
    store = reporting_setup["store"]
    branch = reporting_setup["branch"]
    items = reporting_setup["items"]

    inventory_burger = Inventory.objects.create(
        item=items["burger"],
        branch=branch,
        quantity=20,
        min_stock=0,
    )
    inventory_pizza = Inventory.objects.create(
        item=items["pizza"],
        branch=branch,
        quantity=10,
        min_stock=0,
    )

    other_category = Category.objects.create(name="Drinks", store=store)
    items["pizza"].category = other_category
    items["pizza"].save()

    order = Order.objects.create(
        store=store,
        branch=branch,
        status="PENDING",
        is_paid=False,
    )
    OrderItem.objects.create(order=order, item=items["burger"], quantity=5, unit_price=items["burger"].unit_price)
    OrderItem.objects.create(order=order, item=items["pizza"], quantity=2, unit_price=items["pizza"].unit_price)

    order.status = "READY"
    order.save()

    inventory_burger.refresh_from_db()
    inventory_pizza.refresh_from_db()
    assert inventory_burger.quantity == 15
    assert inventory_pizza.quantity == 8

    response = client.get("/api/v1/reports/inventory/value/")
    assert response.status_code == 200
    payload = response.json()

    assert payload["total_cost_value"] == 695.0  # (15 * 25) + (8 * 40)
    assert payload["total_sale_value"] == 1390.0  # (15 * 50) + (8 * 80)
    assert payload["total_margin"] == 695.0

    items_payload = {item["item_id"]: item for item in payload["items"]}
    assert items_payload[items["burger"].id]["quantity"] == 15
    assert items_payload[items["pizza"].id]["quantity"] == 8

    category_filter_response = client.get(
        "/api/v1/reports/inventory/value/",
        {"category": reporting_setup["items"]["burger"].category_id},
    )
    assert category_filter_response.status_code == 200
    filtered_payload = category_filter_response.json()
    assert filtered_payload["total_sale_value"] == 750.0  # burger only