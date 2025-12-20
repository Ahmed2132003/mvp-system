# backend/orders/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TableViewSet,
    OrderViewSet,
    ReservationViewSet,
    PublicTableMenuView,
    PublicTableOrderCreateView,
    PublicStoreMenuView,
    PublicStoreOrderCreateView,
    PublicStoreTablesView,
    PublicReservationCreateView,
)

router = DefaultRouter()

router.register(r"tables", TableViewSet, basename="table")
router.register(r"reservations", ReservationViewSet, basename="reservation")
router.register(r"", OrderViewSet, basename="order")

urlpatterns = [
    # ✅ أولاً: public endpoints (عشان مافيش أي احتمالات routing غريبة)
    path(
        "public/table/<int:table_id>/menu/",
        PublicTableMenuView.as_view(),
        name="public-table-menu",
    ),
    path(
        "public/table/<int:table_id>/order/",
        PublicTableOrderCreateView.as_view(),
        name="public-table-order",
    ),

    path(
        "public/store/<int:store_id>/menu/",
        PublicStoreMenuView.as_view(),
        name="public-store-menu",
    ),
    path(
        "public/store/<int:store_id>/tables/",
        PublicStoreTablesView.as_view(),
        name="public-store-tables",
    ),
    path(
        "public/store/<int:store_id>/reservation/",
        PublicReservationCreateView.as_view(),
        name="public-store-reservation",
    ),
    path(
        "public/store/<int:store_id>/order/",
        PublicStoreOrderCreateView.as_view(),
        name="public-store-order",
    ),

    # ✅ أخيراً: router endpoints
    path("", include(router.urls)),
]
