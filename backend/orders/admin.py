# backend/orders/admin.py
from django.contrib import admin
from django.utils.html import format_html

from .models import Table, Order, OrderItem, Payment, Reservation, Invoice


# =======================
# Table Admin
# =======================
@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'number',
        'store',
        'capacity',
        'is_available',
        'is_active',
        'qr_preview',
    )
    list_filter = ('store', 'is_available', 'is_active')
    search_fields = ('number', 'store__name')
    readonly_fields = ('qr_code', 'qr_code_base64', 'qr_preview')

    def qr_preview(self, obj):
        if obj.qr_code:
            return format_html('<img src="{}" width="120" height="120" />', obj.qr_code.url)
        return "لا يوجد"
    qr_preview.short_description = "QR Code"


# =======================
# Inlines للـ Order
# =======================
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('unit_price', 'subtotal')


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ('created_at',)


# =======================
# Order Admin
# =======================
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'store',
        'branch',
        'table',
        'customer_name',
        'status',
        'is_paid',
        'total',
        'created_at',
    )
    list_filter = ('store', 'branch', 'status', 'is_paid', 'created_at')    
    search_fields = ('id', 'customer_name', 'customer_phone', 'table__number')
    date_hierarchy = 'created_at'
    readonly_fields = (
        'total',
        'created_at',
        'updated_at',
    )
    inlines = [OrderItemInline, PaymentInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # عشان الأداء
        return qs.select_related('store', 'branch', 'table')


# =======================
# Reservation Admin
# =======================
@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'table',
        'customer_name',
        'customer_phone',
        'reservation_time',
        'party_size',
        'status',
        'created_at',
    )
    list_filter = ('status', 'reservation_time', 'table__store')
    search_fields = ('customer_name', 'customer_phone', 'table__number')
    date_hierarchy = 'reservation_time'
    readonly_fields = ('created_at',)


# =======================
# Payment Admin مستقل (لو حابب تشوفها لوحدها)
# =======================
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'order',
        'gateway',
        'amount',
        'status',
        'transaction_id',
        'created_at',
    )
    list_filter = ('gateway', 'status', 'created_at')
    search_fields = ('order__id', 'transaction_id')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'invoice_number',
        'order',
        'store',
        'branch',
        'total',
        'created_at',
    )
    search_fields = ('invoice_number', 'customer_name', 'customer_phone')
    list_filter = ('store', 'branch', 'order_type', 'created_at')
    readonly_fields = ('created_at',)