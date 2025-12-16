# attendance/serializers.py

from rest_framework import serializers
from attendance.models import AttendanceLog
from core.models import Employee
from core.serializers import EmployeeSerializer


class AttendanceLogSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="employee",
        write_only=True
    )

    duration = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceLog
        fields = [
            "id",
            "employee",
            "employee_id",
            "work_date",
            "check_in",
            "check_out",
            "method",
            "gps",
            "location",
            "duration",
            "is_late",
            "late_minutes",
            "penalty_applied",
        ]
        read_only_fields = [
            "work_date",
            "check_in",
            "check_out",
            "gps",
            "location",
            "duration",
            "is_late",
            "late_minutes",
            "penalty_applied",
        ]
        
    def get_duration(self, obj):
        if obj.duration_minutes:
            h = obj.duration_minutes // 60
            m = obj.duration_minutes % 60
            return f"{h}h {m}m"
        return None
