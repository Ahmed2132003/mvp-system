from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StoreViewSet, StoreSettingsViewSet, AdminStoreViewSet

router = DefaultRouter()
router.register('stores', StoreViewSet, basename='stores')
router.register('store-settings', StoreSettingsViewSet, basename='store-settings')

# سوبر يوزر فقط
router.register('admin/stores', AdminStoreViewSet, basename='admin-stores')

urlpatterns = [
    path('', include(router.urls)),
]
