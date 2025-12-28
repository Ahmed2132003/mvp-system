from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import User, Store, Employee
from core.permissions import IsSuperUser
from core.serializers.admin import AdminUserSerializer


class AdminUserViewSet(viewsets.ModelViewSet):
    """
    إدارة كاملة للحسابات بواسطة السوبر يوزر فقط:
    - قائمة بكل الحسابات + فلترة حسب الدور
    - تعديل بيانات أساسية
    - حذف حساب
    - تعليم/إزالة الدفع (is_payment_verified)
    - ربط/إزالة ستور
    """

    serializer_class = AdminUserSerializer
    permission_classes = [IsSuperUser]
    queryset = User.objects.all().select_related("employee").prefetch_related("owned_stores")

    def get_queryset(self):
        qs = super().get_queryset()
        role_param = self.request.query_params.get("role")
        if role_param:
            qs = qs.filter(role__in=[r.strip() for r in role_param.split(",") if r.strip()])
        return qs.order_by("-id")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_superuser:
            return Response({"detail": "لا يمكن حذف حساب السوبر يوزر."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="set-payment")
    def set_payment(self, request, pk=None):
        user = self.get_object()
        verified = request.data.get("verified")

        if verified is None:
            return Response({"detail": "حقل verified مطلوب (true/false)."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_payment_verified = bool(verified)
        user.save(update_fields=["is_payment_verified"])
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="link-store")
    def link_store(self, request, pk=None):
        """
        ربط ستور بحساب:
        - Owner: يصبح مالك الستـور
        - Manager/Staff: يتم إنشاء/تحديث Employee بالستور المحدد
        """
        user = self.get_object()
        store_id = request.data.get("store_id")
        if not store_id:
            return Response({"detail": "store_id مطلوب."}, status=status.HTTP_400_BAD_REQUEST)

        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({"detail": "Store غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        # Owner: تعيين كمالك للستور
        if user.role == User.RoleChoices.OWNER:
            store.owner = user
            store.save(update_fields=["owner"])
            user.refresh_from_db()
            return Response(self.get_serializer(user).data, status=status.HTTP_200_OK)

        # Manager/Staff
        if user.role in [User.RoleChoices.MANAGER, User.RoleChoices.STAFF]:
            employee, _ = Employee.objects.get_or_create(user=user, defaults={"store": store})
            if employee.store_id != store.id:
                employee.store = store
                employee.save(update_fields=["store"])
            user.refresh_from_db()
            return Response(self.get_serializer(user).data, status=status.HTTP_200_OK)

        return Response({"detail": "نوع الحساب غير مدعوم للربط."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="unlink-store")
    def unlink_store(self, request, pk=None):
        """
        إزالة الربط بالستور:
        - Owner: إزالة الملكية عن Store محدد
        - Manager/Staff: غير مدعوم لأن الموظف يجب أن يرتبط بستور
        """
        user = self.get_object()
        store_id = request.data.get("store_id")
        if not store_id:
            return Response({"detail": "store_id مطلوب."}, status=status.HTTP_400_BAD_REQUEST)

        store = Store.objects.filter(id=store_id).first()
        if not store:
            return Response({"detail": "Store غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        if user.role == User.RoleChoices.OWNER:
            if store.owner_id != user.id:
                return Response({"detail": "الستور غير مملوك لهذا الحساب."}, status=status.HTTP_400_BAD_REQUEST)
            store.owner = None
            store.save(update_fields=["owner"])
            user.refresh_from_db()
            return Response(self.get_serializer(user).data, status=status.HTTP_200_OK)

        if user.role in [User.RoleChoices.MANAGER, User.RoleChoices.STAFF]:
            return Response(
                {"detail": "لا يمكن إزالة الستور من مدير/موظف بدون تعيين بديل."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"detail": "نوع الحساب غير مدعوم للربط."}, status=status.HTTP_400_BAD_REQUEST)