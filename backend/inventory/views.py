from rest_framework import viewsets, status
from django.db.models import Count
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Category, Item, Inventory
from .serializers import CategorySerializer, ItemSerializer, InventorySerializer
from .filters import CategoryFilter, ItemFilter, InventoryFilter
from core.permissions import IsManager, IsEmployeeOfStore
from django.db import transaction
from django.db.models import Count, F


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CategoryFilter
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']

    def get_permissions(self):
        """
        ✅ GET للموظف (عشان POS/Inventory عرض)
        ✅ تعديل/إضافة/حذف للـ Manager فقط
        """
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsEmployeeOfStore()]
        return [IsManager()]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)

        qs = Category.objects.all()

        # لو اليوزر ليه employee و store
        if hasattr(user, 'employee') and getattr(user.employee, 'store', None):
            qs = qs.filter(store=user.employee.store)
        elif role != 'OWNER':
            # لا Owner ولا ليه store → مفروض ما يشوفش حاجة
            return Category.objects.none()

        # نضيف عدد الأصناف في كل كاتيجوري
        return qs.annotate(items_count=Count('items'))


class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ItemFilter
    search_fields = ['name', 'barcode']
    ordering_fields = ['name', 'unit_price', 'id']
    ordering = ['name']

    def get_permissions(self):
        """
        ✅ GET للموظف (STAFF) عشان شاشة POS
        ✅ تعديل/إضافة/حذف للـ Manager فقط
        """
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsEmployeeOfStore()]
        return [IsManager()]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)

        qs = Item.objects.all()

        if hasattr(user, 'employee') and getattr(user.employee, 'store', None):
            qs = qs.filter(store=user.employee.store)
        elif role != 'OWNER':
            return Item.objects.none()

        return qs


class InventoryViewSet(viewsets.ModelViewSet):
    serializer_class = InventorySerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = InventoryFilter
    search_fields = ['item__name', 'branch__name']
    ordering_fields = ['quantity', 'item__name', 'branch__name', 'last_updated']
    ordering = ['-quantity']

    def get_permissions(self):
        """
        ✅ عرض المخزون GET للموظف
        ✅ أي تعديل للمخزون (adjust-stock) للـ Manager فقط
        """
        if self.action in ("adjust_stock",):
            return [IsManager()]

        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsEmployeeOfStore()]

        return [IsManager()]

    def get_queryset(self):
        from .models import Inventory  # لتفادي أي circular imports غريبة

        user = self.request.user
        role = getattr(user, 'role', None)

        qs = Inventory.objects.select_related('item', 'branch')

        # لو فيه Employee مربوط بستور
        if hasattr(user, 'employee') and getattr(user.employee, 'store', None):
            store = user.employee.store
            qs = qs.filter(branch__store=store)
        elif role != 'OWNER':
            return Inventory.objects.none()

        # فلتر حالة المخزون (status) من الـ query params: low / out
        status_param = self.request.query_params.get('status')
        if status_param == 'low':
            qs = qs.filter(is_low=True)
        elif status_param == 'out':
            qs = qs.filter(quantity=0)

        return qs

    @action(detail=True, methods=['post'], url_path='adjust-stock')
    def adjust_stock(self, request, pk=None):
        """
        تعديل مخزون صنف معين في فرع معين:
        body:
        {
          "movement_type": "IN" | "OUT",
          "change": 5,
          "reason": "جرد" (اختياري)
        }
        """
        from .models import InventoryMovement  # استدعاء هنا عشان نتفادى أي مشاكل استيراد

        inventory = self.get_object()

        movement_type = request.data.get('movement_type', 'IN')
        try:
            change = int(request.data.get('change', 0))
        except (TypeError, ValueError):
            return Response(
                {"detail": "قيمة الكمية (change) غير صالحة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '').strip() or None

        if change <= 0:
            return Response(
                {"detail": "لازم الكمية تكون رقم أكبر من صفر"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # لو خصم → نخلي التغيير بالسالب
        if movement_type == 'OUT':
            change = -change
        elif movement_type != 'IN':
            return Response(
                {"detail": "نوع الحركة غير صالح. استخدم IN أو OUT"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # التحقق من إعدادات الفرع (السماح بمخزون سالب)
        store_settings = getattr(inventory.branch.store, 'settings', None)
        allow_negative = store_settings.allow_negative_stock if store_settings else False

        if not allow_negative and inventory.quantity + change < 0:
            return Response(
                {"detail": "لا يمكن أن يصبح المخزون أقل من صفر حسب إعدادات الفرع"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # تحديث الكمية باستخدام F expressions
            type(self).queryset = self.get_queryset()  # ضمان استخدام الـ queryset الصح
            from .models import Inventory as InventoryModel
            InventoryModel.objects.filter(pk=inventory.pk).update(
                quantity=F('quantity') + change
            )

            # نرجّع القيم الحقيقية بعد التحديث (وبعد save() هيحدّث is_low)
            inventory.refresh_from_db()

            # إنشاء حركة المخزون
            employee = getattr(request.user, 'employee', None)

            InventoryMovement.objects.create(
                inventory=inventory,
                item=inventory.item,
                branch=inventory.branch,
                change=change,
                movement_type=movement_type,
                reason=reason,
                created_by=employee,
            )

        serializer = self.get_serializer(inventory)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='movements')
    def movements(self, request, pk=None):
        """
        إرجاع آخر 50 حركة مخزون للعنصر في الفرع ده
        """
        inventory = self.get_object()
        movements = inventory.movements.select_related('created_by__user').order_by('-created_at')[:50]

        data = []
        for m in movements:
            created_by_name = None
            if m.created_by and m.created_by.user:
                created_by_name = m.created_by.user.name or m.created_by.user.email

            data.append({
                "id": m.id,
                "change": m.change,
                "movement_type": m.movement_type,
                "reason": m.reason,
                "created_at": m.created_at,
                "created_by": created_by_name,
            })

        return Response(data, status=status.HTTP_200_OK)
