# core/serializers/user.py

from rest_framework import serializers
from ..models import User


class UserSerializer(serializers.ModelSerializer):
    """يُستخدم في /auth/me/ وأي مكان محتاج بيانات المستخدم الأساسية"""
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'name',
            'phone',
            'role',           # مهم جدًا عشان الـ frontend يعرف هو OWNER ولا MANAGER ولا STAFF
            'is_active',
            'is_payment_verified',
            'is_staff',
            'is_superuser',
            'trial_starts_at',
            'trial_ends_at',
            'trial_days_left',
            'is_trial_expired',
            'has_active_access',
            'access_block_reason',
            'date_joined'
        ]
        read_only_fields = [
            'id',
            'is_active',
            'is_staff',
            'is_superuser',
            'trial_starts_at',
            'trial_ends_at',
            'trial_days_left',
            'is_trial_expired',
            'has_active_access',
            'access_block_reason',
            'date_joined',
        ]