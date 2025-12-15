# branches/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.permissions import IsManager, IsEmployeeOfStore
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
        try:
            user_store = self.request.user.employee.store
            return Branch.objects.filter(store=user_store)
        except AttributeError:
            return Branch.objects.none()

    def perform_create(self, serializer):
        serializer.save(store=self.request.user.employee.store)