# orders/tests/test_orders.py
import pytest
from rest_framework import status
from django.urls import reverse
from orders.models import Order, OrderItem
from inventory.models import Item


@pytest.mark.django_db
class TestOrderAPI:
    def test_create_order(self, api_client, authenticated_manager):
        item = Item.objects.create(name="برجر", price=120.00)
        table = authenticated_manager.employee.store.tables.first()

        data = {
            "table": table.id,
            "items": [{"item": item.id, "quantity": 2}]
        }

        response = api_client.post(reverse('order-list'), data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert Order.objects.count() == 1
        assert response.data['total_price'] == 240.00

    def test_order_status_change(self, api_client, authenticated_manager):
        order = Order.objects.create(
            table=authenticated_manager.employee.store.tables.first(),
            customer_name="أحمد"
        )
        OrderItem.objects.create(order=order, item=Item.objects.create(name="كولا", price=20), quantity=1)

        url = reverse('order-detail', kwargs={'pk': order.id})
        response = api_client.patch(url, {'status': 'completed'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        order.refresh_from_db()
        assert order.status == 'completed'