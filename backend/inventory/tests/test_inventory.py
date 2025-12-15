# inventory/tests/test_inventory.py
import pytest  # ← أضفنا
from rest_framework import status
from django.urls import reverse  # ← أضفنا
from inventory.models import Item, Inventory  # ← أضفنا
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestInventory:
    def test_low_stock_alert(self, api_client, authenticated_manager):
        item = Item.objects.create(name="مياه", price=10, store=authenticated_manager.employee.store)
        branch = authenticated_manager.employee.store.branches.first()
        Inventory.objects.create(item=item, branch=branch, quantity=5, min_stock=10)

        response = api_client.get(reverse('inventory-list') + '?min_quantity=10')
        assert len(response.data['results']) == 0  # لأنه أقل من 10