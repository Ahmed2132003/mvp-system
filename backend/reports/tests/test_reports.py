# reports/tests/test_reports.py
from datetime import datetime

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from core.models import Store, User
from inventory.models import Category, Item
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