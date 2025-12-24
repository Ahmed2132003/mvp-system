# core/services/payroll.py

from django.utils import timezone
from attendance.models import AttendanceLog
from core.models import PayrollPeriod, EmployeeLedger

def generate_payroll(employee, month_date):
    logs = AttendanceLog.objects.filter(
        employee=employee,
        check_in__date__month=month_date.month,
        check_in__date__year=month_date.year
    )

    total_minutes = sum(l.duration_minutes or 0 for l in logs)
    late_minutes = sum(l.late_minutes or 0 for l in logs)
    penalties = sum(l.penalty_applied or 0 for l in logs)

    if logs.exists() and (not employee.salary or float(employee.salary) <= 0):
        raise ValueError("لا يمكن احتساب مرتب بدون تحديد راتب للموظف.")

    payroll, _ = PayrollPeriod.objects.get_or_create(
        employee=employee,
        month=month_date.replace(day=1),
        defaults={
            'base_salary': employee.salary or 0
        }
    )

    if payroll.is_locked:
        return payroll
    
    payroll.total_work_minutes = total_minutes
    payroll.total_late_minutes = late_minutes
    payroll.penalties = penalties
    payroll.advances = employee.advances or 0
    payroll.calculate_net_salary()

    if logs.exists() and float(payroll.net_salary) <= 0:
        raise ValueError("قيمة الصافي صفر بالرغم من وجود حضور. تأكد من بيانات الراتب.")

    payroll.save()

    return payroll