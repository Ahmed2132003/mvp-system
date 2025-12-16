import calendar
from datetime import date

from django.core.exceptions import ValidationError
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone

from .models import AttendanceLog, LeaveRequest
from .serializers import AttendanceLogSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = AttendanceLog.objects.all()
    serializer_class = AttendanceLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        أي موظف يشوف سجلات متجره فقط.
        """
        user = self.request.user
        if hasattr(user, "employee") and user.employee and user.employee.store_id:
            return AttendanceLog.objects.filter(employee__store_id=user.employee.store_id)
        return AttendanceLog.objects.none()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attendance_check(request):
    """
    Toggle attendance:
    - لو مفيش session مفتوحة -> يعمل check-in
    - لو فيه session مفتوحة -> يعمل check-out

    ✅ ملاحظة أمنية:
    employee الحقيقي يؤخذ من JWT، وليس من QR.
    employee_id لو اتبعت هنستخدمه للتحقق فقط.
    """
    if not hasattr(request.user, "employee") or not request.user.employee:
        return Response({"detail": "هذا المستخدم لا يملك ملف موظف."}, status=404)

    employee = request.user.employee

    # ✅ تحقق اختياري: employee_id القادم من QR لازم يطابق JWT
    employee_id = request.data.get("employee_id")
    if employee_id and int(employee_id) != int(employee.id):
        return Response({"detail": "QR لا يخص هذا الموظف."}, status=400)

    # ✅ store_id optional (جاى من QR)
    store_id = request.data.get("store_id")
    if store_id and int(store_id) != int(employee.store_id):
        return Response({"detail": "QR لا يخص هذا الفرع."}, status=400)

    gps = request.data.get("gps") or {}
    location = request.data.get("location") or gps
    ip = request.META.get("REMOTE_ADDR")
    user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:500]

    # ✅ الموقع إجباري للحضور/الانصراف عبر QR
    if not isinstance(gps, dict) or not gps.get("lat") or not gps.get("lng"):
        return Response(
            {
                "status": "blocked",
                "message": "فعّل الموقع أولاً لتسجيل الحضور أو الانصراف.",
            },
            status=400,
        )
        
    now = timezone.now()
    work_date = timezone.localtime(now).date()

    active_log = AttendanceLog.objects.active_for_employee(employee)

    # ✅ لو فيه active log قديم (مثلا نسي يقفل امبارح) اقفله تلقائياً
    if active_log and active_log.work_date and active_log.work_date != work_date:
        active_log.check_out = now
        active_log.gps = gps or active_log.gps
        active_log.ip_address = ip
        active_log.user_agent = user_agent
        active_log.location = location or active_log.location
        active_log.save()
        active_log = None
        
    if not active_log:
        try:
            log = AttendanceLog.objects.create(
                employee=employee,
                check_in=now,
                work_date=work_date,
                method="QR",
                gps=gps,
                location=location,
                ip_address=ip,
                user_agent=user_agent,
            )
        except ValidationError as exc:
            return Response(
                {
                    "status": "error",
                    "message": "تعذر تسجيل الحضور.",
                    "detail": exc.message_dict if hasattr(exc, "message_dict") else str(exc),
                },
                status=400,
            )

        return Response({
            "status": "checkin",
            "message": "تم تسجيل الحضور بنجاح",
            "check_in": log.check_in,
            "work_date": log.work_date,
            "is_late": log.is_late,
            "late_minutes": log.late_minutes,
            "penalty": float(log.penalty_applied),
        }, status=200)

    active_log.check_out = now
    active_log.gps = gps or active_log.gps
    active_log.location = location or active_log.location
    active_log.ip_address = ip
    active_log.user_agent = user_agent
    active_log.save()
    
    return Response({
        "status": "checkout",
        "message": "تم تسجيل الانصراف بنجاح",
        "check_out": active_log.check_out,
        "work_date": active_log.work_date,
        "duration_minutes": active_log.duration_minutes,
    }, status=200)
    
def _month_range(target: date):
    """Return (start_date, end_date) covering the month of *target*."""

    start = target.replace(day=1)
    _, last_day = calendar.monthrange(start.year, start.month)
    end = start.replace(day=last_day)
    return start, end

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_attendance_status(request):
    """
    إرجاع ملخص سريع للموظف الحالي:
    - بيانات الموظف والفرع
    - آخر جلسة حضور/انصراف نشطة
    - ملخص الشهر (حضور، غياب، إجازات، تأخير، غرامات)
    """

    employee = getattr(request.user, "employee", None)
    if not employee:
        return Response({"detail": "لا يوجد ملف موظف."}, status=404)

    today = timezone.localdate()

    # allow overriding month via query param YYYY-MM
    month_str = request.GET.get("month")
    try:
        target_month = date.fromisoformat(f"{month_str}-01") if month_str else today.replace(day=1)
    except Exception:
        target_month = today.replace(day=1)

    month_start, month_end = _month_range(target_month)

    # نطاق الأيام حتى اليوم الحالي لتفادي المستقبل
    month_end = min(month_end, today)

    logs_qs = AttendanceLog.objects.filter(
        employee=employee, work_date__range=(month_start, month_end)
    )

    present_days = set(
        logs_qs.exclude(check_in__isnull=True).values_list("work_date", flat=True)
    )

    total_minutes = sum(log.duration_minutes or 0 for log in logs_qs)
    total_late = sum(log.late_minutes or 0 for log in logs_qs)
    total_penalties = sum(float(log.penalty_applied or 0) for log in logs_qs)
    
    # إجازات معتمدة داخل نفس الشهر
    leaves_qs = LeaveRequest.objects.filter(
        employee=employee,
        status__iexact="APPROVED",
        date_from__lte=month_end,
        date_to__gte=month_start,
    )

    leave_days = set()
    for leave in leaves_qs:
        start = max(leave.date_from, month_start)
        end = min(leave.date_to, month_end)
        cur = start
        while cur <= end:
            leave_days.add(cur)
            cur += timezone.timedelta(days=1)

    # الأيام المتوقع حضورها (بعد تاريخ التعيين لو موجود)
    expected_start = max(month_start, employee.hire_date) if employee.hire_date else month_start
    expected_days = set()
    cur_day = expected_start
    while cur_day <= month_end:
        expected_days.add(cur_day)
        cur_day += timezone.timedelta(days=1)

    # الغياب = المتوقع - حضور - إجازات
    absent_days = len(expected_days - present_days - leave_days)

    salary = float(employee.salary or 0)
    daily_rate = salary / 30 if salary else 0
    absence_penalties = daily_rate * absent_days
    
    active_log = AttendanceLog.objects.active_for_employee(employee)
    today_log = (
        logs_qs.filter(work_date=today)
        .order_by("-check_in")
        .first()
    )

    return Response(
        {
            "employee": {
                "id": employee.id,
                "name": employee.user.name or employee.user.email,
                "store": employee.store_id,
                "store_name": getattr(employee.store, "name", None),
                "salary": employee.salary,
            },
            "active_log": AttendanceLogSerializer(active_log).data if active_log else None,
            "today_log": AttendanceLogSerializer(today_log).data if today_log else None,
            "month": {
                "start": month_start,
                "end": month_end,
                "present_days": len(present_days),
                "leave_days": len(leave_days),
                "absent_days": absent_days,
                "total_minutes": total_minutes,
                "late_minutes": total_late,
                "penalties": total_penalties,
                "absence_penalties": absence_penalties,
                "estimated_net_salary": float(salary - total_penalties - absence_penalties),
            },
        }
    )
    
@api_view(["GET"])
@permission_classes([AllowAny])
def qr_redirect(request):
    """
    ده اللي الـQR بيفتحه لو اتفتح من المتصفح.
    التسجيل الحقيقي للحضور يتم عبر POST /attendance/check/ (JWT)
    """
    store_id = request.GET.get("store")
    employee_id = request.GET.get("employee")

    return Response({
        "message": "افتح تطبيق الموظفين لتسجيل الحضور/الانصراف.",
        "store_id": store_id,
        "employee_id": employee_id,
        "next": "/login ثم امسح QR من داخل التطبيق",
    }, status=200)
