# serializers/reservation.py
from django.utils import timezone
from rest_framework import serializers

from ..models import Reservation, Table


class ReservationSerializer(serializers.ModelSerializer):
    table_number = serializers.CharField(source="table.number", read_only=True)
    store_name = serializers.CharField(source="table.store.name", read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "table",
            "table_number",
            "store_name",
            "customer_name",
            "customer_phone",
            "reservation_time",
            "party_size",
            "status",
            "notes",
            "duration",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, data):
        table = data.get("table") or getattr(self.instance, "table", None)
        reservation_time = data.get("reservation_time") or getattr(self.instance, "reservation_time", None)
        duration = data.get("duration", getattr(self.instance, "duration", 60))
        party_size = data.get("party_size", getattr(self.instance, "party_size", None))

        if not table:
            raise serializers.ValidationError({"table": "يجب اختيار الطاولة."})

        if not reservation_time:
            raise serializers.ValidationError({"reservation_time": "يجب تحديد وقت الحجز."})

        # توحيد timezone لو USE_TZ=True
        if timezone.is_naive(reservation_time):
            reservation_time = timezone.make_aware(reservation_time, timezone.get_current_timezone())

        if duration is None or int(duration) <= 0:
            raise serializers.ValidationError({"duration": "المدة غير صحيحة."})

        # تحقق التداخل الزمني
        if not Table.objects.available_at_time(reservation_time, int(duration)).filter(id=table.id).exists():
            raise serializers.ValidationError({"table": "هذه الطاولة غير متوفرة في هذا الوقت."})

        # تحقق السعة
        if party_size is not None and int(party_size) > table.capacity:
            raise serializers.ValidationError({"party_size": "عدد الأشخاص أكبر من سعة الطاولة."})

        return data
