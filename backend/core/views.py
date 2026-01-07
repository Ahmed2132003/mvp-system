# core/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny, SAFE_METHODS
from django.contrib.auth.password_validation import validate_password
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


# =========================
# Payroll computation helpers (FINAL logic)
# =========================
from decimal import Decimal
from django.db.models import Sum
from django.db import transaction

def _count_attendance_days(employee_id, month_date):
    """Count DISTINCT attendance days for the employee within that month."""
    start = month_date.replace(day=1)
    # end as first day of next month
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)

    qs = AttendanceLog.objects.filter(employee_id=employee_id)

    # Prefer work_date if exists
    if hasattr(AttendanceLog, "work_date"):
        return qs.filter(work_date__gte=start, work_date__lt=end).values("work_date").distinct().count()

    # Fallback to check_in date if exists
    if hasattr(AttendanceLog, "check_in"):
        return qs.filter(check_in__date__gte=start, check_in__date__lt=end).values("check_in__date").distinct().count()

    return 0


def _sum_month_ledger(employee_id, month_date, entry_type):
    start = month_date.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)

    return Decimal(
        EmployeeLedger.objects.filter(
            employee_id=employee_id,
            entry_type=entry_type,
            payout_date__gte=start,
            payout_date__lt=end,
        ).aggregate(s=Sum("amount"))["s"] or 0
    )


def generate_payroll(*, employee, month_date):
    """
    FINAL required logic (راتب يومي):
      daily_rate  = employee.salary (راتب اليوم الواحد)
      monthly_salary = daily_rate * 30
      earned_base = attendance_days * daily_rate
      net_salary  = earned_base + bonuses - penalties - advances
      
    NOTE:
      - نحتفظ بحقل monthly_salary كـ snapshot شهري (اليومي * 30).
      - "الراتب المستحق" = earned_base (stored in payroll.base_salary).
      - عند الدفع/إنشاء مرتب: يتم الاعتماد على payroll.net_salary فقط.
    """    
    month_date = month_date.replace(day=1)

    # If exists, just return it (avoid duplicate)
    existing = PayrollPeriod.objects.filter(employee=employee, month=month_date).first()
    if existing:
        # Ensure stored values are consistent (recalculate if not paid)
        if not existing.is_paid:
            attendance_days = _count_attendance_days(employee.id, month_date)
            daily_salary = Decimal(getattr(employee, "salary", 0) or (existing.monthly_salary or 0) / Decimal(30))
            if daily_salary <= 0:
                raise ValueError("يجب إدخال راتب أساسي صالح.")

            monthly_salary = daily_salary * Decimal(30)
            earned_base = daily_salary * Decimal(attendance_days)
            penalties = _sum_month_ledger(employee.id, month_date, "PENALTY")
            bonuses = _sum_month_ledger(employee.id, month_date, "BONUS")
            advances = _sum_month_ledger(employee.id, month_date, "ADVANCE")

            existing.attendance_days = int(attendance_days)
            existing.monthly_salary = monthly_salary
            existing.base_salary = earned_base  # المستحق
            existing.net_salary = earned_base + bonuses - penalties - advances
            existing.penalties = penalties
            existing.bonuses = bonuses
            existing.advances = advances
            existing.save(update_fields=["attendance_days","monthly_salary","base_salary","penalties","bonuses","advances","net_salary"])            
        return existing

    daily_salary = Decimal(getattr(employee, "salary", 0) or 0)
    if daily_salary <= 0:
        raise ValueError("يجب إدخال راتب أساسي صالح.")

    attendance_days = _count_attendance_days(employee.id, month_date)
    monthly_salary = daily_salary * Decimal(30)
    earned_base = daily_salary * Decimal(attendance_days)
    
    # monthly totals
    penalties = _sum_month_ledger(employee.id, month_date, "PENALTY")
    bonuses = _sum_month_ledger(employee.id, month_date, "BONUS")
    advances = _sum_month_ledger(employee.id, month_date, "ADVANCE")

    net_salary = earned_base + bonuses - penalties - advances
    
    payroll = PayrollPeriod.objects.create(
        employee=employee,
        month=month_date,
        monthly_salary=monthly_salary,
        attendance_days=int(attendance_days),
        base_salary=earned_base,  # المستحق
        penalties=penalties,
        bonuses=bonuses,
        advances=advances,
        net_salary=net_salary,
    )
    return payroll

