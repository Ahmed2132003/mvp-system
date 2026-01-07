# backend/branches/models.py
import base64
from io import BytesIO

import qrcode
from django.conf import settings
from django.core.files import File
from django.db import models

class Branch(models.Model):
    name = models.CharField(max_length=255)  # اسم الفرع
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='branches')
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    qr_menu = models.ImageField(upload_to="branch_qr/", blank=True, null=True)
    qr_menu_base64 = models.TextField(blank=True, null=True, editable=False)
    attendance_penalty_per_15min = models.DecimalField(
        "غرامة التأخير لكل 15 دقيقة",
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.store.name} - {self.name}"
    def _generate_qr_image_and_base64(self, url: str):
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        base64_str = base64.b64encode(buffer.read()).decode("utf-8")
        buffer.seek(0)

        return buffer, base64_str

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if not self.id:
            return

        should_generate_qr = not self.qr_menu or not self.qr_menu_base64
        if should_generate_qr:
            menu_url = f"{settings.SITE_URL}/store/{self.store_id}/menu/?branch={self.id}"
            buffer, b64 = self._generate_qr_image_and_base64(menu_url)

            filename = f"qr_branch_menu_{self.id}.png"
            self.qr_menu.save(filename, File(buffer), save=False)

            Branch.objects.filter(pk=self.pk).update(
                qr_menu=self.qr_menu,
                qr_menu_base64=b64,
            )

    class Meta:
        unique_together = ('store', 'name')