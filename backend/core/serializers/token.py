from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from django.db.utils import OperationalError, ProgrammingError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings
from core.serializers.user import UserSerializer


class SubscriptionTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    تضيف تحقق من صلاحية الاشتراك قبل إصدار التوكنات،
    وترجع بيانات المستخدم مع الاستجابة للواجهة.
    """

    default_error_messages = {
        "no_access": "انتهت الفترة التجريبية الخاصة بحسابك. برجاء التواصل مع الشركة للترقية وتفعيل الحساب.",
    }

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        has_access = getattr(user, "has_active_access", True)
        if not has_access:
            reason = getattr(user, "access_block_reason", None) or self.default_error_messages["no_access"]
            raise AuthenticationFailed(detail=reason, code="subscription_expired")

        data["user"] = UserSerializer(user).data
        return data


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh serializer that skips blacklist DB errors during rotation."""

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])

        data = {"access": str(refresh.access_token)}

        if api_settings.ROTATE_REFRESH_TOKENS:
            if api_settings.BLACKLIST_AFTER_ROTATION:
                try:
                    refresh.blacklist()
                except (AttributeError, OperationalError, ProgrammingError):
                    pass

            refresh.set_jti()
            refresh.set_exp()
            refresh.set_iat()

            data["refresh"] = str(refresh)

        return data