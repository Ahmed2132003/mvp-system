from datetime import timedelta

from typing import Optional

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError

from django.db import transaction
from django.db.utils import OperationalError, ProgrammingError
from django.db.models import Q, Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from .models import Table, Order, Reservation, OrderItem, Invoice
from .serializers import TableSerializer, OrderSerializer, ReservationSerializer, InvoiceSerializer
from .filters import OrderFilter, InvoiceFilter
from core.permissions import IsEmployeeOfStore, IsManager
from inventory.models import Item
from core.models import Store
from branches.models import Branch

# ✅ NEW: store switcher context
from core.utils.store_context import get_store_from_request, get_branch_from_request
from django.db.models import Sum
from .services.invoice import ensure_invoice_for_order

# =======================
# Helpers
# =======================
def ensure_aware(dt):    
    if not dt:
        return dt
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def paymob_is_enabled(store: Store) -> bool:
    """Helper to check PayMob toggle safely."""
    return bool((store.paymob_keys or {}).get("enabled", False))


def select_branch_for_store(store: Store, branch_id: Optional[int] = None):
    """Return an active branch for the store, giving priority to the requested id."""
    branches = store.branches.filter(is_active=True)
    branch_pk = None
    if branch_id is not None:
        try:
            branch_pk = int(branch_id)
        except (TypeError, ValueError):
            branch_pk = None

    if branch_pk:
        try:
            return branches.get(pk=branch_pk)
        except Branch.DoesNotExist:
            pass
    return branches.first()


def trending_items_for_store(
    store: Store, branch: Optional[Branch] = None, limit: int = 6
):
    """Return lightweight list of top-selling items for a store/branch in recent days."""
    recent_from = timezone.now() - timedelta(days=14)
    qs = OrderItem.objects.filter(
        order__store=store,
        order__created_at__gte=recent_from,
    ).exclude(order__status="CANCELLED")

    if branch:
        qs = qs.filter(order__branch=branch)

    trending_qs = (
        qs.values("item_id")
        .annotate(total_qty=Sum("quantity"))
        .order_by("-total_qty")[:limit]
    )

    ids_in_order = [row["item_id"] for row in trending_qs if row["item_id"]]
    items_lookup = {
        item.id: item
        for item in Item.objects.filter(store=store, id__in=ids_in_order).select_related(
            "category"
        )
    }

    result = []
    for row in trending_qs:
        item = items_lookup.get(row["item_id"])
        if not item:
            continue
        result.append(
            {
                "id": item.id,
                "name": item.name,
                "unit_price": float(item.unit_price),
                "category_id": item.category_id,
                "category_name": item.category.name if item.category else None,
                "barcode": item.barcode,
                "total_qty": row["total_qty"],
            }
        )

    return result


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

        active_reservations = Prefetch(
            "reservations",
            queryset=Reservation.objects.filter(status__in=["PENDING", "CONFIRMED"]),
            to_attr="active_reservations",
        )

        branch = get_branch_from_request(self.request, store=store, allow_store_default=False)
        qs = Table.objects.filter(store=store).prefetch_related(active_reservations)
        if branch:
            qs = qs.filter(Q(branch=branch) | Q(branch__isnull=True))
        return qs.order_by("number")
    
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
        branch = get_branch_from_request(self.request, store=store, allow_store_default=True)
        serializer.save(store=store, branch=branch)
        

