# core/store_api.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Store, User


def get_user_store(user):
    """
    نفس منطقك:
    1) employee.store لو موجود
    2) لو OWNER: store.owner = user
    """
    # 1) employee.store
    emp = getattr(user, "employee", None)
    if emp and getattr(emp, "store", None):
        return emp.store

    # 2) owner store
    if getattr(user, "role", None) == User.RoleChoices.OWNER:
        s = Store.objects.filter(owner=user).first()
        if s:
            return s

    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_store(request):
    """
    GET /api/v1/core/stores/me/
    بيرجع بيانات الستور المرتبط باليوزر الحالي + QR attendance الموحد
    """
    store = get_user_store(request.user)
    if not store:
        return Response(
            {"detail": "لا يوجد متجر مرتبط بهذا الحساب. اربط الحساب بمتجر (Owner/Employee)."},
            status=404,
        )

    return Response(
        {
            "id": store.id,
            "name": store.name,
            "address": store.address,
            "phone": store.phone,
            "qr_menu_base64": store.qr_menu_base64,
            "qr_attendance_base64": store.qr_attendance_base64,  # ✅ ده اللي هتستخدمه في الفرونت
        },
        status=200,
    )
