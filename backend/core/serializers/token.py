from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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