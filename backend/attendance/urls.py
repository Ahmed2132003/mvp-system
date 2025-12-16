# attendance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'logs', views.AttendanceViewSet, basename='attendance')  # غيّرنا prefix

urlpatterns = [
    path('check/', views.attendance_check, name='attendance-check'),
    path('my-status/', views.my_attendance_status, name='attendance-my-status'),
    path('qr/', views.qr_redirect, name='attendance-qr-redirect'),
    path('', include(router.urls)),
]