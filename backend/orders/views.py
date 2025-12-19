from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError

from django.db import transaction
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from .models import Table, Order, Reservation, OrderItem
from .serializers import TableSerializer, OrderSerializer, ReservationSerializer
from core.permissions import IsEmployeeOfStore, IsManager
from inventory.models import Item
from core.models import Store

# ✅ NEW: store switcher context
from core.utils.store_context import get_store_from_request, get_branch_from_request

# =======================
# Helpers
# =======================
def ensure_aware(dt):
    if not dt:
        return dt
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


# =======================
# TableViewSet (لوحة الإدارة)
# =======================
class TableViewSet(viewsets.ModelViewSet):
    serializer_class = TableSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["number"]
    ordering_fields = ["number", "capacity", "is_available"]
    ordering = ["number"]

    def get_permissions(self):
        """
        ✅ السماح للـ STAFF بقراءة الطاولات (GET فقط) عشان POS
        ✅ منع CREATE/UPDATE/DELETE إلا للـ Manager/Owner
        """
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsEmployeeOfStore()]
        return [IsManager()]

    def get_queryset(self):
        store = get_store_from_request(self.request)
        if not store:
            return Table.objects.none()

        return Table.objects.filter(store=store).order_by("number")

    def perform_create(self, serializer):
        """
        ✅ حل نهائي لمشكلة:
        IntegrityError: null value in column "store_id"
        + يدعم store_id من الـ query
        """
        store = get_store_from_request(self.request)
        if not store:
            raise ValidationError(
                {"detail": "لا يوجد متجر مرتبط بهذا الحساب أو store_id غير صحيح."}
            )
        serializer.save(store=store)


