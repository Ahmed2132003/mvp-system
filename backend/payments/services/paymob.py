import requests
import hashlib
import hmac
from decouple import config


class PayMobService:
    API_BASE = "https://accept.paymob.com/api"
    AUTH_URL = f"{API_BASE}/auth/tokens"
    ORDER_REGISTRATION_URL = f"{API_BASE}/ecommerce/orders"
    PAYMENT_KEY_URL = f"{API_BASE}/acceptance/payment_keys"

    def __init__(self, store=None):
        """
        لو store اتبعت → استخدم store.paymob_keys
        لو مش اتبعت → استخدم env (اختياري)
        """
        self.store = store
        keys = (getattr(store, "paymob_keys", None) or {}) if store else {}

        # Toggle
        self.enabled = bool(keys.get("enabled", False))

        # Keys per store (الأولوية للـ store)
        self.api_key = keys.get("api_key") or config("PAYMOB_API_KEY", default="")
        self.hmac_secret = keys.get("hmac_secret") or config("PAYMOB_HMAC_SECRET", default="")
        self.iframe_id = str(keys.get("iframe_id") or config("PAYMOB_IFRAME_ID", default="")).strip()

        # Integrations
        self.integration_id_card = str(
            keys.get("integration_id_card") or config("PAYMOB_INTEGRATION_ID_CARD", default="")
        ).strip()
        self.integration_id_wallet = str(
            keys.get("integration_id_wallet") or config("PAYMOB_INTEGRATION_ID_WALLET", default="")
        ).strip()

        # sandbox flag (معلومات فقط عندك)
        self.sandbox_mode = bool(keys.get("sandbox_mode", True))

    def _require_enabled(self):
        if not self.enabled:
            raise ValueError("PayMob غير مفعل لهذا الفرع")

    def _require_keys(self):
        missing = []
        if not self.api_key:
            missing.append("api_key")
        if not self.iframe_id:
            missing.append("iframe_id")
        if not self.integration_id_card:
            missing.append("integration_id_card")
        if not self.hmac_secret:
            missing.append("hmac_secret")
        if missing:
            raise ValueError(f"PayMob keys missing: {', '.join(missing)}")

    def authenticate(self):
        self._require_enabled()
        self._require_keys()

        payload = {"api_key": self.api_key}
        response = requests.post(self.AUTH_URL, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()["token"]

    def register_order(self, auth_token, amount_cents, merchant_order_id):
        payload = {
            "auth_token": auth_token,
            "delivery_needed": False,
            "amount_cents": amount_cents,
            "currency": "EGP",
            "merchant_order_id": str(merchant_order_id),
            "items": [],
        }
        response = requests.post(self.ORDER_REGISTRATION_URL, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    def get_payment_key(self, auth_token, paymob_order_id, amount_cents, billing_data, integration_id=None):
        """
        integration_id: لو عايز تستخدم wallet integration مثلاً
        """
        self._require_enabled()
        self._require_keys()

        chosen_integration_id = integration_id or self.integration_id_card
        payload = {
            "auth_token": auth_token,
            "amount_cents": amount_cents,
            "expiration": 3600,
            "order_id": paymob_order_id,
            "billing_data": billing_data,
            "currency": "EGP",
            "integration_id": int(chosen_integration_id),
            "lock_order_when_paid": True,
        }
        response = requests.post(self.PAYMENT_KEY_URL, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()["token"]

    def get_iframe_url(self, payment_token):
        self._require_enabled()
        self._require_keys()
        return f"https://accept.paymob.com/api/acceptance/iframes/{self.iframe_id}?payment_token={payment_token}"

    def verify_webhook_signature(self, payload_obj, received_hmac):
        """
        PayMob HMAC verification
        """
        keys = [
            "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction",
            "id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
            "is_standalone_payment", "is_voided", "order.id", "owner", "pending",
            "source_data.pan", "source_data.sub_type", "source_data.type", "success",
        ]

        concatenated = ""
        for key in keys:
            value = payload_obj
            for part in key.split("."):
                value = value.get(part, "") if isinstance(value, dict) else ""
            concatenated += str(value)

        digest = hmac.new(
            (self.hmac_secret or "").encode("utf-8"),
            concatenated.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

        return hmac.compare_digest(digest, received_hmac)
