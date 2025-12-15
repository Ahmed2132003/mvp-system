# backend/conftest.py
import pytest
from rest_framework.test import APIClient
from core.models import User, Employee
from stores.models import Store
import factory


# Factory داخل conftest عشان Pylance يشوفها
class StoreFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Store

    name = factory.Faker('company')
    address = factory.Faker('address')
    phone = factory.Faker('phone_number')


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authenticated_manager():
    client = APIClient()
    
    # أنشئ Store و User و Employee
    store = StoreFactory.create()
    user = User.objects.create_user(username='manager1', password='123456')
    Employee.objects.create(user=user, role='MANAGER', store=store)
    
    # Login
    response = client.post('/api/v1/auth/login/', {
        'username': 'manager1',
        'password': '123456'
    })
    token = response.data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client