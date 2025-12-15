from rest_framework.exceptions import NotFound

def get_employee_or_404(user):
    if hasattr(user, 'employee'):
        return user.employee
    raise NotFound("هذا المستخدم لا يملك ملف موظف")
