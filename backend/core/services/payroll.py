# core/services/payroll.py
from __future__ import annotations

from datetime import date
from decimal import Decimal
import calendar

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from core.models import PayrollPeriod, EmployeeLedger

try:
    # attendance app (as used by your serializers)
    from attendance.models import AttendanceLog
except Exception:  # pragma: no cover
    AttendanceLog = None  # type: ignore


def _month_range(month_date: date) -> tuple[date, date]:
    """Return (start, end_exclusive) for month_date (assumed day=1)."""
    start = month_date.replace(day=1)
    last_day = calendar.monthrange(start.year, start.month)[1]
    end_exclusive = start.replace(day=last_day) + timezone.timedelta(days=1)
    return start, end_exclusive


def _count_attendance_days(employee_id: int, start: date, end_exclusive: date) -> int:
    """
    Count DISTINCT attendance days for employee within [start, end_exclusive).
    Prefers AttendanceLog.work_date if present; otherwise falls back to check_in date.
    """
    if AttendanceLog is None:
        return 0

    qs = AttendanceLog.objects.filter(employee_id=employee_id)

    # If AttendanceLog has a work_date field, use it.
    if hasattr(AttendanceLog, "work_date"):
        return (
            qs.filter(work_date__gte=start, work_date__lt=end_exclusive)
              .values("work_date")
              .distinct()
              .count()
        )

    # Fallback: derive date from check_in
    if hasattr(AttendanceLog, "check_in"):
        return (
            qs.filter(check_in__date__gte=start, check_in__date__lt=end_exclusive)
              .values("check_in__date")
              .distinct()
              .count()
        )

    return 0


def _sum_minutes(employee_id: int, start: date, end_exclusive: date) -> tuple[int, int]:
    """Return (total_work_minutes, total_late_minutes) if fields exist; else (0,0)."""
    if AttendanceLog is None:
        return 0, 0

    qs = AttendanceLog.objects.filter(employee_id=employee_id)

    if hasattr(AttendanceLog, "work_date"):
        qs = qs.filter(work_date__gte=start, work_date__lt=end_exclusive)
    elif hasattr(AttendanceLog, "check_in"):
        qs = qs.filter(check_in__date__gte=start, check_in__date__lt=end_exclusive)
    else:
        return 0, 0

    total_work = 0
    total_late = 0

    if hasattr(AttendanceLog, "duration_minutes"):
        total_work = int(qs.aggregate(s=Sum("duration_minutes"))["s"] or 0)
    if hasattr(AttendanceLog, "late_minutes"):
        total_late = int(qs.aggregate(s=Sum("late_minutes"))["s"] or 0)

    return total_work, total_late


def _ledger_totals(employee_id: int, start: date, end_exclusive: date) -> dict[str, Decimal]:
    """
    Sum employee ledger entries for the month:
    - PENALTY -> penalties
    - BONUS   -> bonuses
    - ADVANCE -> advances
    Excludes SALARY entries (since those are payments, not inputs).
    """
    base_qs = EmployeeLedger.objects.filter(
        employee_id=employee_id,
        payout_date__gte=start,
        payout_date__lt=end_exclusive,
    )

    def _sum(entry_type: str) -> Decimal:
        return Decimal(base_qs.filter(entry_type=entry_type).aggregate(s=Sum("amount"))["s"] or 0)

    return {
        "penalties": _sum("PENALTY"),
        "bonuses": _sum("BONUS"),
        "advances": _sum("ADVANCE"),
    }


@transaction.atomic
def generate_payroll(*, employee, month_date: date) -> PayrollPeriod:
    """
    Generate (or return existing) PayrollPeriod for employee/month with the logic you requested:

    daily_rate      = monthly_salary / 30
    base_salary     = attendance_days * daily_rate
    net_salary      = base_salary + bonuses - penalties - advances
    net_salary min  = 0

    Also stores snapshots: attendance_days, monthly_salary, total_work_minutes, total_late_minutes.
    """
    if not month_date:
        raise ValueError("month_date مطلوب")

    month_date = month_date.replace(day=1)
    start, end_exclusive = _month_range(month_date)

    existing = PayrollPeriod.objects.filter(employee=employee, month=month_date).first()
    if existing:
        # Do not overwrite a paid payroll.
        return existing

    monthly_salary = Decimal(getattr(employee, "salary", 0) or 0)
    if monthly_salary <= 0:
        raise ValueError("يجب إدخال راتب أساسي صالح.")

    attendance_days = _count_attendance_days(employee.id, start, end_exclusive)
    total_work_minutes, total_late_minutes = _sum_minutes(employee.id, start, end_exclusive)

    daily_rate = (monthly_salary / Decimal(30))
    base_salary = (daily_rate * Decimal(attendance_days))

    totals = _ledger_totals(employee.id, start, end_exclusive)
    penalties = totals["penalties"]
    bonuses = totals["bonuses"]
    advances = totals["advances"]

    net_salary = base_salary + bonuses - penalties - advances
    if net_salary < 0:
        net_salary = Decimal(0)

    payroll = PayrollPeriod.objects.create(
        employee=employee,
        month=month_date,
        monthly_salary=monthly_salary,
        attendance_days=attendance_days,
        total_work_minutes=total_work_minutes,
        total_late_minutes=total_late_minutes,
        base_salary=base_salary,
        penalties=penalties,
        bonuses=bonuses,
        advances=advances,
        net_salary=net_salary,
    )
    return payroll
