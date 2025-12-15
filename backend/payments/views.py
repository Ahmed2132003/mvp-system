from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .services.paymob import PayMobService
from .models import Payment
from orders.models import Order

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json


class InitiatePaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.select_related('store').get(
                id=order_id,
                store__owner=request.user,
                payment_status__in=['PENDING', 'UNPAID']
            )

            # PayMob Enabled check per store
            keys = order.store.paymob_keys or {}
            if not keys.get("enabled", False):
                return Response({"error": "PayMob غير مفعل لهذا الفرع"}, status=400)

            if hasattr(order, 'payment') and order.payment.status == 'SUCCESS':
                return Response({"error": "الطلب مدفوع بالفعل"}, status=400)

            # ✅ use store keys
            service = PayMobService(store=order.store)

            # 1. Authentication
            auth_token = service.authenticate()

            # 2. Register Order
            paymob_order = service.register_order(
                auth_token=auth_token,
                amount_cents=int(order.total * 100),
                merchant_order_id=order.id
            )

            # 3. Billing Data (ممكن تتحسن لاحقًا)
            billing_data = {
                "email": request.user.email or "na@example.com",
                "phone_number": order.customer_phone or "+201000000000",
                "first_name": "Customer",
                "last_name": "User",
                **{k: "NA" for k in ["apartment", "floor", "street", "building", "city", "state", "country", "postal_code"]}
            }

            # 4. Get Payment Key (Card integration by default)
            payment_token = service.get_payment_key(
                auth_token=auth_token,
                paymob_order_id=paymob_order['id'],
                amount_cents=int(order.total * 100),
                billing_data=billing_data,
                integration_id=(keys.get("integration_id_card") or None),
            )

            iframe_url = service.get_iframe_url(payment_token)

            # حفظ أو تحديث الدفع
            payment, created = Payment.objects.update_or_create(
                order=order,
                defaults={
                    'amount': order.total,
                    'transaction_id': str(paymob_order['id']),
                    'iframe_url': iframe_url,
                    'status': 'PENDING'
                }
            )

            return Response({
                "success": True,
                "iframe_url": iframe_url,
                "payment_id": str(payment.id),
                "paymob_order_id": paymob_order['id']
            })

        except Order.DoesNotExist:
            return Response({"error": "الطلب غير موجود أو ليس ملكك"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


@csrf_exempt
def paymob_webhook(request):
    if request.method != 'POST':
        return JsonResponse({"status": "method not allowed"}, status=405)

    try:
        payload = json.loads(request.body)
        received_hmac = request.GET.get('hmac')  # أو request.headers.get('hmac')

        if not received_hmac:
            return JsonResponse({"error": "Missing HMAC"}, status=400)

        obj = payload.get('obj', {})

        # ⚠️ هنا مفيش store مباشرة، فبنستخدم env fallback
        # لو عايز تعمل HMAC per-store لازم تجيب order الأول ثم تستخدم keys بتاع store
        service = PayMobService()

        if not service.verify_webhook_signature(obj, received_hmac):
            return JsonResponse({"error": "Invalid HMAC"}, status=400)

        # فقط لو المعاملة ناجحة وغير ملغاة
        if obj.get('success') and not obj.get('is_voided') and not obj.get('is_refunded'):
            merchant_order_id = obj['order']['merchant_order_id']

            try:
                order = Order.objects.get(id=merchant_order_id)

                # منع التكرار
                if order.payment_status == 'PAID':
                    return JsonResponse({"status": "already processed"})

                # تحديث حالة الدفع
                payment = order.payment
                payment.status = 'SUCCESS'
                payment.transaction_id = str(obj['id'])
                payment.save()

                # تحديث حالة الطلب
                order.payment_status = 'PAID'
                order.status = 'CONFIRMED'  # أو 'PREPARING'
                order.save()

                # تشغيل المهام الخلفية (خصم مخزون، نقاط ولاء، إشعار)
                from payments.tasks import process_successful_payment
                process_successful_payment.delay(order.id)

                return JsonResponse({"status": "success"})

            except Order.DoesNotExist:
                return JsonResponse({"error": "order not found"}, status=404)

        return JsonResponse({"status": "ignored"})

    except Exception:
        # لا ترجع تفاصيل الخطأ للخارج
        return JsonResponse({"status": "error"}, status=500)
