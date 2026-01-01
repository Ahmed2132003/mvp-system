# backend/orders/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TableViewSet,
    OrderViewSet,    
    InvoiceViewSet,
    ReservationViewSet,
    PublicTableMenuView,
    PublicTableOrderCreateView,
    PublicStoreMenuView,
    PublicStoreOrderCreateView,
    PublicStoreTablesView,
    PublicReservationCreateView,
    PublicInvoiceDetailView,
)

router = DefaultRouter()
router.register(r"tables", TableViewSet, basename="table")
router.register(r"reservations", ReservationViewSet, basename="reservation")
router.register(r"invoices", InvoiceViewSet, basename="invoice")
router.register(r"", OrderViewSet, basename="order")

app_name = "orders"

public_urlpatterns = [
    # ✅ أولاً: public endpoints (عشان مافيش أي احتمالات routing غريبة)
    path(
        "public/table/<int:table_id>/menu/",
        view=PublicTableMenuView.as_view(),
        name="public-table-menu",
    ),
    path(
        "public/invoices/<str:invoice_number>/",
        view=PublicInvoiceDetailView.as_view(),
        name="public-invoice-detail",
    ),
    path(
        "public/table/<int:table_id>/order/",
        view=PublicTableOrderCreateView.as_view(),
        name="public-table-order",
    ),
    path(
        "public/store/<int:store_id>/menu/",
        view=PublicStoreMenuView.as_view(),
        name="public-store-menu",
    ),
    path(
        "public/store/<int:store_id>/tables/",
        view=PublicStoreTablesView.as_view(),
        name="public-store-tables",
    ),
    path(
        "public/store/<int:store_id>/reservation/",
        view=PublicReservationCreateView.as_view(),
        name="public-store-reservation",
    ),
    path(
        "public/store/<int:store_id>/order/",
        view=PublicStoreOrderCreateView.as_view(),
        name="public-store-order",
    ),
]

# ✅ أخيراً: router endpoints
urlpatterns = public_urlpatterns + router.urls