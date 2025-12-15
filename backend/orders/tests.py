from django.test import TestCase
from django.utils import timezone
from .models import Table, Reservation, Store 
class ReservationTestCase(TestCase):
    def setUp(self):
        self.store = Store.objects.create(name='Test Store')
        self.table = Table.objects.create(store=self.store, number='1', capacity=4)

    def test_availability_check(self):
        res_time = timezone.now()
        Reservation.objects.create(table=self.table, customer_name='Test', customer_phone='123', reservation_time=res_time, party_size=2, status='CONFIRMED')
        
        # تحقق: الطاولة مش متوفرة دلوقتي
        self.assertFalse(Table.objects.available_at_time(res_time).filter(id=self.table.id).exists())
        
        # غير الـ status إلى CANCELLED
        res = Reservation.objects.first()
        res.status = 'CANCELLED'
        res.save()
        self.assertTrue(Table.objects.available_at_time(res_time).filter(id=self.table.id).exists())