# reports/tests/test_reports.py
from datetime import date, datetime, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from django.db.models import Q
from core.models import Employee, EmployeeLedger, Store, User
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
        salary=100,
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

    assert payload["attendance_value_total"] == 100.0
    assert payload["bonuses_total"] == 0.0
    assert payload["penalties_total"] == 0.0
    assert payload["advances_total"] == 0.0
    assert payload["late_penalties_total"] == 0.0
    assert payload["payroll_total"] == 100.0  # 1 day * 100
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
    assert payload["attendance_value_total"] == 200.0  # 2 days * 100
    assert payload["bonuses_total"] == 0.0
    assert payload["penalties_total"] == 0.0
    assert payload["advances_total"] == 0.0
    assert payload["late_penalties_total"] == 0.0
    assert payload["payroll_total"] == 200.0
    assert payload["purchase_total"] == 250.0  # 10 * cost_price 25
    assert payload["total_expense"] == 450.0


@pytest.mark.django_db
def test_expense_summary_includes_adjustments(expense_setup):
    client = expense_setup["client"]
    employee = expense_setup["employee"]

    work_day = timezone.make_aware(datetime(2024, 8, 1, 9, 0))
    AttendanceLog.objects.create(
        employee=employee,
        check_in=work_day,
        check_out=work_day + timedelta(hours=8),
        work_date=work_day.date(),
        late_minutes=20,
        penalty_applied=15,
    )
    AttendanceLog.objects.create(
        employee=employee,
        check_in=work_day + timedelta(days=1),
        check_out=work_day + timedelta(days=1, hours=8),
        work_date=work_day.date() + timedelta(days=1),
    )

    EmployeeLedger.objects.create(employee=employee, entry_type="BONUS", amount=30, payout_date=work_day.date())
    EmployeeLedger.objects.create(employee=employee, entry_type="PENALTY", amount=5, payout_date=work_day.date())
    EmployeeLedger.objects.create(employee=employee, entry_type="ADVANCE", amount=10, payout_date=work_day.date())

    response = client.get("/api/v1/reports/expenses/", {"period_type": "month", "period_value": "2024-08"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["attendance_value_total"] == 200.0  # 2 days * 100
    assert payload["bonuses_total"] == 30.0
    assert payload["penalties_total"] == 5.0
    assert payload["advances_total"] == 10.0
    assert payload["late_penalties_total"] == 15.0
    assert payload["payroll_total"] == 200.0  # 200 + 30 - 5 - 10 - 15
    assert payload["purchase_total"] == 0.0
    assert payload["total_expense"] == 200.0


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


@pytest.mark.django_db
def test_payroll_movements_report_orders_chronologically(expense_setup):
    client = expense_setup["client"]
    employee = expense_setup["employee"]

    # خارج الفترة
    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="ADVANCE",
        amount=100,
        payout_date=date(2024, 6, 30),
        description="Old advance",
    )

    first = EmployeeLedger.objects.create(
        employee=employee,
        entry_type="SALARY",
        amount=1000,
        payout_date=date(2024, 7, 1),
        description="July salary",
    )
    second = EmployeeLedger.objects.create(
        employee=employee,
        entry_type="ADVANCE",
        amount=200,
        payout_date=date(2024, 7, 2),
        description="Advance",
    )
    third = EmployeeLedger.objects.create(
        employee=employee,
        entry_type="BONUS",
        amount=100,
        payout_date=date(2024, 7, 2),
        description="Bonus",
    )
    fourth = EmployeeLedger.objects.create(
        employee=employee,
        entry_type="PENALTY",
        amount=50,
        payout_date=date(2024, 7, 3),
        description="Late penalty",
    )

    response = client.get(
        "/api/v1/reports/payroll/movements/",
        {"period_type": "month", "period_value": "2024-07"},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["period_type"] == "month"
    assert payload["period_value"] == "2024-07"
    assert payload["count"] == 4

    payout_dates = [row["payout_date"] for row in payload["movements"]]
    assert payout_dates == [
        first.payout_date.isoformat(),
        second.payout_date.isoformat(),
        third.payout_date.isoformat(),
        fourth.payout_date.isoformat(),
    ]

    totals = payload["totals"]
    assert totals["salary"] == 1000.0
    assert totals["advance"] == 200.0
    assert totals["bonus"] == 100.0
    assert totals["penalty"] == 50.0
    assert totals["net"] == 850.0


@pytest.mark.django_db
def test_payroll_movements_report_daily_filter(expense_setup):
    client = expense_setup["client"]
    employee = expense_setup["employee"]

    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="SALARY",
        amount=500,
        payout_date=date(2024, 8, 1),
    )
    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="PENALTY",
        amount=25,
        payout_date=date(2024, 8, 1),
    )
    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="BONUS",
        amount=50,
        payout_date=date(2024, 8, 2),
    )

    response = client.get(
        "/api/v1/reports/payroll/movements/",
        {"period_type": "day", "period_value": "2024-08-01"},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["period_type"] == "day"
    assert payload["period_value"] == "2024-08-01"
    assert payload["count"] == 2

    totals = payload["totals"]
    assert totals["salary"] == 500.0
    assert totals["penalty"] == 25.0
    assert totals["bonus"] == 0.0
    assert totals["advance"] == 0.0
    assert totals["net"] == 475.0
@pytest.mark.django_db
def test_inventory_movements_report_handles_empty_items(reporting_setup, monkeypatch):    
    client = reporting_setup["client"]
    items = reporting_setup["items"]

    frozen_now = timezone.make_aware(datetime(2024, 7, 15, 12, 0))
    monkeypatch.setattr(timezone, "now", lambda: frozen_now)

    response = client.get(
        "/api/v1/reports/inventory/movements/",
        {"period_type": "month", "period_value": "2024-07"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["period_type"] == "month"
    assert payload["period_value"] == "2024-07"
    assert payload["days"] == 31

    items_payload = {item["item_id"]: item for item in payload["items"]}
    assert set(items_payload.keys()) == {
        items["burger"].id,
        items["pizza"].id,
        items["salad"].id,
    }

    for item in items_payload.values():
        assert item["incoming"] == 0
        assert item["outgoing"] == 0
        assert item["sales_quantity"] == 0
        assert item["consumption_rate"] == 0
        assert item["timeline"] == []


@pytest.mark.django_db
def test_inventory_movements_report_calculates_consumption_and_timeline(reporting_setup, monkeypatch):
    client = reporting_setup["client"]
    store = reporting_setup["store"]
    branch = reporting_setup["branch"]
    items = reporting_setup["items"]

    frozen_now = timezone.make_aware(datetime(2024, 7, 31, 9, 0))
    monkeypatch.setattr(timezone, "now", lambda: frozen_now)

    # حركات وارد وصادر
    movement = InventoryMovement.objects.create(
        inventory=Inventory.objects.create(item=items["burger"], branch=branch, quantity=0, min_stock=0),
        item=items["burger"],
        branch=branch,
        change=40,
        movement_type="IN",
    )
    InventoryMovement.objects.filter(pk=movement.pk).update(
        created_at=timezone.make_aware(datetime(2024, 7, 5, 10, 0))
    )

    out_movement = InventoryMovement.objects.create(
        inventory=Inventory.objects.create(item=items["pizza"], branch=branch, quantity=0, min_stock=0),
        item=items["pizza"],
        branch=branch,
        change=-5,
        movement_type="OUT",
    )
    InventoryMovement.objects.filter(pk=out_movement.pk).update(
        created_at=timezone.make_aware(datetime(2024, 7, 10, 8, 0))
    )

    # مبيعات مرتفعة للبائع Burger
    for day in [1, 3, 7, 15, 20]:
        created_at = timezone.make_aware(datetime(2024, 7, day, 14, 0))
        create_order_with_items(
            store,
            branch,
            created_at,
            [
                (items["burger"], 10),
            ],
        )

    response = client.get(
        "/api/v1/reports/inventory/movements/",
        {"period_type": "month", "period_value": "2024-07"},
    )

    assert response.status_code == 200
    payload = response.json()
    burger_data = next(item for item in payload["items"] if item["item_id"] == items["burger"].id)
    pizza_data = next(item for item in payload["items"] if item["item_id"] == items["pizza"].id)
    salad_data = next(item for item in payload["items"] if item["item_id"] == items["salad"].id)

    assert burger_data["incoming"] == 40.0
    assert burger_data["sales_quantity"] == 50.0
    assert burger_data["total_outgoing"] == 50.0
    assert burger_data["net_change"] == -10.0
    assert burger_data["consumption_rate"] == pytest.approx(1.61, rel=1e-3)
    assert len(burger_data["timeline"]) >= 1
    labels = [row["label"] for row in burger_data["timeline"]]
    assert any(label.startswith("2024-07-01") for label in labels)

    assert pizza_data["outgoing"] == 5.0
    assert pizza_data["consumption_rate"] == 0
    assert salad_data["incoming"] == 0
    assert salad_data["timeline"] == []


@pytest.mark.django_db
def test_accounting_includes_late_penalties_and_adjusted_base():
    user = User.objects.create_user(email="owner3@example.com", password="pass", is_active=True)
    store = Store.objects.create(name="Payroll Store", owner=user)
    employee = Employee.objects.create(
        user=User.objects.create_user(email="emp@example.com", password="pass", is_active=True),
        store=store,
        salary=100,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    work_day = timezone.datetime(2024, 7, 2, 9, 0, tzinfo=timezone.get_current_timezone())
    AttendanceLog.objects.create(
        employee=employee,
        work_date=work_day.date(),
        check_in=work_day,
        check_out=work_day + timezone.timedelta(hours=8),
        late_minutes=30,
        penalty_applied=50,
    )
    AttendanceLog.objects.create(
        employee=employee,
        work_date=work_day.date() + timezone.timedelta(days=1),
        check_in=work_day + timezone.timedelta(days=1),
        check_out=work_day + timezone.timedelta(days=1, hours=8),
    )

    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="BONUS",
        amount=20,
        payout_date=work_day.date(),
    )
    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="PENALTY",
        amount=10,
        payout_date=work_day.date(),
    )
    EmployeeLedger.objects.create(
        employee=employee,
        entry_type="ADVANCE",
        amount=5,
        payout_date=work_day.date(),
    )

    response = client.get(
        "/api/v1/reports/accounting/",
        {"period_type": "month", "period_value": "2024-07", "store_id": store.id},
    )
    assert response.status_code == 200
    payload = response.json()

    payroll = payload["payroll"]
    assert payroll["attendance_days"] == 2
    assert payroll["attendance_value_total"] == 200.0
    assert payroll["bonuses_total"] == 20.0
    assert payroll["penalties_total"] == 60.0  # 10 ledger + 50 late penalties
    assert payroll["advances_total"] == 5.0
    assert payroll["payroll_total"] == 155.0  # 200 + 20 - 60 - 5

    row = payroll["rows"][0]
    assert row["base_salary"] == 160.0  # (2 * 100) + 20 - 60
    assert row["net_salary"] == 155.0
    assert row["late_penalties"] == 50.0