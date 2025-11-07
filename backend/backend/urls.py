from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/core/', include('core.urls')),
    path('api/v1/stores/', include('stores.urls')),
    path('api/v1/orders/', include('orders.urls')),
    path('api/v1/inventory/', include('inventory.urls')),
    path('api/v1/attendance/', include('attendance.urls')),
    path('api/v1/payments/', include('payments.urls')),
    path('api/v1/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]