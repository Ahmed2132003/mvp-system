# core/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core import views

router = DefaultRouter()
router.register(r'employees', views.EmployeeViewSet, basename='employees')

urlpatterns = [
    # Auth
    path('auth/me/', views.me_view),
    path('auth/verify-link/<uuid:token>/', views.verify_magic_link, name='verify-magic-link'),
    path("auth/forgot-password/", views.forgot_password_request, name="forgot-password"),
    path("auth/reset-password/", views.reset_password_confirm, name="reset-password"),

    path('logout/', views.LogoutView.as_view()),
    # Users
    path('users/', views.list_users),
    path('users/create/', views.create_user_account),

    # Payroll
    path('payrolls/<int:payroll_id>/close/', views.close_payroll),

    # Routers
    path('', include(router.urls)),
    path('stores/', views.list_stores),
    path("stores/me/", views.my_store, name="my-store"),
]
