# attendance/models.py

import uuid

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Q

class AttendanceLogQuerySet(models.QuerySet):
    def today(self):
        return self.filter(check_in__date=timezone.localdate())

    def active_sessions(self):
        return self.filter(check_out__isnull=True)


class AttendanceLogManager(models.Manager):
    def get_queryset(self):
        return AttendanceLogQuerySet(self.model, using=self._db)

    def active_for_employee(self, employee):
        return self.get_queryset().filter(employee=employee, check_out__isnull=True).first()


class Shift(models.Model):
    store = models.ForeignKey("core.Store", on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_minutes = models.PositiveIntegerField(default=0)
    penalty_per_15min = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.name} - {self.store}"


class EmployeeShiftAssignment(models.Model):
    employee = models.ForeignKey("core.Employee", on_delete=models.CASCADE)
    shift = models.ForeignKey("attendance.Shift", on_delete=models.PROTECT)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)  # لو null يبقى مستمر

    class Meta:
        ordering = ["-start_date"]

    def is_active_for(self, day):
        if self.start_date and day < self.start_date:
            return False
        if self.end_date and day > self.end_date:
            return False
        return True

    def __str__(self):
        return f"{self.employee} -> {self.shift} ({self.start_date} - {self.end_date or '∞'})"


class AttendanceLog(models.Model):    
    METHOD_CHOICES = [
        ("QR", "QR Code"),
        ("MANUAL", "Manual"),
        ("NFC", "NFC"),
    ]

    employee = models.ForeignKey(
        "core.Employee",
        on_delete=models.CASCADE,
        related_name="attendance_logs",
    )

    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)

    # ✅ مهم: لازم يكون ليه default عشان مايكسرش create
    work_date = models.DateField(db_index=True, default=timezone.localdate)

    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default="QR")

    # إحداثيات الموقع القادم من المتصفح (lat/lng/accuracy...)
    gps = models.JSONField(null=True, blank=True)
    location = models.JSONField(null=True, blank=True)  # {lat, lng, accuracy?}
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    
    is_late = models.BooleanField(default=False)
    late_minutes = models.PositiveIntegerField(null=True, blank=True)
    penalty_applied = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)

    duration_minutes = models.PositiveIntegerField(null=True, blank=True, editable=False)

    objects = AttendanceLogManager()

    class Meta:
        ordering = ["-check_in"]
        indexes = [
            models.Index(fields=["employee", "work_date"]),
        ]

    def clean(self):
        if self.check_out and self.check_in and self.check_out < self.check_in:
            raise ValidationError("Checkout cannot be before check-in")

    @property
    def is_active(self):
        return self.check_out is None

    def _get_assigned_shift_for_date(self, day):
        """
        يرجع أحدث شفت متعيّن للموظف في اليوم ده.
        """
        return (
            EmployeeShiftAssignment.objects
            .filter(employee=self.employee, start_date__lte=day)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=day))
            .select_related("shift")
            .order_by("-start_date")
            .first()
        )

    def _calc_late_and_penalty(self):
        """
        يحسب التأخير والغرامة من:
        1) Shift assignment لو موجود
        2) شفت الموظف لو متحدد
        3) وإلا fallback لـ StoreSettings:
           - attendance_shift_start (وقت)
           - attendance_grace_minutes (دقائق)
           - attendance_penalty_per_15min (قيمة)
        """
        if not self.check_in:
            return
        
        local_dt = timezone.localtime(self.check_in)
        day = local_dt.date()

        # ✅ تأكد work_date متوافق مع check_in
        if not self.work_date:
            self.work_date = day

        # 1) Try shift assignment
        assignment = self._get_assigned_shift_for_date(day)
        if assignment and assignment.shift:
            shift = assignment.shift
            shift_start_time = shift.start_time
            grace_minutes = int(shift.grace_minutes or 0)
            penalty_per_15 = float(shift.penalty_per_15min or 0)
        else:
            # 2) Employee-specific shift
            employee_shift_start = getattr(self.employee, "shift_start_time", None)
            store_settings = getattr(self.employee.store, "settings", None)
            if employee_shift_start:
                shift_start_time = employee_shift_start
                grace_minutes = int(getattr(store_settings, "attendance_grace_minutes", 0) or 0) if store_settings else 0
            else:
                # 3) Fallback to store settings
                if not store_settings:
                    return
                shift_start_time = getattr(store_settings, "attendance_shift_start", None)
                if not shift_start_time:
                    return
                grace_minutes = int(getattr(store_settings, "attendance_grace_minutes", 0) or 0)

            branch_penalty = None
            if getattr(self.employee, "branch_id", None):
                branch_penalty = getattr(self.employee.branch, "attendance_penalty_per_15min", None)

            if branch_penalty is not None:
                penalty_per_15 = float(branch_penalty or 0)
            else:
                penalty_per_15 = float(getattr(store_settings, "attendance_penalty_per_15min", 0) or 0) if store_settings else 0
                
        shift_start_dt = timezone.make_aware(
            timezone.datetime.combine(day, shift_start_time),
            timezone.get_current_timezone(),
        )
        grace = timezone.timedelta(minutes=grace_minutes)

        if self.check_in > (shift_start_dt + grace):
            self.is_late = True
            self.late_minutes = int((self.check_in - (shift_start_dt + grace)).total_seconds() // 60)
            self.penalty_applied = (self.late_minutes // 15) * penalty_per_15

    def save(self, *args, **kwargs):
        # ✅ لو work_date مش متحدد و check_in موجود
        if (not self.work_date) and self.check_in:
            self.work_date = timezone.localtime(self.check_in).date()

        # Calculate late/penalty when check-in is set (on create or first update)
        if self.check_in and (not self.pk or self.late_minutes is None):
            self._calc_late_and_penalty()
            
        # Compute duration
        if self.check_out and self.check_in:
            delta = self.check_out - self.check_in
            self.duration_minutes = int(delta.total_seconds() // 60)

        super().save(*args, **kwargs)

    def __str__(self):
        status = "حاضر" if self.is_active else "غادر"
        return f"{self.employee} - {status} ({self.method})"


class AttendanceLink(models.Model):
    class Action(models.TextChoices):
        CHECKIN = "CHECKIN", "Check-in"
        CHECKOUT = "CHECKOUT", "Check-out"

    employee = models.ForeignKey("core.Employee", on_delete=models.CASCADE, related_name="attendance_links")
    action = models.CharField(max_length=10, choices=Action.choices)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    work_date = models.DateField(default=timezone.localdate, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["employee", "work_date"]),
        ]

    def is_valid(self, now=None):
        now = now or timezone.now()
        today = timezone.localdate(now)

        if self.used_at:
            return False

        if self.work_date and self.work_date != today:
            return False

        if self.expires_at and self.expires_at < now:
            return False

        return True

    def save(self, *args, **kwargs):
        if not self.work_date:
            self.work_date = timezone.localdate()

        if not self.expires_at:
            end_of_day = timezone.make_aware(
                timezone.datetime.combine(self.work_date, timezone.datetime.max.time()),
                timezone.get_current_timezone(),
            )
            self.expires_at = end_of_day

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} - {self.action} ({self.token})"

class MonthlyPayroll(models.Model):
    employee = models.ForeignKey("core.Employee", on_delete=models.CASCADE)
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()  # 1-12

    base_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_minutes = models.PositiveIntegerField(default=0)
    late_minutes = models.PositiveIntegerField(default=0)
    penalties_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    absences = models.PositiveIntegerField(default=0)
    leaves_days = models.PositiveIntegerField(default=0)

    net_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ("employee", "year", "month")

    def __str__(self):
        return f"{self.employee} - {self.year}/{self.month}"


class LeaveRequest(models.Model):
    employee = models.ForeignKey("core.Employee", on_delete=models.CASCADE)
    date_from = models.DateField()
    date_to = models.DateField()
    status = models.CharField(max_length=20, default="PENDING")  # APPROVED/REJECTED
    type = models.CharField(max_length=20, default="ANNUAL")

    def __str__(self):
        return f"{self.employee} - {self.type} ({self.date_from} -> {self.date_to}) [{self.status}]"
