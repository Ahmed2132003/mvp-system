# attendance/admin.py

from django.contrib import admin
from django.utils import timezone
from django.db.models import Q

from .models import (
    AttendanceLog,
    Shift,
    EmployeeShiftAssignment,
    MonthlyPayroll,
    LeaveRequest,
)


# ----------------------------
# Filters
# ----------------------------
class ActiveSessionFilter(admin.SimpleListFilter):
    title = "Session"
    parameter_name = "session"

    def lookups(self, request, model_admin):
        return (
            ("active", "Active (No Checkout)"),
            ("closed", "Closed (Has Checkout)"),
        )

    def queryset(self, request, queryset):
        v = self.value()
        if v == "active":
            return queryset.filter(check_out__isnull=True)
        if v == "closed":
            return queryset.filter(check_out__isnull=False)
        return queryset


class LateFilter(admin.SimpleListFilter):
    title = "Late"
    parameter_name = "late"

    def lookups(self, request, model_admin):
        return (
            ("late", "Late فقط"),
            ("ontime", "On time فقط"),
        )

    def queryset(self, request, queryset):
        v = self.value()
        if v == "late":
            return queryset.filter(is_late=True)
        if v == "ontime":
            return queryset.filter(Q(is_late=False) | Q(is_late__isnull=True))
        return queryset


# ----------------------------
# Shift
# ----------------------------
@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "store",
        "name",
        "start_time",
        "end_time",
        "grace_minutes",
        "penalty_per_15min",
    )
    list_filter = ("store",)
    search_fields = ("name", "store__name")
    ordering = ("store", "start_time")


# ----------------------------
# EmployeeShiftAssignment
# ----------------------------
@admin.register(EmployeeShiftAssignment)
class EmployeeShiftAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "shift",
        "start_date",
        "end_date",
        "is_current",
    )
    list_filter = ("shift__store", "shift", "start_date", "end_date")
    search_fields = (
        "employee__user__name",
        "employee__user__username",
        "employee__user__email",
        "shift__name",
        "shift__store__name",
    )
    ordering = ("-start_date",)

    def is_current(self, obj):
        today = timezone.localdate()
        if obj.start_date and today < obj.start_date:
            return False
        if obj.end_date and today > obj.end_date:
            return False
        return True

    is_current.boolean = True
    is_current.short_description = "Current?"


# ----------------------------
# AttendanceLog
# ----------------------------
@admin.action(description="Mark as MANUAL method")
def mark_manual(modeladmin, request, queryset):
    queryset.update(method="MANUAL")


@admin.action(description="Close active sessions now (set check_out=now)")
def close_sessions_now(modeladmin, request, queryset):
    now = timezone.now()
    # قفل بس اللي مفيهاش check_out
    for obj in queryset.filter(check_out__isnull=True):
        obj.check_out = now
        obj.save()


@admin.register(AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "store",
        "work_date",
        "method",
        "check_in",
        "check_out",
        "duration_minutes",
        "is_late",
        "late_minutes",
        "penalty_applied",
    )
    list_filter = (
        "method",
        "work_date",
        "employee__store",
        ActiveSessionFilter,
        LateFilter,
    )
    search_fields = (
        "employee__user__name",
        "employee__user__username",
        "employee__user__email",
        "employee__store__name",
    )
    date_hierarchy = "work_date"
    ordering = ("-check_in",)
    actions = [mark_manual, close_sessions_now]
    readonly_fields = ("duration_minutes",)

    def store(self, obj):
        try:
            return obj.employee.store
        except Exception:
            return "—"

    store.short_description = "Store"


# ----------------------------
# MonthlyPayroll
# ----------------------------
@admin.register(MonthlyPayroll)
class MonthlyPayrollAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "year",
        "month",
        "base_salary",
        "total_minutes",
        "late_minutes",
        "penalties_total",
        "absences",
        "leaves_days",
        "net_salary",
    )
    list_filter = ("year", "month", "employee__store")
    search_fields = (
        "employee__user__name",
        "employee__user__username",
        "employee__user__email",
        "employee__store__name",
    )
    ordering = ("-year", "-month", "employee")


# ----------------------------
# LeaveRequest
# ----------------------------
@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "type",
        "status",
        "date_from",
        "date_to",
        "days_count",
    )
    list_filter = ("status", "type", "employee__store", "date_from", "date_to")
    search_fields = (
        "employee__user__name",
        "employee__user__username",
        "employee__user__email",
        "employee__store__name",
    )
    ordering = ("-date_from",)

    @admin.display(description="Days")
    def days_count(self, obj):
        if not obj.date_from or not obj.date_to:
            return 0
        # inclusive
        return (obj.date_to - obj.date_from).days + 1
