from rest_framework import permissions

from core.models import Employee

class IsSuperUser(permissions.BasePermission):
    """سوبر يوزر Django الحقيقي فقط"""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_superuser
        )


class HasActiveSubscription(permissions.BasePermission):
    """
    يمنع أصحاب ومديري الحسابات من استخدام النظام بعد انتهاء التجربة المجانية
    ما لم يتم توثيق الدفع.
    """
    message = "انتهت الفترة التجريبية الخاصة بحسابك. برجاء التواصل مع الشركة للترقية وتفعيل الحساب."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # السوبر يوزر خارج القيود
        if getattr(user, "is_superuser", False):
            return True

        try:
            return getattr(user, "has_active_access", True)
        except Exception:
            return True


class IsOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'OWNER'            
        )


class IsManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and (
                request.user.is_superuser or
                getattr(request.user, 'role', None) in ['OWNER', 'MANAGER']
            )
        )
        

class IsCashier(permissions.BasePermission):
    """
    ملاحظة: عندك في User.RoleChoices مفيش CASHIER، الموجود STAFF.
    فخليت CASHIER = STAFF علشان مايحصلش Permission غلط.
    """
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            getattr(request.user, 'role', None) in ['OWNER', 'MANAGER', 'STAFF']
        )


class IsStaff(permissions.BasePermission):
    """أي موظف تابع لمتجر (صاحب/مدير/موظف)"""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        try:
            return request.user.employee.store is not None
        except (AttributeError, Employee.DoesNotExist):
            return False

class IsOwnerOfStore(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role != 'OWNER':
            return False

        if hasattr(obj, 'store'):
            return obj.store.owner == request.user

        return False


class IsEmployeeOfStore(permissions.BasePermission):
    """
    أي موظف يشتغل في نفس المتجر بتاع الـ object
    (أقوى وأدق permission في النظام)
    """
    message = "غير مسموح لك بالوصول إلى بيانات متجر آخر"

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        role = getattr(request.user, 'role', None)

        # Owner نسمحله مبدئيًا
        if role == 'OWNER':
            return True
        
        try:
            return request.user.employee.store is not None
        except (AttributeError, Employee.DoesNotExist):
            return False
        
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True

        try:
            user_store = request.user.employee.store
        except (AttributeError, Employee.DoesNotExist):
            role = getattr(request.user, 'role', None)
            if role == 'OWNER':                
                return True
            return False
        
        if hasattr(obj, 'store') and obj.store:
            return obj.store == user_store

        if hasattr(obj, 'branch') and obj.branch:
            return obj.branch.store == user_store

        if hasattr(obj, 'table') and obj.table:
            return obj.table.store == user_store

        if hasattr(obj, 'employee') and obj.employee:
            return obj.employee.store == user_store

        if hasattr(obj, 'order') and obj.order:
            return obj.order.store == user_store

        return False


class IsManagerOrOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        try:
            return request.user.role in ['OWNER', 'MANAGER']
        except AttributeError:
            return False