# =======================
# OrderViewSet (لوحة الكاشير / التقارير)
# =======================
class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsEmployeeOfStore]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = OrderFilter
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

            order = serializer.save(store=store, branch=branch)
            ensure_invoice_for_order(order)
            
    @action(detail=False, methods=["get"], url_path="kds")
    def kds_orders(self, request):
        qs = self.get_queryset().filter(
            Q(status__in=["PENDING", "PREPARING", "READY"]) | Q(status="PAID", is_paid=True)
        ).order_by("created_at")

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsEmployeeOfStore]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = InvoiceFilter
    search_fields = ["invoice_number", "customer_name", "customer_phone"]
    ordering_fields = ["created_at", "total"]
    ordering = ["-created_at"]
    lookup_field = "invoice_number"

    def get_queryset(self):
        store = get_store_from_request(self.request)
        if not store:
            return Invoice.objects.none()

        qs = Invoice.objects.filter(store=store).select_related(
            "branch", "store", "order__table"
        ).prefetch_related("order__items__item")

        branch = get_branch_from_request(
            self.request, store=store, allow_store_default=False
        )
        if branch:
            qs = qs.filter(branch=branch)
        return qs

    @action(detail=False, methods=["post"], url_path="for-order")
    def for_order(self, request):
        store = get_store_from_request(request)
        if not store:
            return Response(
                {"detail": "لا يوجد متجر مرتبط بهذا الحساب."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order_id = request.data.get("order_id")
        if not order_id:
            return Response(
                {"detail": "رقم الطلب مطلوب لإنشاء الفاتورة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = get_object_or_404(Order, pk=order_id, store=store)
        invoice = ensure_invoice_for_order(order)
        serializer = self.get_serializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
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

        branch = get_branch_from_request(request, store=store, allow_store_default=True)

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

        qs = Table.objects.at_store(store)
        if branch:
            qs = qs.at_branch(branch)

        qs = qs.available_at_time(res_time, duration).for_capacity(party_size).order_by("number")
        availability_map = {table.id: True for table in qs}

        serializer = TableSerializer(qs, many=True, context={"availability_map": availability_map})
        return Response(serializer.data, status=status.HTTP_200_OK)


# =======================
# Public Endpoints للـ QR Menu (بدون Auth)
# =======================
def _build_availability_map(qs, reservation_time=None, duration=60):
    """
    Helper to annotate availability per table id.
    If reservation_time not provided, returns empty map.
    """
    if not reservation_time:
        return {}

    if isinstance(qs, (list, tuple)):
        qs_list = list(qs)
        base_qs = Table.objects.filter(id__in=[table.id for table in qs_list if getattr(table, "id", None)])
    else:
        qs_list = list(qs)
        base_qs = qs

    try:
        duration_val = int(duration)
    except (TypeError, ValueError):
        duration_val = 60

    available_qs = base_qs.available_at_time(reservation_time, duration_val)
    available_ids = set(available_qs.values_list("id", flat=True))
    return {table.id: table.id in available_ids for table in qs_list}


class PublicInvoiceDetailView(APIView):
    """
    إرجاع تفاصيل الفاتورة باستخدام رقم الفاتورة (بدون تسجيل دخول)
    """

    permission_classes = [AllowAny]

    def get(self, request, invoice_number):
        invoice = get_object_or_404(
            Invoice.objects.select_related(
                "store", "branch", "order__table"
            ).prefetch_related("order__items__item"),
            invoice_number=invoice_number,
        )
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)


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
        branch_id = request.query_params.get("branch_id")
        branch = select_branch_for_store(store, branch_id)

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
                "phone": store.phone,
                "paymob_enabled": paymob_is_enabled(store),
            },
            "table": {
                "id": table.id,
                "number": table.number,
                "capacity": table.capacity,
                "is_available": table.is_available,
            },
            "branches": [
                {"id": b.id, "name": b.name}
                for b in store.branches.filter(is_active=True).order_by("name")
            ],
            "trending_items": trending_items_for_store(store, branch=branch),
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
        branch_id = request.data.get("branch_id")
        branch = select_branch_for_store(store, branch_id)

        if not branch:
            return Response(
                {"detail": "لا يوجد فرع متاح لهذا المتجر."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        if payment_method == "PAYMOB" and not paymob_is_enabled(store):
            return Response(
                {"detail": "الدفع عبر PayMob غير متاح لهذا الفرع."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = Order.objects.create(
                store=store,
                branch=branch,
                table=table,
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
            ensure_invoice_for_order(order)

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicStoreTablesView(APIView):
    """
    إرجاع طاولات الفرع (بدون Auth) مع حالة التوفر للوقت المطلوب
    """
    permission_classes = [AllowAny]

    def get(self, request, store_id):
        store = Store.objects.filter(pk=store_id).first()
        if not store:            
            return Response(
                {"detail": "المتجر غير متاح حالياً."},
                status=status.HTTP_404_NOT_FOUND,
            )

        branch_id = request.query_params.get("branch_id") or request.query_params.get("branch")
        branch = select_branch_for_store(store, branch_id)

        try:
            party_size = int(request.query_params.get("party_size", 1))
        except (TypeError, ValueError):
            party_size = 1
            
        qs = Table.objects.at_store(store).filter(is_active=True)
        if branch:
            qs = qs.at_branch(branch)
        if party_size and party_size > 0:
            qs = qs.for_capacity(party_size)

        res_time_param = request.query_params.get("time")
        duration = request.query_params.get("duration", 60)
        availability_map = {}
        if res_time_param:            
            res_time = ensure_aware(parse_datetime(res_time_param))
            if not res_time:
                return Response({"detail": "صيغة الوقت غير صحيحة."}, status=status.HTTP_400_BAD_REQUEST)
            availability_map = _build_availability_map(qs, res_time, duration)

        serializer = TableSerializer(
            qs.order_by("number"),
            many=True,
            context={"availability_map": availability_map},
        )

        return Response(
            {
                "store": {"id": store.id, "name": store.name},
                "branch": {"id": branch.id, "name": branch.name} if branch else None,
                "tables": serializer.data,
            }
        )


class PublicReservationCreateView(APIView):
    """
    إنشاء حجز طاولة من المنيو العام بدون تسجيل دخول
    """
    permission_classes = [AllowAny]

    def post(self, request, store_id):
        store = get_object_or_404(Store, pk=store_id)
        table_id = request.data.get("table")
        if not table_id:
            return Response({"detail": "يجب اختيار الطاولة."}, status=status.HTTP_400_BAD_REQUEST)

        table = get_object_or_404(Table, pk=table_id, store=store, is_active=True)

        branch_id = request.data.get("branch_id") or request.data.get("branch")
        branch = select_branch_for_store(store, branch_id)
        if branch and table.branch_id and table.branch_id != branch.id:
            return Response({"detail": "هذه الطاولة ليست ضمن هذا الفرع."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            party_size = int(request.data.get("party_size") or 1)
        except (TypeError, ValueError):
            party_size = 1
        if party_size > table.capacity:
            return Response({"detail": "عدد الأشخاص أكبر من سعة الطاولة."}, status=status.HTTP_400_BAD_REQUEST)

        reservation_time_param = request.data.get("reservation_time")
        reservation_time = ensure_aware(parse_datetime(reservation_time_param))
        if not reservation_time:
            return Response({"detail": "صيغة الوقت غير صحيحة."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            duration = int(request.data.get("duration") or 60)
        except (TypeError, ValueError):
            duration = 60
        availability_map = _build_availability_map([table], reservation_time, duration)
        if not availability_map.get(table.id):
            return Response({"detail": "الطاولة غير متاحة في هذا الوقت."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get("notes") or ""
        reservation = Reservation.objects.create(
            table=table,
            customer_name=request.data.get("customer_name") or "Guest",
            customer_phone=request.data.get("customer_phone") or "",
            reservation_time=reservation_time,
            party_size=party_size,
            status="CONFIRMED",
            duration=duration,
            notes=notes,
        )

        serializer = ReservationSerializer(reservation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicStoreMenuView(APIView):
    """
    يرجع بيانات الفرع + قائمة الأصناف للمنيو العام (بدون طاولة)
    """
    permission_classes = [AllowAny]
    
    def get(self, request, store_id):
        store = get_object_or_404(Store, pk=store_id)
        branch_id = request.query_params.get("branch_id")
        branch = select_branch_for_store(store, branch_id)

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

        paymob_enabled = paymob_is_enabled(store)

        data = {
            "store": {
                "id": store.id,
                "name": store.name,
                "address": store.address,
                "phone": store.phone,
                "paymob_enabled": paymob_enabled,  # ✅ جديد
            },
            "branches": [
                {"id": b.id, "name": b.name}
                for b in store.branches.filter(is_active=True).order_by("name")
            ],
            "trending_items": trending_items_for_store(store, branch=branch),
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
        branch_id = request.data.get("branch_id")
        branch = select_branch_for_store(store, branch_id)

        if not branch:
            return Response(
                {"detail": "لا يوجد فرع متاح لهذا المتجر."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        # ✅ منع PayMob لو مش مفعل للفرع␊
        paymob_enabled = paymob_is_enabled(store)
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
