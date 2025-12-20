# backend/conftest.py
import pytest
import factory
from rest_framework.test import APIClient

from core.models import Employee, Store, User

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
    user = User.objects.create_user(email='manager1@example.com', password='123456', is_active=True)
    Employee.objects.create(user=user, role='MANAGER', store=store)

    client.force_authenticate(user=user)
    return client