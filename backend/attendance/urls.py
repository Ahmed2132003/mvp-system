# attendance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'logs', views.AttendanceViewSet, basename='attendance')  # غيّرنا prefix

urlpatterns = [
    path('check/', views.attendance_check, name='attendance-check'),
    path('my-status/', views.my_attendance_status, name='attendance-my-status'),
    path('my-logs/', views.my_attendance_logs, name='attendance-my-logs'),
    path('link/', views.create_qr_link, name='attendance-link-create'),
    path('qr/use/<uuid:token>/', views.qr_use_page, name='attendance-qr-use-page'),
    path('qr/use/', views.qr_use, name='attendance-qr-use'),
    path('qr/', views.qr_redirect, name='attendance-qr-redirect'),
    path('', include(router.urls)),
]