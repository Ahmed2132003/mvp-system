import base64
import calendar
from datetime import date
from io import BytesIO

import qrcode
from django.conf import settings
from django.urls import reverse
from django.core.exceptions import ValidationError
from django.shortcuts import redirect, render
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone

from .models import AttendanceLink, AttendanceLog, LeaveRequest
from .serializers import AttendanceLogSerializer


def _build_qr_base64(url: str) -> str:
    """
    يبني QR كـ base64 من رابط.
    """
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=5,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_bytes = buffered.getvalue()
    return base64.b64encode(qr_bytes).decode("utf-8")


class AttendanceLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    للقراءة فقط من API (لو محتاجين لاحقًا).
    """
    queryset = AttendanceLog.objects.all().select_related("employee", "employee__store")
    serializer_class = AttendanceLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # تأمين: لو المستخدم موظف -> يشوف سجلاته فقط
        user = self.request.user
        if hasattr(user, "employee") and user.employee:
            qs = qs.filter(employee=user.employee)
        return qs


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_attendance_status(request):
    """
    يرجع ملخص حالة الموظف الحالي:
    - آخر حركة (حضور/انصراف)
    - إحصائيات اليوم
    - ملخص الشهر
    """
    employee = getattr(request.user, "employee", None)
    if not employee:
        return Response({"detail": "لا يوجد ملف موظف."}, status=404)

    today = timezone.localdate()
    now = timezone.localtime()

    # آخر لوج
    last_log = (
        AttendanceLog.objects.filter(employee=employee)
        .order_by("-check_in")
        .first()
    )

    # لوج اليوم الحالي
    today_logs = AttendanceLog.objects.filter(
        employee=employee,
        work_date=today,
    ).order_by("check_in")

    active_log = today_logs.filter(check_out__isnull=True).last()

    # بناء الملخص
    data = {
        "employee": {
            "id": employee.id,
            "name": employee.user.name or employee.user.email,
            "store": {
                "id": employee.store_id,
                "name": getattr(employee.store, "name", None),
            },
            "qr_attendance_base64": getattr(employee, "qr_attendance_base64", None),
        },        
        "today": {
            "date": today,
            "active_log_id": active_log.id if active_log else None,
            "logs_count": today_logs.count(),
            "first_check_in": today_logs.first().check_in if today_logs else None,
            "last_check_out": (
                today_logs.exclude(check_out__isnull=True).last().check_out
                if today_logs.exclude(check_out__isnull=True).exists()
                else None
            ),
        },
        "last_log": {
            "id": last_log.id if last_log else None,
            "check_in": last_log.check_in if last_log else None,
            "check_out": last_log.check_out if last_log else None,
            "status": (
                "ACTIVE" if (last_log and last_log.check_out is None) else
                ("CLOSED" if last_log else None)
            ),
        },
        "server_time": now,
    }

    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_attendance_logs(request):
    """
    يرجع لوجات الشهر الحالي للموظف.
    """
    employee = getattr(request.user, "employee", None)
    if not employee:
        return Response({"detail": "لا يوجد ملف موظف."}, status=404)

    today = timezone.localdate()
    year = int(request.query_params.get("year") or today.year)
    month = int(request.query_params.get("month") or today.month)

    logs = AttendanceLog.objects.filter(
        employee=employee,
        work_date__year=year,
        work_date__month=month,
    ).order_by("work_date", "check_in")

    # بناء جدول الأيام
    _, num_days = calendar.monthrange(year, month)
    days_map = {day: {"logs": [], "total_minutes": 0} for day in range(1, num_days + 1)}

    for log in logs:
        day = log.work_date.day
        duration = log.duration_minutes or 0        
        days_map[day]["logs"].append(
            {
                "id": log.id,
                "check_in": log.check_in,
                "check_out": log.check_out,
                "duration_minutes": duration,
                "location": log.location,
                "gps": log.gps,
            }
        )
        days_map[day]["total_minutes"] += duration

    # إحصائيات شهرية
    month_stats = {
        "total_days": num_days,
        "worked_days": sum(1 for d in days_map.values() if d["logs"]),
        "absent_days": sum(1 for d in days_map.values() if not d["logs"]),
        "total_minutes": sum(d["total_minutes"] for d in days_map.values()),
        "late_minutes": 0,  # Placeholder لو عندك منطق التأخير
        "penalties": 0,     # Placeholder لو عندك منطق الجزاءات
    }

    return Response(
        {
            "year": year,
            "month": month,
            "days": days_map,
            "stats": month_stats,
        }
    )


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

    data = request.data or {}
    gps = data.get("gps") or None
    location = data.get("location") or None

    now = timezone.localtime()
    work_date = timezone.localdate()

    # IP و User-Agent
    ip = request.META.get("REMOTE_ADDR")
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    active_log = AttendanceLog.objects.active_for_employee(employee)

    # لو مفيش session -> Check-in
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
                    "detail": exc.messages,
                },
                status=400,
            )

        return Response(
            {
                "status": "checkin",
                "message": "تم تسجيل الحضور بنجاح",
                "log_id": log.id,
                "check_in": log.check_in,
                "work_date": log.work_date,
                "location": log.location,
                "gps": log.gps,
            }
        )

    # لو فيه session مفتوحة -> Check-out
    active_log.check_out = now
    try:
        active_log.full_clean()
        active_log.save(update_fields=["check_out", "duration_minutes"])        
    except ValidationError as exc:
        return Response(
            {
                "status": "error",
                "message": "تعذر تسجيل الانصراف.",
                "detail": exc.messages,
            },
            status=400,
        )

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
        # لو مافيش session نشطة -> CHECKIN
        # لو فيه session نشطة -> CHECKOUT
        action = AttendanceLink.Action.CHECKOUT if active_log else AttendanceLink.Action.CHECKIN

    # ننشئ AttendanceLink لمرة واحدة
    link = AttendanceLink.objects.create(
        employee=employee,
        action=action,
        work_date=timezone.localdate(),
    )

    # ✅ التعديل المهم هنا:
    # بدل ما نستخدم مسار ثابت /attendance/qr/use/... (اللي بيروح للـ Frontend في الإنتاج),
    # هنستخدم reverse على الـ URL Name بتاع الـ API:
    path = reverse("attendance-qr-use-page", kwargs={"token": link.token})
    url = f"{settings.SITE_URL}{path}"

    qr_base64 = _build_qr_base64(url)
    return Response(
        {
            "token": str(link.token),
            "url": url,
            "qr_base64": qr_base64,
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
            status=400,
        )

    try:
        employee = AttendanceLog._meta.get_field("employee").remote_field.model.objects.select_related(
            "store"
        ).get(pk=employee_id, store_id=store_id)
    except AttendanceLog._meta.get_field("employee").remote_field.model.DoesNotExist:
        return Response(
            {
                "message": "هذا QR غير صالح أو الموظف غير موجود.",
                "detail": "تحقق من صحة الكود أو تواصل مع الإدارة.",
            },
            status=404,
        )

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
@permission_classes([IsAuthenticated])
def qr_use(request):
    """
    يستهلك AttendanceLink لمرة واحدة:
    - يتحقق من صلاحية الرابط (وقت + عدم استخدام مسبقًا)
    - ينفّذ Check-in أو Check-out بناءً على action
    """
    token = request.data.get("token")
    gps = request.data.get("gps")
    location = request.data.get("location")

    now = timezone.localtime()

    try:
        link = AttendanceLink.objects.select_related("employee").get(token=token)
    except AttendanceLink.DoesNotExist:
        return Response(
            {"status": "error", "message": "الرابط غير صالح أو منتهي."},
            status=404,
        )

    if not link.is_valid(now=now):
        return Response(
            {"status": "error", "message": "انتهت صلاحية الرابط أو تم استخدامه."},
            status=400,
        )

    employee = link.employee
    work_date = link.work_date

    ip = request.META.get("REMOTE_ADDR")
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    active_log = AttendanceLog.objects.active_for_employee(employee)

    # تنفيذ الحضور/الانصراف بناءً على action
    if link.action == AttendanceLink.Action.CHECKIN:
        if active_log:
            return Response(
                {
                    "status": "error",
                    "message": "يوجد جلسة عمل مفتوحة بالفعل.",
                },
                status=400,
            )

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
                    "message": "تعذر تسجيل الحضور عبر QR.",
                    "detail": exc.messages,
                },
                status=400,
            )

        link.used_at = now
        link.save(update_fields=["used_at"])

        return Response(
            {
                "status": "checkin",
                "message": "تم تسجيل الحضور بنجاح عبر QR.",
                "log_id": log.id,
                "check_in": log.check_in,
                "work_date": log.work_date,
                "location": log.location,
                "gps": log.gps,
            }
        )

    # في حالة CHECKOUT
    if not active_log:
        return Response(
            {
                "status": "error",
                "message": "لا توجد جلسة عمل مفتوحة لإنهائها.",
            },
            status=400,
        )

    active_log.check_out = now
    try:
        active_log.full_clean()
        active_log.save(update_fields=["check_out", "duration_minutes"])        
    except ValidationError as exc:
        return Response(
            {
                "status": "error",
                "message": "تعذر تسجيل الانصراف عبر QR.",
                "detail": exc.messages,
            },
            status=400,
        )

    link.used_at = now
    link.save(update_fields=["used_at"])

    return Response(
        {
            "status": "checkout",
            "message": "تم تسجيل الانصراف بنجاح عبر QR.",
            "check_out": active_log.check_out,
            "work_date": active_log.work_date,
            "duration_minutes": active_log.duration_minutes,
            "location": active_log.location,
            "gps": active_log.gps,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_leave_request(request):
    """
    إنشاء طلب إجازة بسيط.
    """
    employee = getattr(request.user, "employee", None)
    if not employee:
        return Response({"detail": "لا يوجد ملف موظف."}, status=404)

    date_from = request.data.get("date_from")
    date_to = request.data.get("date_to")
    leave_type = request.data.get("type") or "ANNUAL"

    if not date_from or not date_to:
        return Response({"detail": "يجب تحديد تاريخ البداية والنهاية."}, status=400)

    try:
        df = date.fromisoformat(date_from)
        dt = date.fromisoformat(date_to)
    except ValueError:
        return Response({"detail": "تنسيق التاريخ غير صالح."}, status=400)

    if df > dt:
        return Response({"detail": "تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية."}, status=400)

    lr = LeaveRequest.objects.create(
        employee=employee,
        date_from=df,
        date_to=dt,
        type=leave_type,
        status="PENDING",
    )

    return Response(
        {
            "id": lr.id,
            "employee": employee.id,
            "date_from": lr.date_from,
            "date_to": lr.date_to,
            "status": lr.status,
            "type": lr.type,
        },
        status=201,
    )
