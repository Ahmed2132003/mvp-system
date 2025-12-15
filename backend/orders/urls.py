# backend/orders/urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    TableViewSet,
    OrderViewSet,
    ReservationViewSet,
    PublicTableMenuView,
    PublicTableOrderCreateView,
    PublicStoreMenuView,          # ✅ جديد
    PublicStoreOrderCreateView,   # ✅ جديد
)

router = DefaultRouter()
# /api/v1/orders/        -> OrderViewSet (list, create, ...)
router.register(r'tables', TableViewSet, basename='table')
router.register(r'reservations', ReservationViewSet, basename='reservation')
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    # ✅ QR Menu per Table
    path(
        'public/table/<int:table_id>/menu/',
        PublicTableMenuView.as_view(),
        name='public-table-menu',
    ),
    path(
        'public/table/<int:table_id>/order/',
        PublicTableOrderCreateView.as_view(),
        name='public-table-order',
    ),

    # ✅ QR Menu per Store (المنيو العام)
    path(
        'public/store/<int:store_id>/menu/',
        PublicStoreMenuView.as_view(),
        name='public-store-menu',
    ),
    path(
        'public/store/<int:store_id>/order/',
        PublicStoreOrderCreateView.as_view(),
        name='public-store-order',
    ),
]

urlpatterns += router.urls
