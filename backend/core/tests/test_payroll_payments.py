import pytest
from decimal import Decimal
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Employee, EmployeeLedger, PayrollPeriod, Store, User


@pytest.mark.django_db
def test_mark_paid_archives_ledger_without_deleting():
    client = APIClient()

    # مستخدم مدير مع موظف مرتبط بنفس المتجر
    store = Store.objects.create(name="Main")
    user = User.objects.create_user(
        email="manager@example.com", password="pass", role=User.RoleChoices.MANAGER, is_active=True
    )
    employee = Employee.objects.create(user=user, store=store, salary=Decimal("100"))

    month_start = timezone.datetime(2024, 1, 1).date()
    payroll = PayrollPeriod.objects.create(
        employee=employee,
        month=month_start,
        base_salary=Decimal("500"),
        monthly_salary=Decimal("3000"),
        penalties=Decimal("20"),
        late_penalties=Decimal("5"),
        bonuses=Decimal("30"),
        advances=Decimal("50"),
        net_salary=Decimal("455"),
    )

    # عمليات الشهر (لازم تفضل موجودة بعد الدفع)
    bonus = EmployeeLedger.objects.create(
        employee=employee, entry_type="BONUS", amount=Decimal("30"), payout_date=month_start
    )
    penalty = EmployeeLedger.objects.create(
        employee=employee, entry_type="PENALTY", amount=Decimal("20"), payout_date=month_start
    )
    advance = EmployeeLedger.objects.create(
        employee=employee, entry_type="ADVANCE", amount=Decimal("50"), payout_date=month_start
    )

    client.force_authenticate(user=user)
    url = reverse("employees-mark-paid", args=[employee.id])
    response = client.post(url, {"payroll_id": payroll.id}, format="json")

    assert response.status_code == 200
    payroll.refresh_from_db()
    assert payroll.is_paid is True
    assert payroll.paid_by == user

    # الحركات الأصلية بتتربط بكشف المرتب وما بتتمسحش
    for entry in (bonus, penalty, advance):
        entry.refresh_from_db()
        assert entry.payroll_id == payroll.id
    assert EmployeeLedger.objects.filter(employee=employee, entry_type="SALARY", payroll=payroll).exists()

    # بعد الدفع تبدأ الفترة الجديدة من غير سلفات متراكمة
    employee.refresh_from_db()
    assert employee.advances == 0