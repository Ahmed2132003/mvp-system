# branches/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.exceptions import ValidationError
from core.permissions import IsManager, IsEmployeeOfStore
from core.utils.store_context import get_store_from_request
from .models import Branch
from .serializers import BranchSerializer


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.select_related('store').all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated, IsManager, IsEmployeeOfStore]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'store']
    search_fields = ['name', 'address', 'phone']
    ordering_fields = ['name', 'created_at', 'is_active']
    ordering = ['name']

    def get_queryset(self):
        store = get_store_from_request(self.request)
        if not store:            
            return Branch.objects.none()
        
        return Branch.objects.filter(store=store)

    def perform_create(self, serializer):
        store = get_store_from_request(self.request)
        if not store:
            raise ValidationError({"detail": "لا يوجد فرع مرتبط بهذا الحساب."})

        serializer.save(store=store)