# =======================
# OrderViewSet (لوحة الكاشير / التقارير)
# =======================
class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsEmployeeOfStore]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "table", "branch", "created_at"]
    search_fields = ["table__number", "customer_name"]
    ordering_fields = ["created_at", "total", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        store = get_store_from_request(self.request)
        if not store:
            return Order.objects.none()

        qs = Order.objects.filter(store=store).prefetch_related("items__item", "payments")

        branch = get_branch_from_request(self.request, store=store)
        if branch:
            qs = qs.filter(branch=branch)

        return qs
    
    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except (ProgrammingError, OperationalError) as e:
            print("Order list DB error:", e)
            return Response([], status=200)

    def perform_create(self, serializer):
        with transaction.atomic():
            store = get_store_from_request(self.request)
            if not store:
                raise ValidationError({"detail": "لا يوجد متجر مرتبط بهذا الحساب أو store_id غير صحيح."})

            branch = get_branch_from_request(self.request, store=store, allow_store_default=True)
            if not branch:
                raise ValidationError({"detail": "لا يوجد فرع مرتبط بهذا الحساب."})

            serializer.save(store=store, branch=branch)
            
    @action(detail=False, methods=["get"], url_path="kds")
    def kds_orders(self, request):
        qs = self.get_queryset().filter(
            Q(status__in=["PENDING", "PREPARING", "READY"]) | Q(status="PAID", is_paid=True)
        ).order_by("created_at")

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

# =======================
# ReservationViewSet
# =======================
class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsEmployeeOfStore]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "table", "reservation_time"]
    search_fields = ["customer_name", "customer_phone"]
    ordering_fields = ["reservation_time", "created_at"]
    ordering = ["-reservation_time"]

    def get_queryset(self):
        store = get_store_from_request(self.request)
        if not store:
            return Reservation.objects.none()

        qs = Reservation.objects.filter(table__store=store)

        # فلترة التاريخ (from/to) لو موجودة
        from_param = self.request.query_params.get("from")
        to_param = self.request.query_params.get("to")

        if from_param:
            dt_from = ensure_aware(parse_datetime(from_param))
            if dt_from:
                qs = qs.filter(reservation_time__gte=dt_from)

        if to_param:
            dt_to = ensure_aware(parse_datetime(to_param))
            if dt_to:
                qs = qs.filter(reservation_time__lte=dt_to)

        return qs

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save()

    @action(detail=False, methods=["get"], url_path="available-tables")
    def available_tables(self, request):
        """
        ✅ حل نهائي لمشكلة RelatedObjectDoesNotExist + HTML
        بيرجع JSON Error واضح بدل أي crash
        + يدعم store_id
        """
        store = get_store_from_request(request)
        if not store:
            return Response(
                {"detail": "لا يوجد متجر مرتبط بهذا الحساب أو store_id غير صحيح."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reservation_time = request.query_params.get("time")
        if not reservation_time:
            return Response(
                {"detail": "يجب تحديد وقت الحجز (time)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        res_time = parse_datetime(reservation_time)
        res_time = ensure_aware(res_time)
        if not res_time:
            return Response(
                {"detail": "صيغة الوقت غير صحيحة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duration = int(request.query_params.get("duration", 60))
        party_size = int(request.query_params.get("party_size", 1))

        qs = (
            Table.objects.at_store(store)
            .available_at_time(res_time, duration)
            .for_capacity(party_size)
            .order_by("number")
        )

        serializer = TableSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# =======================
# Public Endpoints للـ QR Menu (بدون Auth)
# =======================
class PublicTableMenuView(APIView):
    """
    يرجع بيانات الفرع + الطاولة + قائمة الأصناف للعميل (QR menu)
    """
    permission_classes = [AllowAny]

    def get(self, request, table_id):
        table = get_object_or_404(
            Table.objects.select_related("store"),
            pk=table_id,
            is_active=True,
        )
        store = table.store

        items_qs = Item.objects.filter(
            store=store,
            is_active=True,
        ).select_related("category")

        items_data = []
        for item in items_qs:
            items_data.append(
                {
                    "id": item.id,
                    "name": item.name,
                    "unit_price": float(item.unit_price),
                    "category_id": item.category_id,
                    "category_name": item.category.name if item.category else None,
                    "barcode": item.barcode,
                }
            )

        data = {
            "store": {
                "id": store.id,
                "name": store.name,
                "address": store.address,
            },
            "table": {
                "id": table.id,
                "number": table.number,
                "capacity": table.capacity,
                "is_available": table.is_available,
            },
            "items": items_data,
        }
        return Response(data, status=status.HTTP_200_OK)


class PublicTableOrderCreateView(APIView):
    """
    إنشاء طلب جديد من صفحة المينيو للعميل (بدون Auth)
    """
    permission_classes = [AllowAny]

    def post(self, request, table_id):
        table = get_object_or_404(
            Table.objects.select_related("store"),
            pk=table_id,
            is_active=True,
        )
        store = table.store
        branch = store.branches.first()

        items_data = request.data.get("items", [])
        if not items_data:
            return Response(
                {"detail": "لا يمكن إنشاء طلب بدون أصناف."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_name = request.data.get("customer_name") or None
        customer_phone = request.data.get("customer_phone") or None
        notes = request.data.get("notes") or ""

        with transaction.atomic():
            order = Order.objects.create(
                store=store,
                branch=branch,
                table=table,
                customer_name=customer_name,
                customer_phone=customer_phone,
                notes=notes,
                status="PENDING",
            )

            for row in items_data:
                item_id = row.get("item")
                quantity = int(row.get("quantity", 1))
                if not item_id or quantity <= 0:
                    continue

                item = get_object_or_404(Item, pk=item_id, store=store)
                OrderItem.objects.create(
                    order=order,
                    item=item,
                    quantity=quantity,
                    unit_price=item.unit_price,
                )

            order.update_total()

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicStoreMenuView(APIView):
    """
    يرجع بيانات الفرع + قائمة الأصناف للمنيو العام (بدون طاولة)
    """
    permission_classes = [AllowAny]

    def get(self, request, store_id):
        store = get_object_or_404(Store, pk=store_id)

        items_qs = Item.objects.filter(
            store=store,
            is_active=True,
        ).select_related("category")

        items_data = []
        for item in items_qs:
            items_data.append(
                {
                    "id": item.id,
                    "name": item.name,
                    "unit_price": float(item.unit_price),
                    "category_id": item.category_id,
                    "category_name": item.category.name if item.category else None,
                    "barcode": item.barcode,
                }
            )

        paymob_enabled = bool((store.paymob_keys or {}).get("enabled", False))

        data = {
            "store": {
                "id": store.id,
                "name": store.name,
                "address": store.address,
                "phone": store.phone,
                "paymob_enabled": paymob_enabled,  # ✅ جديد
            },
            "items": items_data,
        }
        return Response(data, status=status.HTTP_200_OK)


class PublicStoreOrderCreateView(APIView):
    """
    إنشاء طلب جديد من المنيو العام للفرع (بدون Auth)
    - يدعم داخل المطعم / دليفري
    """
    permission_classes = [AllowAny]

    def post(self, request, store_id):
        store = get_object_or_404(Store, pk=store_id)
        branch = store.branches.first()

        items_data = request.data.get("items", [])
        if not items_data:
            return Response(
                {"detail": "لا يمكن إنشاء طلب بدون أصناف."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_name = request.data.get("customer_name") or None
        customer_phone = request.data.get("customer_phone") or None
        notes = request.data.get("notes") or ""
        order_type = request.data.get("order_type", "IN_STORE")
        payment_method = request.data.get("payment_method", "CASH")
        delivery_address = request.data.get("delivery_address") or None

        if order_type == "DELIVERY" and not delivery_address:
            return Response(
                {"detail": "العنوان مطلوب في حالة الدليفري."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ منع PayMob لو مش مفعل للفرع
        paymob_enabled = bool((store.paymob_keys or {}).get("enabled", False))
        if payment_method == "PAYMOB" and not paymob_enabled:
            return Response(
                {"detail": "الدفع عبر PayMob غير متاح لهذا الفرع."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = Order.objects.create(
                store=store,
                branch=branch,
                table=None,
                customer_name=customer_name,
                customer_phone=customer_phone,
                notes=notes,
                order_type=order_type,
                payment_method=payment_method,
                delivery_address=delivery_address,
                status="PENDING",
            )

            for row in items_data:
                item_id = row.get("item")
                quantity = int(row.get("quantity", 1))
                if not item_id or quantity <= 0:
                    continue

                item = get_object_or_404(Item, pk=item_id, store=store)
                OrderItem.objects.create(
                    order=order,
                    item=item,
                    quantity=quantity,
                    unit_price=item.unit_price,
                )

            order.update_total()

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
