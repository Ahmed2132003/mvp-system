from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import InitiatePaymentView, paymob_webhook

router = DefaultRouter()
urlpatterns = router.urls

urlpatterns = [
    path('initiate/<uuid:order_id>/', InitiatePaymentView.as_view(), name='initiate-payment'),
    path('paymob/webhook/', paymob_webhook, name='paymob-webhook'),
]