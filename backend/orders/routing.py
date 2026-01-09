from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # نسمح بـ /ws/kds/ أو /ws/kds␊
    re_path(r"^/?ws/kds/?$", consumers.KDSConsumer.as_asgi()),
]