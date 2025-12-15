from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.utils import timezone

from .models import AttendanceLog
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

    location = request.data.get("location")
    ip = request.META.get("REMOTE_ADDR")
    user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:500]

    now = timezone.now()
    work_date = timezone.localtime(now).date()

    active_log = AttendanceLog.objects.active_for_employee(employee)

    # ✅ لو فيه active log قديم (مثلا نسي يقفل امبارح) اقفله تلقائياً
    if active_log and active_log.work_date and active_log.work_date != work_date:
        active_log.check_out = now
        active_log.ip_address = ip
        active_log.user_agent = user_agent
        active_log.location = location or active_log.location
        active_log.save()
        active_log = None

    if not active_log:
        log = AttendanceLog.objects.create(
            employee=employee,
            check_in=now,
            work_date=work_date,
            method="QR",
            location=location,
            ip_address=ip,
            user_agent=user_agent,
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
