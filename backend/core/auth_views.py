from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.serializers.token import (
    SafeTokenRefreshSerializer,
    SubscriptionTokenObtainPairSerializer,
)
class SubscriptionTokenObtainPairView(TokenObtainPairView):
    """
    إصدار توكن JWT مع التحقق من انتهاء التجربة المجانية/الدفع.
    """

    serializer_class = SubscriptionTokenObtainPairSerializer


class SafeTokenRefreshView(TokenRefreshView):
    serializer_class = SafeTokenRefreshSerializer