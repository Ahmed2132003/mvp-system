# backend/inventory/urls.py
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ItemViewSet, InventoryViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='inventory-category')
router.register(r'items', ItemViewSet, basename='inventory-item')
router.register(r'inventory', InventoryViewSet, basename='inventory-entry')

urlpatterns = router.urls
