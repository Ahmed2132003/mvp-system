# core/utils/store_context.py

from rest_framework.exceptions import PermissionDenied
from core.models import Store, Employee


def get_user_default_store(user):
    """
    Default store:
    - superuser: أول Store
    - staff/manager: employee.store
    - owner: أول store يملكه
    """
    if user.is_superuser:
        return Store.objects.order_by("id").first()

    try:
        emp = user.employee
        if emp and emp.store_id:
            return emp.store
    except Employee.DoesNotExist:
        pass

    return Store.objects.filter(owner=user).order_by("id").first()


def user_can_access_store(user, store: Store) -> bool:
    if not store:
        return False

    if user.is_superuser:
        return True

    # owner
    if store.owner_id == user.id:
        return True

    # employee (manager/staff)
    try:
        emp = user.employee
        return emp.store_id == store.id
    except Employee.DoesNotExist:
        return False


def get_store_from_request(request):
    """
    - لو store_id موجود في query params -> نتحقق من الصلاحيات ونرجع الـ store
    - لو مش موجود -> نرجع default store للمستخدم
    """
    store_id = request.query_params.get("store_id")
    if store_id:
        store = Store.objects.filter(id=store_id).first()
        if not store:
            return None
        if not user_can_access_store(request.user, store):
            raise PermissionDenied("لا تملك صلاحية الوصول لهذا الفرع.")
        return store

    return get_user_default_store(request.user)
