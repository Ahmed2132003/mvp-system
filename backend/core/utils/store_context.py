# core/utils/store_context.py

from rest_framework.exceptions import PermissionDenied
from core.models import Store, Employee
from branches.models import Branch

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


def get_employee_branch(user):
    try:
        return user.employee.branch
    except Employee.DoesNotExist:
        return None


def user_can_access_branch(user, branch: Branch) -> bool:
    if not branch:
        return False

    if user.is_superuser:
        return True

    if user_can_access_store(user, branch.store):
        if getattr(user, "role", None) in ["OWNER", "MANAGER"]:
            return True

        try:
            return user.employee.branch_id == branch.id
        except Employee.DoesNotExist:
            return False

    return False


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


def get_branch_from_request(request, store: Store = None, allow_store_default: bool = False):
    store = store or get_store_from_request(request)
    if not store:
        return None

    branch_param = request.query_params.get("branch") or request.query_params.get("branch_id")
    if branch_param:
        branch = Branch.objects.filter(id=branch_param, store=store).first()
        if not branch:
            raise PermissionDenied("لا تملك صلاحية الوصول لهذا الفرع.")

        if not user_can_access_branch(request.user, branch):
            raise PermissionDenied("لا تملك صلاحية الوصول لهذا الفرع.")

        return branch

    employee_branch = get_employee_branch(request.user)
    if employee_branch and employee_branch.store_id == store.id:
        return employee_branch

    if allow_store_default:
        return store.branches.first()

    return None