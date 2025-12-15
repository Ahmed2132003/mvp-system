# backend/backend/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

# استيراد LogoutView من core
from core.views import LogoutView

# استيراد كل الـ ViewSets عشان الـ router
from core.views import EmployeeViewSet
from stores.views import StoreViewSet, StoreSettingsViewSet
from branches.views import BranchViewSet
from inventory.views import CategoryViewSet, ItemViewSet, InventoryViewSet
from orders.views import TableViewSet, OrderViewSet
from loyalty.views import (
    LoyaltyProgramViewSet,
    CustomerLoyaltyViewSet,
    LoyaltyTransactionViewSet,
)
from reports.views import api_reports


# إنشاء الـ Router
from rest_framework.routers import DefaultRouter
router = DefaultRouter()

# تسجيل كل الـ ViewSets
router.register(r'store', StoreViewSet, basename='store')
router.register(r'settings', StoreSettingsViewSet, basename='storesettings')
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'tables', TableViewSet, basename='table')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'loyalty/program', LoyaltyProgramViewSet, basename='loyalty-program')
router.register(r'loyalty/customers', CustomerLoyaltyViewSet, basename='loyalty-customers')
router.register(r'loyalty/transactions', LoyaltyTransactionViewSet, basename='loyalty-transactions')

# الـ URLs الرئيسية
urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT Authentication
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/v1/auth/logout/', LogoutView.as_view(), name='auth_logout'),

    # كل حاجة في core (me/, create user, verify, etc)
    path('api/v1/', include('core.urls')),

    # ✅ NEW: core scoped endpoints تحت /api/v1/core/
    path('api/v1/core/', include('core.urls_core')),

    # ✅ Attendance APIs تحت /api/v1/attendance/ (يشمل viewset + qr endpoints)
    path('api/v1/attendance/', include('attendance.urls')),

    # باقي الـ apps (لو عندك endpoints إضافية جوه apps)
    path('api/v1/inventory/', include('inventory.urls')),
    path('api/v1/orders/', include('orders.urls')),
    path("api/v1/reports/", include("reports.urls")),
    path('api/v1/', include('stores.urls')),
    path('api/v1/loyalty/', include('loyalty.urls')),

    # تقرير الداشبورد
    path('api/v1/reports/summary/', api_reports, name='api_reports_summary'),

    # باقي الـ API من الـ router
    path('api/v1/', include(router.urls)),

    # باقي الـ apps
    path('api/v1/payments/', include('payments.urls')),
]

# للـ media في الـ development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
