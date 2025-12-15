# loyalty/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import Store, Employee   # مهم جدًا
from core.permissions import IsOwner, IsManagerOrOwner
from .models import LoyaltyProgram, CustomerLoyalty, LoyaltyTransaction
from .serializers import (
    LoyaltyProgramSerializer, CustomerLoyaltySerializer, LoyaltyTransactionSerializer
)


def get_user_store(user):
    try:
        employee = user.employee
    except Employee.DoesNotExist:
        employee = None

    if employee and employee.store:
        return employee.store

    return Store.objects.filter(owner=user).first()


class LoyaltyProgramViewSet(viewsets.ModelViewSet):
    queryset = LoyaltyProgram.objects.all()
    serializer_class = LoyaltyProgramSerializer
    permission_classes = [IsOwner]

    def get_queryset(self):
        store = get_user_store(self.request.user)
        if not store:
            return LoyaltyProgram.objects.none()
        return self.queryset.filter(store=store)

    def perform_create(self, serializer):
        store = get_user_store(self.request.user)
        serializer.save(store=store)

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='current')
    def current(self, request):
        """
        GET  /api/v1/loyalty/program/current/
        PATCH/PUT /api/v1/loyalty/program/current/
        """
        store = get_user_store(request.user)
        if not store:
            return Response(
                {'detail': 'لا يوجد فرع مرتبط بالمستخدم الحالي.'},
                status=status.HTTP_404_NOT_FOUND
            )

        program, _ = LoyaltyProgram.objects.get_or_create(store=store)

        if request.method in ['PUT', 'PATCH']:
            serializer = self.get_serializer(
                program,
                data=request.data,
                partial=(request.method == 'PATCH')
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        serializer = self.get_serializer(program)
        return Response(serializer.data)


class CustomerLoyaltyViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CustomerLoyaltySerializer
    permission_classes = [IsManagerOrOwner]

    def get_queryset(self):
        store = get_user_store(self.request.user)
        if not store:
            return CustomerLoyalty.objects.none()
        return CustomerLoyalty.objects.filter(store=store)


class LoyaltyTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoyaltyTransactionSerializer
    permission_classes = [IsManagerOrOwner]

    def get_queryset(self):
        store = get_user_store(self.request.user)
        if not store:
            return LoyaltyTransaction.objects.none()
        return LoyaltyTransaction.objects.filter(customer__store=store)
