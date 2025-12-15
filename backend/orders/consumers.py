# backend/orders/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class KDSConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # مجموعة عامة للـ KDS (MVP – فرع واحد)
        self.group_name = "kds"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )

    async def receive_json(self, content, **kwargs):
        """
        حالياً مش هنعتمد على رسائل من الفرونت غير لو حبينا بعدين
        نعمل update status عبر WebSocket.
        كل التغييرات الأساسية هتيجي من REST API.
        """
        pass

    # ✅ رسائل من السيرفر → العميل
    async def kds_order_created(self, event):
        await self.send_json({
            "type": "order_created",
            "order": event["order"],
        })

    async def kds_order_updated(self, event):
        await self.send_json({
            "type": "order_updated",
            "order": event["order"],
        })
