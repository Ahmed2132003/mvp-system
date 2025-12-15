# stores/views.py
from core.models import Store, StoreSettings, Employee, User
from core.permissions import IsOwner, IsSuperUser
from .serializers import StoreSerializer, StoreSettingsSerializer, StoreCreateSerializer
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from core.utils.store_context import get_user_default_store
from .serializers import StoreSerializer, StoreSettingsSerializer, StoreCreateSerializer

def get_user_store(user):
    """
    يرجع الفرع الأساسي المرتبط بالمستخدم:
    - لو مستخدم عادي: من employee.store
    - لو Owner: من الفروع اللي هو مالكها (أول واحد حالياً)
    """
    try:
        employee = user.employee
    except Employee.DoesNotExist:
        employee = None

    if employee and employee.store:
        return employee.store

    return Store.objects.filter(owner=user).first()

class StoreViewSet(viewsets.ModelViewSet):
    """
    بيانات الفرع الحالي (Owner فقط للتعديل)
    """
    serializer_class = StoreSerializer
    permission_classes = [IsOwner]
    http_method_names = ['get', 'put', 'patch']

    def get_queryset(self):
        user = self.request.user

        # Owner: كل الفروع اللي بيملكها
        # Manager/Staff: get_user_default_store هيرجع employee.store
        store = get_user_default_store(user)
        if store:
            return Store.objects.filter(pk=store.pk)

        return Store.objects.none()

    @action(detail=False, methods=['get'], url_path='available', permission_classes=[IsAuthenticated])
    def available(self, request):
        """
        GET /stores/available/
        يرجّع كل الفروع المتاحة للمستخدم الحالي:
        - superuser: كل الفروع
        - owner: owned_stores
        - manager/staff: employee.store فقط
        """
        user = request.user

        if user.is_superuser:
            qs = Store.objects.all().order_by("id")
        else:
            # owner stores
            qs = Store.objects.filter(owner=user).order_by("id")

            # employee store (manager/staff)
            try:
                emp_store_id = user.employee.store_id
                if emp_store_id:
                    qs = qs.union(Store.objects.filter(id=emp_store_id))
            except Exception:
                pass

            qs = qs.order_by("id")

        return Response(StoreSerializer(qs, many=True).data)


class StoreSettingsViewSet(viewsets.GenericViewSet):
    """
    إعدادات الفرع (Owner فقط للتعديل)
    """
    serializer_class = StoreSettingsSerializer
    permission_classes = [IsOwner]

    def _get_store_settings(self):
        store = get_user_default_store(self.request.user)
        if not store:
            return None
        return getattr(store, 'settings', None)

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='current')
    def current(self, request):
        settings_obj = self._get_store_settings()
        if not settings_obj:
            return Response(
                {'detail': 'لا يوجد فرع مرتبط بالمستخدم الحالي.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method in ['PUT', 'PATCH']:
            serializer = self.get_serializer(
                settings_obj,
                data=request.data,
                partial=(request.method == 'PATCH')
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        serializer = self.get_serializer(settings_obj)
        return Response(serializer.data)


class AdminStoreViewSet(viewsets.ModelViewSet):
    """
    إنشاء Store من السوبر يوزر الحقيقي فقط (is_superuser=True)
    POST /admin/stores/
    """
    queryset = Store.objects.all()
    serializer_class = StoreCreateSerializer
    permission_classes = [IsAuthenticated, IsSuperUser]
    http_method_names = ['post']