from core.serializers.auth import RegisterUserSerializer
from core.serializers.employee import EmployeeSerializer
from core.serializers.user import UserSerializer

from core.permissions import IsManager, IsOwner
from core.services.payroll import generate_payroll as generate_payroll_service

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


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password_request(request):
    email = request.data.get("email")
    if not email:
        return Response({"detail": "البريد الإلكتروني مطلوب"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email, is_active=True)
    except User.DoesNotExist:
        # إرجاع نفس الرسالة لتجنب كشف وجود الحساب من عدمه
        return Response({"message": "لو الحساب موجود تم إرسال رابط إعادة التعيين على الإيميل."})

    user.send_password_reset_link()
    return Response({"message": "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني."})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_confirm(request):
    token = request.data.get("token")
    password = request.data.get("password")
    password_confirm = request.data.get("password_confirm")

    if not token or not password:
        return Response({"detail": "البيانات غير مكتملة"}, status=status.HTTP_400_BAD_REQUEST)

    if password != password_confirm:
        return Response({"detail": "كلمتا المرور غير متطابقتين."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(
            reset_password_token=token,
            reset_password_token_expires_at__gt=timezone.now(),
            is_active=True,
        )
    except User.DoesNotExist:
        return Response({"detail": "الرابط غير صالح أو منتهي."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(password, user)
    except Exception as exc:  # pragma: no cover - يعتمد على قواعد التحقق
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.reset_password_token = None
    user.reset_password_token_expires_at = None
    user.save(update_fields=["password", "reset_password_token", "reset_password_token_expires_at"])

    return Response({"message": "تم تعيين كلمة المرور الجديدة بنجاح."})


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
            "qr_attendance_base64": employee.build_attendance_qr_base64(),
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
                "gps": log.gps,
                "location": log.location,
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
                "attendance_days": p.attendance_days,
                "base_salary": p.base_salary,
                "monthly_salary": p.monthly_salary,
                "penalties": p.penalties,
                "late_penalties": getattr(p, "late_penalties", 0),
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
        month = (request.data.get('month') or "").strip()
        if not month:
            return Response({"detail": "month مطلوب"}, status=400)

        try:
            if len(month) == 7:  # YYYY-MM
                year, month_num = [int(p) for p in month.split("-")]
                month_date = timezone.datetime(year, month_num, 1).date()
            else:
                month_date = timezone.datetime.fromisoformat(month).date().replace(day=1)
        except Exception:
            return Response({"detail": "تنسيق الشهر غير صحيح. استخدم YYYY-MM أو YYYY-MM-DD."}, status=400)

        try:
            payroll = generate_payroll(
                employee=self.get_object(),
                month_date=month_date,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
                
        return Response({
            "id": payroll.id,
            "month": payroll.month,
            "attendance_days": payroll.attendance_days,
            "monthly_salary": payroll.monthly_salary,
            "base_salary": payroll.base_salary,
            "late_penalties": getattr(payroll, "late_penalties", 0),
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

        month_start = payroll.month.replace(day=1)
        if month_start.month == 12:
            next_month = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month = month_start.replace(month=month_start.month + 1)

        with transaction.atomic():
            payroll.mark_paid(by_user=request.user)

            # أرشفة كل الحركات الخاصة بالفترة داخل نفس كشف المرتب بدل ما نحذفها
            EmployeeLedger.objects.filter(
                employee=employee,
                entry_type__in=["BONUS", "PENALTY", "ADVANCE"],
                payout_date__gte=month_start,
                payout_date__lt=next_month,
            ).update(payroll=payroll)

            salary_entry, _ = EmployeeLedger.objects.get_or_create(
                employee=employee,
                payroll=payroll,
                entry_type="SALARY",
                payout_date=payroll.paid_at or timezone.localdate(),
                defaults={
                    "amount": payroll.net_salary,
                    "description": f"Salary paid for {payroll.month.strftime('%Y-%m')}",
                },
            )

            # نرجع السلفات (المؤجلة) لصفر عشان تبدأ الفترة الجديدة نظيفة
            employee.advances = 0
            employee.save(update_fields=["advances"])

        return Response(
            {
                "id": payroll.id,
                "month": payroll.month,
                "is_paid": payroll.is_paid,                
                "paid_at": payroll.paid_at,
                "paid_by": payroll.paid_by_id,
                "net_salary": payroll.net_salary,
                "salary_entry_id": salary_entry.id if payroll.is_paid else None,
            }
        )
        
    @action(detail=True, methods=["post", "patch"])
    def update_payroll(self, request, pk=None):
        employee = self.get_object()
        payroll_id = request.data.get("payroll_id")

        if not payroll_id:
            return Response({"detail": "payroll_id مطلوب"}, status=400)

        payroll = PayrollPeriod.objects.filter(id=payroll_id, employee=employee).first()
        if not payroll:
            return Response({"detail": "كشف المرتب غير موجود."}, status=404)

        if payroll.is_paid:
            return Response({"detail": "لا يمكن تعديل كشف مرتب تم دفعه."}, status=400)

        base_salary = request.data.get("base_salary", payroll.base_salary)
        penalties = request.data.get("penalties", payroll.penalties)
        late_penalties = request.data.get("late_penalties", getattr(payroll, "late_penalties", 0))
        bonuses = request.data.get("bonuses", payroll.bonuses)
        advances = request.data.get("advances", payroll.advances)
        monthly_salary = request.data.get("monthly_salary", payroll.monthly_salary)

        try:
            base_salary = float(base_salary)
            penalties = float(penalties)
            late_penalties = float(late_penalties)
            bonuses = float(bonuses)
            advances = float(advances)
            monthly_salary = float(monthly_salary)
        except (TypeError, ValueError):
            return Response({"detail": "قيم غير صالحة."}, status=400)
        if monthly_salary <= 0:
            return Response({"detail": "يجب إدخال راتب أساسي صالح."}, status=400)

        # monthly_salary هنا هو الراتب اليومي ويتم تخزين snapshot شهري = اليومي × 30
        daily_salary = Decimal(monthly_salary)
        monthly_snapshot = daily_salary * Decimal(30)

        # إعادة احتساب الأساس المستحق بناءً على أيام الحضور بالراتب اليومي
        if payroll.attendance_days and daily_salary:
            base_salary = float(daily_salary * Decimal(payroll.attendance_days))

        payroll.base_salary = base_salary
        payroll.monthly_salary = monthly_snapshot
        payroll.penalties = penalties
        payroll.late_penalties = late_penalties
        payroll.bonuses = bonuses
        payroll.advances = advances
        payroll.calculate_net_salary()
        payroll.save(update_fields=["base_salary", "monthly_salary", "penalties", "late_penalties", "bonuses", "advances", "net_salary"])
        
        return Response({
            "id": payroll.id,
            "month": payroll.month,
            "attendance_days": payroll.attendance_days,
            "base_salary": payroll.base_salary,
            "monthly_salary": payroll.monthly_salary,
            "penalties": payroll.penalties,
            "late_penalties": payroll.late_penalties,
            "bonuses": payroll.bonuses,
            "advances": payroll.advances,
            "net_salary": payroll.net_salary,
            "is_paid": payroll.is_paid,            
        })
        
    @action(detail=True, methods=["post"])
    def delete_payroll(self, request, pk=None):
        employee = self.get_object()
        payroll_id = request.data.get("payroll_id")

        if not payroll_id:
            return Response({"detail": "payroll_id مطلوب"}, status=400)

        payroll = PayrollPeriod.objects.filter(id=payroll_id, employee=employee).first()
        if not payroll:
            return Response({"detail": "كشف المرتب غير موجود."}, status=404)

        if payroll.is_paid:
            return Response({"detail": "لا يمكن حذف كشف مرتب تم دفعه."}, status=400)

        payroll.delete()
        return Response(status=204)

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