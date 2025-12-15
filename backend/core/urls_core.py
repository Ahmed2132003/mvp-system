# core/urls_core.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core import views
from .store_api import my_store

router = DefaultRouter()
router.register(r'employees', views.EmployeeViewSet, basename='core-employees')

urlpatterns = [
    # ✅ employees actions under /api/v1/core/employees/...
    path("", include(router.urls)),

    # ✅ core scoped store endpoint
    path("stores/me/", my_store, name="core-my-store"),
]
