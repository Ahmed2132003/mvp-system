# core/services/payroll.py

import calendar
from decimal import Decimal

from django.db import models

from attendance.models import AttendanceLog
from core.models import PayrollPeriod, EmployeeLedger


def _get_month_range(month_date):
    month_start = month_date.replace(day=1)
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    month_end = month_start.replace(day=last_day)
    return month_start, month_end


def _get_ledger_totals(employee, month_date):
    month_start, month_end = _get_month_range(month_date)

    totals = {"BONUS": Decimal("0.00"), "PENALTY": Decimal("0.00"), "ADVANCE": Decimal("0.00")}

    ledger_rows = (
        EmployeeLedger.objects.filter(
            employee=employee,
            payout_date__gte=month_start,
            payout_date__lte=month_end,
        )
        .values("entry_type")
        .annotate(total_sum=models.Sum("amount"))
    )

    for row in ledger_rows:
        entry_type = row.get("entry_type")
        if entry_type in totals:
            totals[entry_type] = Decimal(row.get("total_sum") or 0).quantize(Decimal("0.01"))

    return totals
def generate_payroll(employee, month_date):
    logs = AttendanceLog.objects.filter(
        employee=employee,
        check_in__date__month=month_date.month,        
        check_in__date__year=month_date.year
    )
    total_minutes = sum(l.duration_minutes or 0 for l in logs)
    late_minutes = sum(l.late_minutes or 0 for l in logs)
    penalties = sum(l.penalty_applied or 0 for l in logs)
    attendance_days = logs.values_list("work_date", flat=True).distinct().count()

    if logs.exists() and (not employee.salary or float(employee.salary) <= 0):
        raise ValueError("لا يمكن احتساب مرتب بدون تحديد راتب للموظف.")

    monthly_salary = Decimal(employee.salary or 0)
    daily_rate = monthly_salary / Decimal(30) if monthly_salary else Decimal("0.00")
    base_salary = (Decimal(attendance_days) * daily_rate).quantize(Decimal("0.01"))

    ledger_totals = _get_ledger_totals(employee, month_date)
    ledger_bonus = ledger_totals["BONUS"]
    ledger_penalty = ledger_totals["PENALTY"]
    ledger_advances = ledger_totals["ADVANCE"]
    
    payroll, _ = PayrollPeriod.objects.get_or_create(
        employee=employee,
        month=month_date.replace(day=1),
        defaults={
            "attendance_days": attendance_days,
            "base_salary": base_salary,
            "monthly_salary": monthly_salary,
        }
    )

    if payroll.is_locked:
        return payroll
    
    payroll.total_work_minutes = total_minutes
    payroll.total_late_minutes = late_minutes
    payroll.attendance_days = attendance_days
    payroll.monthly_salary = monthly_salary
    payroll.base_salary = base_salary

    payroll.penalties = (Decimal(penalties) + ledger_penalty).quantize(Decimal("0.01"))
    payroll.bonuses = ledger_bonus
    payroll.advances = ledger_advances

    payroll.calculate_net_salary()
    if logs.exists() and float(payroll.net_salary) <= 0:
        raise ValueError("قيمة الصافي صفر بالرغم من وجود حضور. تأكد من بيانات الراتب.")
    
    payroll.save()

    return payroll