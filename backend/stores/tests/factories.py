# stores/tests/factories.py
import factory
from stores.models import Store


class StoreFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Store

    name = factory.Faker('company')
    address = factory.Faker('address')