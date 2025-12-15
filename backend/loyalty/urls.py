# loyalty/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoyaltyProgramViewSet,
    CustomerLoyaltyViewSet,
    LoyaltyTransactionViewSet,
)

router = DefaultRouter()
router.register('program', LoyaltyProgramViewSet, basename='loyalty-program')
router.register('customers', CustomerLoyaltyViewSet, basename='loyalty-customers')
router.register('transactions', LoyaltyTransactionViewSet, basename='loyalty-transactions')

urlpatterns = [
    path('', include(router.urls)),
]
