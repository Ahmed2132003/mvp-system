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
router.register("tables", TableViewSet, basename="table")
router.register("reservations", ReservationViewSet, basename="reservation")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("", OrderViewSet, basename="order")

app_name = "orders"

urlpatterns = [
    # ===== Public endpoints (بدون Auth) =====
    path(
        "public/table/<int:table_id>/menu/",
        PublicTableMenuView.as_view(),
        name="public-table-menu",
    ),
    path(
        "public/invoices/<str:invoice_number>/",
        PublicInvoiceDetailView.as_view(),
        name="public-invoice-detail",
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

    # ===== Router endpoints (لوحة الإدارة / API الأساسية) =====
    path("", include(router.urls)),
]
