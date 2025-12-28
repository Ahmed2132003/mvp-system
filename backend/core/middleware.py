from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin


class SubscriptionEnforcementMiddleware(MiddlewareMixin):
    """
    يمنع الوصول لأي API إذا انتهت الفترة التجريبية ولم يتم توثيق الدفع
    للمستخدمين من نوع OWNER أو MANAGER. السوبر يوزر مستثنى.
    """

    EXEMPT_PATH_PREFIXES = (
        "/api/v1/auth/login/",
        "/api/v1/auth/refresh/",
        "/api/v1/auth/token/",
        "/api/v1/auth/token/refresh/",
        "/api/v1/auth/verify/",
        "/api/v1/auth/verify-link/",
        "/admin/",
    )

    def process_request(self, request):
        path = request.path or ""

        # تخطي المسارات المستثناة
        if path.startswith(self.EXEMPT_PATH_PREFIXES):
            return None

        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None

        # السوبر يوزر خارج القيود
        if getattr(user, "is_superuser", False):
            return None

        # السماح لـ /auth/me/ عشان نعرض الرسالة في الواجهة
        if path.startswith("/api/v1/auth/me/"):
            return None

        has_access = getattr(user, "has_active_access", True)
        if has_access:
            return None

        detail = getattr(user, "access_block_reason", None) or (
            "انتهت الفترة التجريبية الخاصة بحسابك. برجاء التواصل مع الشركة للترقية وتفعيل الحساب."
        )

        return JsonResponse({"detail": detail}, status=403)