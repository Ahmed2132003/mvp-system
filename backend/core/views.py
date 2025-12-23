# core/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny, SAFE_METHODS
from django.shortcuts import redirect
from django.utils import timezone
from django.conf import settings

from core.models import (
    User,
    Employee,
    PayrollPeriod,
    EmployeeLedger,
    Store,
)
from attendance.models import AttendanceLog

from core.serializers.auth import RegisterUserSerializer
from core.serializers.employee import EmployeeSerializer
from core.serializers.user import UserSerializer

from core.permissions import IsManager, IsOwner
from core.services.payroll import generate_payroll

import calendar


# =========================
# Auth & User
# =========================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_users(request):
    role_param = request.query_params.get("role", "")
    roles = [r.strip() for r in role_param.split(",") if r.strip()]

    qs = User.objects.all().order_by("-id")
    if roles:
        qs = qs.filter(role__in=roles)

    return Response(UserSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_stores(request):
    user = request.user
    qs = Store.objects.all()

    if user.is_superuser:
        pass
    elif getattr(user, "role", None) == User.RoleChoices.OWNER:
        qs = qs.filter(owner=user)
    elif getattr(user, "role", None) in [User.RoleChoices.MANAGER, User.RoleChoices.STAFF]:
        try:
            qs = qs.filter(id=user.employee.store_id)
        except Exception:
            qs = Store.objects.none()
    else:
        qs = Store.objects.none()
        
    return Response([
        {
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "phone": s.phone,
            "paymob_keys": s.paymob_keys,
            "qr_menu_base64": s.qr_menu_base64,
            "qr_attendance_base64": s.qr_attendance_base64,
        }
        for s in qs.order_by("id")
    ])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user_account(request):
    serializer = RegisterUserSerializer(
        data=request.data,
        context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    return Response(
        {"message": "تم إنشاء الحساب بنجاح", "email": user.email},
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([AllowAny])  # ✅ مهم جدًا: بدون توكن
def verify_magic_link(request, token):
    try:
        user = User.objects.get(
            verification_token=token,
            verification_token_expires_at__gt=timezone.now(),
            is_active=False
        )

        user.is_active = True
        user.verification_token = None
        user.verification_token_expires_at = None
        user.save(update_fields=['is_active', 'verification_token', 'verification_token_expires_at'])

        return redirect(f"{settings.FRONTEND_URL}/login?verified=true&email={user.email}")

    except User.DoesNotExist:
        return redirect(f"{settings.FRONTEND_URL}/login?error=invalid_or_expired_link")


# =========================
# Helpers
# =========================

def get_user_store(user):
    emp = getattr(user, "employee", None)
    if emp and getattr(emp, "store", None):
        return emp.store

    s = Store.objects.filter(owner=user).first()
    if s:
        return s

    return None


# =========================
# Employees
# =========================

class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsManager]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated()]
        return [perm() for perm in self.permission_classes]

    def get_queryset(self):
        user = self.request.user
        qs = Employee.objects.select_related('user', 'store', 'branch')
        
        store_id = self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        if user.is_superuser:
            return qs

        if user.role == User.RoleChoices.OWNER:
            return qs.filter(store__owner=user)

        if user.role == User.RoleChoices.MANAGER:
            try:
                manager_store = user.employee.store_id
            except Exception:
                return Employee.objects.none()
            return qs.filter(store_id=manager_store)

        if user.role == User.RoleChoices.STAFF:
            return qs.filter(user=user)

        return qs.none()
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        بيرجع EmployeeSerializer للموظف الحالي.
        لازم EmployeeSerializer يحتوي qr_attendance_base64 لو عايز تعرضه للموظف.
        """
        employee = getattr(request.user, "employee", None)
        if not employee:
            return Response({"detail": "لا يوجد ملف موظف."}, status=404)

        return Response(self.get_serializer(employee).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='me-attendance-qr')
    def me_attendance_qr(self, request):
        """
        ✅ Endpoint مباشر وخفيف للفرونت: QR حضور الموظف الحالي
        GET /core/employees/me-attendance-qr/
        """
        employee = getattr(request.user, "employee", None)
        if not employee:
            return Response({"detail": "لا يوجد ملف موظف."}, status=404)

        # ✅ ضمان توليد QR للموظفين القدامى لو فاضي
        if not employee.qr_attendance:
            employee.save()

        return Response({
            "id": employee.id,
            "name": employee.user.name or employee.user.email,
            "store_id": employee.store_id,
            "store_name": employee.store.name if employee.store_id else None,
            "qr_attendance_base64": getattr(employee, "qr_attendance_base64", None),
        }, status=200)

    @action(detail=True, methods=['get'])
    def attendance(self, request, pk=None):
        employee = self.get_object()
        month_param = request.query_params.get("month")
        logs = AttendanceLog.objects.filter(employee=employee)

        # ✅ Default to current month for a cleaner monthly view
        if month_param:
            try:
                # month_param can be YYYY-MM or YYYY-MM-DD
                parts = [int(p) for p in month_param.split("-")]
                year = parts[0]
                month = parts[1] if len(parts) > 1 else timezone.localdate().month
                start_date = timezone.datetime(year, month, 1).date()
            except Exception:
                start_date = timezone.localdate().replace(day=1)
        else:
            start_date = timezone.localdate().replace(day=1)

        last_day = calendar.monthrange(start_date.year, start_date.month)[1]
        end_date = start_date.replace(day=last_day)

        logs = logs.filter(check_in__date__gte=start_date, check_in__date__lte=end_date).order_by("-check_in")
        return Response([
            {
                "work_date": getattr(log, "work_date", None),                
                "check_in": log.check_in,
                "check_out": log.check_out,                
                "late_minutes": log.late_minutes,
                "penalty": log.penalty_applied,
                "duration": log.duration_minutes,
            }
            for log in logs
        ])

    @action(detail=True, methods=["get"])
    def payrolls(self, request, pk=None):
        employee = self.get_object()
        payrolls = PayrollPeriod.objects.filter(employee=employee)
        return Response([
            {
                "id": p.id,                
                "month": p.month,
                "base_salary": p.base_salary,
                "penalties": p.penalties,
                "bonuses": p.bonuses,
                "advances": p.advances,
                "net_salary": p.net_salary,
                "is_locked": p.is_locked,
                "is_paid": p.is_paid,
                "paid_at": p.paid_at,
                "paid_by": p.paid_by_id,
            }
            for p in payrolls
        ])
                
    @action(detail=True, methods=['post'])
    def generate_payroll(self, request, pk=None):
        month = request.data.get('month')
        if not month:
            return Response({"detail": "month مطلوب"}, status=400)

        payroll = generate_payroll(
            employee=self.get_object(),
            month_date=timezone.datetime.strptime(month, "%Y-%m-%d").date()
        )

        return Response({
            "id": payroll.id,
            "month": payroll.month,
            "net_salary": payroll.net_salary,
            "is_locked": payroll.is_locked,
            "is_paid": payroll.is_paid,
            "paid_at": payroll.paid_at,
            "paid_by": payroll.paid_by_id,
        })

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        payroll_id = request.data.get("payroll_id")
        target_month = request.data.get("month")
        employee = self.get_object()

        payroll = None
        if payroll_id:
            payroll = PayrollPeriod.objects.filter(id=payroll_id, employee=employee).first()
        elif target_month:
            try:
                parts = [int(p) for p in target_month.split("-")]
                year = parts[0]
                month = parts[1] if len(parts) > 1 else timezone.localdate().month
                month_date = timezone.datetime(year, month, 1).date()
                payroll = PayrollPeriod.objects.filter(employee=employee, month=month_date).first()
            except Exception:
                payroll = None
        else:
            current_start = timezone.localdate().replace(day=1)
            payroll = PayrollPeriod.objects.filter(employee=employee, month=current_start).first()

        if not payroll:
            return Response({"detail": "لا يوجد كشف رواتب للشهر المحدد."}, status=404)

        payroll.mark_paid(by_user=request.user)
        EmployeeLedger.objects.get_or_create(
            employee=employee,
            payroll=payroll,
            entry_type="SALARY",
            payout_date=payroll.paid_at or timezone.localdate(),
            defaults={
                "amount": payroll.net_salary,
                "description": f"Salary paid for {payroll.month.strftime('%Y-%m')}",
            },
        )

        return Response(
            {
                "id": payroll.id,
                "month": payroll.month,
                "is_paid": payroll.is_paid,
                "paid_at": payroll.paid_at,
                "paid_by": payroll.paid_by_id,
                "net_salary": payroll.net_salary,
            }
        )

    @action(detail=True, methods=["post"])
    def ledger_entry(self, request, pk=None):
        """
        ✅ Add bonus/penalty/advance entry for the employee.
        """
        employee = self.get_object()
        entry_type = request.data.get("entry_type")
        amount = request.data.get("amount")
        description = request.data.get("description", "")
        payout_date = request.data.get("payout_date")

        if entry_type not in ["BONUS", "PENALTY", "ADVANCE"]:
            return Response({"detail": "نوع الحركة غير مدعوم."}, status=400)

        try:
            amount_value = float(amount)
        except (TypeError, ValueError):
            return Response({"detail": "قيمة غير صالحة."}, status=400)

        if amount_value <= 0:
            return Response({"detail": "يجب أن تكون القيمة أكبر من صفر."}, status=400)

        if payout_date:
            try:
                payout_date = timezone.datetime.strptime(payout_date, "%Y-%m-%d").date()
            except Exception:
                return Response({"detail": "تنسيق التاريخ غير صحيح."}, status=400)
        else:
            payout_date = timezone.localdate()

        entry = EmployeeLedger.objects.create(
            employee=employee,
            entry_type=entry_type,
            amount=amount_value,
            description=description,
            payout_date=payout_date,
        )

        if entry_type == "ADVANCE":
            employee.advances = (employee.advances or 0) + amount_value
            employee.save(update_fields=["advances"])

        return Response(
            {
                "type": entry.entry_type,
                "amount": entry.amount,
                "description": entry.description,
                "created_at": entry.created_at,
                "payout_date": entry.payout_date,
            },
            status=201,
        )

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        employee = self.get_object()
        month_param = request.query_params.get("month")
        entries = EmployeeLedger.objects.filter(employee=employee)

        if month_param:
            try:
                parts = [int(p) for p in month_param.split("-")]
                year = parts[0]
                month = parts[1] if len(parts) > 1 else timezone.localdate().month
                start_date = timezone.datetime(year, month, 1).date()
            except Exception:
                start_date = timezone.localdate().replace(day=1)
        else:
            start_date = timezone.localdate().replace(day=1)

        last_day = calendar.monthrange(start_date.year, start_date.month)[1]
        end_date = start_date.replace(day=last_day)

        entries = entries.filter(payout_date__gte=start_date, payout_date__lte=end_date)
        return Response([
            {
                "type": e.entry_type,                
                "amount": e.amount,
                "description": e.description,
                "created_at": e.created_at,
                "payout_date": e.payout_date,
            }
            for e in entries
        ])
        
    @action(detail=False, methods=['get'])
    def attendance_qr_list(self, request):
        """
        ✅ قائمة QR الحضور للموظفين (للأونر/السوبر/المانجر)
        بيرجع base64 من Employee.qr_attendance_base64
        """
        user = request.user

        if user.is_superuser or user.role == User.RoleChoices.OWNER:
            qs = Employee.objects.select_related('user', 'store')
        else:
            emp = getattr(user, "employee", None)
            if not emp or not emp.store_id:
                return Response([], status=200)
            qs = Employee.objects.filter(store_id=emp.store_id).select_related('user', 'store')

        return Response([
            {
                "id": emp.id,
                "name": emp.user.name or emp.user.email,
                "store_id": emp.store_id,
                "store_name": emp.store.name if emp.store_id else None,
                "qr_attendance_base64": getattr(emp, "qr_attendance_base64", None),
            }
            for emp in qs
        ], status=200)


# =========================
# Payroll
# =========================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsOwner])
def close_payroll(request, payroll_id):
    payroll = PayrollPeriod.objects.get(id=payroll_id)

    if payroll.is_locked:
        return Response({"detail": "Payroll already closed"}, status=400)

    payroll.lock()

    EmployeeLedger.objects.create(
        employee=payroll.employee,
        payroll=payroll,
        entry_type='SALARY',
        amount=payroll.net_salary,
        payout_date=timezone.localdate(),
        description=f"Salary for {payroll.month.strftime('%Y-%m')}"
    )
    
    return Response({
        "status": "success",
        "net_salary": payroll.net_salary
    })


# =========================
# Logout
# =========================

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(request.data.get("refresh"))
            token.blacklist()
            return Response({"detail": "تم تسجيل الخروج"}, status=205)
        except Exception:
            return Response({"detail": "توكن غير صالح"}, status=400)


# =========================
# Store (legacy)
# =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_store(request):
    """
    ده ممكن تسيبه موجود لو محتاج QR موحد للفرع (اختياري).
    لكن لو هتعرض QR الموظف في صفحة الحضور، استخدم:
    GET /core/employees/me-attendance-qr/
    """
    store = get_user_store(request.user)
    if not store:
        return Response({"detail": "لا يوجد متجر مرتبط بهذا الحساب."}, status=404)

    return Response({
        "id": store.id,
        "name": store.name,
        "qr_attendance_base64": store.qr_attendance_base64,
        "qr_attendance_url": store.qr_attendance.url if store.qr_attendance else None,
    }, status=200)
