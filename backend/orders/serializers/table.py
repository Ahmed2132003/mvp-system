from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from ..models import Table

class TableSerializer(serializers.ModelSerializer):
    qr_code_url = serializers.SerializerMethodField()
    qr_code_base64 = serializers.CharField(read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    available_at_time = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = [
            'id',
            'number',
            'capacity',
            'is_available',
            'branch',
            'branch_name',
            'available_at_time',
            'qr_code',
            'qr_code_url',
            'qr_code_base64',
        ]

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            return settings.SITE_URL + obj.qr_code.url
        return None

    def get_available_at_time(self, obj):
        availability_map = self.context.get("availability_map")
        if isinstance(availability_map, dict):
            return availability_map.get(obj.id)
        return None

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if self._has_active_reservation(obj):
            data["is_available"] = False
        return data

    def _has_active_reservation(self, obj):
        """Keep table unavailable while an active reservation window is ongoing."""
        now = timezone.now()
        reservations = getattr(obj, "active_reservations", None)
        if reservations is None:
            reservations = obj.reservations.filter(status__in=["PENDING", "CONFIRMED"])

        for reservation in reservations:
            duration_minutes = reservation.duration or 60
            end_time = reservation.reservation_time + timedelta(minutes=duration_minutes)
            if reservation.reservation_time <= now < end_time:
                return True
        return False