from rest_framework_simplejwt.views import TokenObtainPairView

from core.serializers.token import SubscriptionTokenObtainPairSerializer


class SubscriptionTokenObtainPairView(TokenObtainPairView):
    """
    إصدار توكن JWT مع التحقق من انتهاء التجربة المجانية/الدفع.
    """

    serializer_class = SubscriptionTokenObtainPairSerializer