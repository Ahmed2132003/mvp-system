# core/tests/test_auth.py
import pytest
import factory  # ← أضفنا الاستيراد
from rest_framework import status
from rest_framework.test import APIClient
from django.urls import reverse  # ← أضفنا reverse
from core.models import User, Employee
from stores.models import Store  # لو محتاج StoreFactory


# Factories
class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Faker('user_name')
    email = factory.Faker('email')
    first_name = factory.Faker('first_name')
    last_name = factory.Faker('last_name')


class EmployeeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Employee

    user = factory.SubFactory(UserFactory)
    role = 'MANAGER'
    store = factory.SubFactory('stores.tests.factories.StoreFactory')  # لو عندك


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestAuth:
    def test_login_success(self, api_client):
        user = UserFactory.create(username='admin')
        user.set_password('123456')
        user.save()

        response = api_client.post(reverse('token_obtain_pair'), {
            'username': 'admin',
            'password': '123456'
        })

        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data

    def test_login_fail(self, api_client):
        response = api_client.post(reverse('token_obtain_pair'), {
            'username': 'wrong',
            'password': 'wrong'
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_success(self, api_client):
        user = UserFactory.create()
        user.set_password('123456')
        user.save()
        EmployeeFactory.create(user=user, store=Store.objects.first())

        login_resp = api_client.post(reverse('token_obtain_pair'), {
            'username': user.username,
            'password': '123456'
        })
        refresh = login_resp.data['refresh']
        access = login_resp.data['access']

        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        response = api_client.post(reverse('auth_logout'), {'refresh': refresh})

        assert response.status_code == status.HTTP_205_RESET_CONTENT