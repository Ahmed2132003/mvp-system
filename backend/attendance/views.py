import calendar
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.shortcuts import redirect, render
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone

from .models import AttendanceLink, AttendanceLog, LeaveRequest
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
    employee الحقيقي يؤخذ من JWT الخاص بالمستخدم.
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

    # ✅ الموقع إجباري للحضور/الانصراف عبر التطبيق
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
        # gps يحتفظ بإحداثيات الحضور الأولى، بينما location تخزن إحداثيات الانصراف
        active_log.gps = active_log.gps or gps
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
                method="MANUAL",
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
            "location": log.location,
            "gps": log.gps,
        }, status=200)
        
    active_log.check_out = now
    # لا نستبدل gps حتى نحتفظ بموقع الحضور، ونخزن موقع الانصراف في location
    active_log.gps = active_log.gps or gps
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
        "location": active_log.location,
        "gps": active_log.gps,
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

    # ✅ لا نحسب الغياب عن الأيام القادمة داخل نفس الشهر
    effective_end = min(month_end, today)

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
    expected_end = effective_end
    expected_days = set()
    cur_day = expected_start
    while cur_day <= expected_end:
        expected_days.add(cur_day)
        cur_day += timezone.timedelta(days=1)
    # الغياب = المتوقع - حضور - إجازات
    absent_days = len(expected_days - present_days - leave_days)

    daily_salary = float(employee.salary or 0)
    absence_penalties = max(0.0, daily_salary * absent_days)
    attendance_value = max(0.0, daily_salary * len(present_days))    
    store_settings = getattr(employee.store, "settings", None)    
    active_log = AttendanceLog.objects.active_for_employee(employee)
    today_log = (
        logs_qs.filter(work_date=today)
        .order_by("-check_in")
        .first()
    )

    remaining_work_days = max(0, (month_end - today).days)
    projected_net_salary = attendance_value + (daily_salary * remaining_work_days) - total_penalties
    
    return Response(
        {
            "employee": {
                "id": employee.id,
                "name": employee.user.name or employee.user.email,
                "store": employee.store_id,                
                "store_name": getattr(employee.store, "name", None),
                "salary": employee.salary,
                "qr_attendance_base64": employee.build_attendance_qr_base64(),
                "qr_attendance_url": getattr(employee, "qr_attendance", None).url if getattr(employee, "qr_attendance", None) else None,
            },                                                                         
            "shift": {
                "start": getattr(store_settings, "attendance_shift_start", None),
                "grace_minutes": getattr(store_settings, "attendance_grace_minutes", None),
                "penalty_per_15min": float(
                    getattr(store_settings, "attendance_penalty_per_15min", 0) or 0
                ),
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
                "attendance_value": attendance_value,
                "daily_rate": daily_salary,
                "estimated_net_salary": max(0.0, float(attendance_value - total_penalties - absence_penalties)),
                "remaining_work_days": remaining_work_days,
                "projected_net_salary": max(0.0, float(projected_net_salary)),
            },
        }
    )
                
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_attendance_logs(request):
    """
    إرجاع آخر سجلات الحضور/الانصراف للموظف الحالي مع إمكانية التصفية بالشهر.
    """
    employee = getattr(request.user, "employee", None)
    if not employee:
        return Response({"detail": "لا يوجد ملف موظف."}, status=404)

    month_str = request.GET.get("month")
    limit = request.GET.get("limit")
    try:
        max_rows = min(100, max(1, int(limit))) if limit else 20
    except Exception:
        max_rows = 20

    logs_qs = AttendanceLog.objects.filter(employee=employee)

    if month_str:
        try:
            target_month = date.fromisoformat(f"{month_str}-01")
            start, end = _month_range(target_month)
            logs_qs = logs_qs.filter(work_date__range=(start, end))
        except Exception:
            pass

    logs_qs = logs_qs.order_by("-check_in")[:max_rows]
    data = AttendanceLogSerializer(logs_qs, many=True).data
    return Response(data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_qr_link(request):    
    """
    ينشئ رابط حضور/انصراف لمرة واحدة بناءً على حالة الموظف الحالية.
    - QR ثابت لكل موظف -> يوجّه إلى /attendance/qr/?employee=..&store=..
    - هنا ننشئ توكن فريد + رابط متغيّر صالح لمرة واحدة في نفس اليوم.
    """
    employee = getattr(request.user, "employee", None)
    if not employee:
        return Response({"detail": "لا يوجد ملف موظف."}, status=404)

    requested_action = (request.data.get("action") or "").upper().strip() or None
    active_log = AttendanceLog.objects.active_for_employee(employee)

    if requested_action in AttendanceLink.Action.values:
        action = requested_action
    else:
        action = AttendanceLink.Action.CHECKOUT if active_log else AttendanceLink.Action.CHECKIN

    link = AttendanceLink.objects.create(employee=employee, action=action, work_date=timezone.localdate())

    url = f"{settings.SITE_URL}/attendance/qr/use/{link.token}/"
    return Response(
        {
            "token": str(link.token),
            "url": url,
            "action": link.action,
            "work_date": link.work_date,
            "expires_at": link.expires_at,
        },
        status=201,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def qr_redirect(request):
    """
    مدخل ثابت للـ QR لكل موظف.
    - يحدد الموظف + الفرع من البارامز.
    - ينشئ رابط متغيّر لمرة واحدة ويحوّل إليه.
    """
    employee_id = request.GET.get("employee")
    store_id = request.GET.get("store")
    action_raw = (request.GET.get("action") or "").upper().strip()

    if not employee_id:
        return Response(
            {
                "message": "افتح تطبيق الموظفين لتسجيل الحضور/الانصراف.",
                "detail": "يجب أن يكون QR مخصصًا لموظف محدد.",
                "next": "/login ثم امسح QR من داخل التطبيق",
            },
            status=200,
        )

    employee = getattr(getattr(request, "user", None), "employee", None)
    if not employee or str(employee.id) != str(employee_id):
        try:
            from core.models import Employee
            employee = Employee.objects.get(id=employee_id)
        except Exception:
            return Response({"detail": "الموظف غير موجود."}, status=404)

    if store_id and str(employee.store_id) != str(store_id):
        return Response({"detail": "QR لا يخص هذا الفرع."}, status=400)

    active_log = AttendanceLog.objects.active_for_employee(employee)

    if action_raw in AttendanceLink.Action.values:
        action = action_raw
    else:
        action = AttendanceLink.Action.CHECKOUT if active_log else AttendanceLink.Action.CHECKIN

    link = AttendanceLink.objects.create(
        employee=employee,
        action=action,
        work_date=timezone.localdate(),
    )

    return redirect("attendance-qr-use-page", token=link.token)


@api_view(["POST"])
@permission_classes([AllowAny])
def qr_use(request):
    """
    استهلاك رابط الـ QR لمرة واحدة مع التقاط الموقع.
    """
    token = request.data.get("token")
    gps = request.data.get("gps") or {}
    location = request.data.get("location") or gps
    now = timezone.now()

    if not token:
        return Response({"status": "error", "message": "الرابط مفقود."}, status=400)

    if not isinstance(gps, dict) or not gps.get("lat") or not gps.get("lng"):
        return Response(
            {"status": "blocked", "message": "فعّل الموقع أولاً لتسجيل الحضور أو الانصراف."},
            status=400,
        )

    try:
        link = AttendanceLink.objects.select_related("employee").get(token=token)
    except AttendanceLink.DoesNotExist:
        return Response({"status": "error", "message": "الرابط غير صالح."}, status=400)

    if not link.is_valid(now=now):
        return Response({"status": "error", "message": "انتهت صلاحية الرابط أو تم استخدامه."}, status=400)

    employee = link.employee
    ip = request.META.get("REMOTE_ADDR")
    user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:500]
    work_date = timezone.localdate(now)

    active_log = AttendanceLog.objects.active_for_employee(employee)

    if active_log and active_log.work_date and active_log.work_date != work_date:
        active_log.check_out = now
        active_log.gps = gps or active_log.gps
        active_log.location = location or active_log.location
        active_log.ip_address = ip
        active_log.user_agent = user_agent
        active_log.save()
        active_log = None

    if link.action == AttendanceLink.Action.CHECKIN:
        if active_log:
            return Response({"status": "error", "message": "يوجد تسجيل حضور نشط بالفعل."}, status=400)

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

        link.used_at = now
        link.save(update_fields=["used_at"])

        return Response(
            {
                "status": "checkin",
                "message": "تم تسجيل الحضور بنجاح",
                "check_in": log.check_in,
                "work_date": log.work_date,
                "is_late": log.is_late,
                "late_minutes": log.late_minutes,
                "penalty": float(log.penalty_applied),
                "location": log.location,
                "gps": log.gps,
            }
        )

    # CHECKOUT
    if not active_log:
        return Response({"status": "error", "message": "لا توجد جلسة نشطة للانصراف."}, status=400)

    active_log.check_out = now
    active_log.gps = gps or active_log.gps
    active_log.location = location or active_log.location
    active_log.ip_address = ip
    active_log.user_agent = user_agent
    active_log.save()

    link.used_at = now
    link.save(update_fields=["used_at"])

    return Response(
        {
            "status": "checkout",
            "message": "تم تسجيل الانصراف بنجاح",
            "check_out": active_log.check_out,
            "work_date": active_log.work_date,
            "duration_minutes": active_log.duration_minutes,
            "location": active_log.location,
            "gps": active_log.gps,
        }
    )


def qr_use_page(request, token):
    """
    صفحة وسيطة لالتقاط الموقع وتشغيل استهلاك الرابط.
    """
    return render(request, "attendance/qr_redirect.html", {"token": token})