# loyalty/models.py
from django.db import models
from django.core.validators import MinValueValidator

class LoyaltyProgram(models.Model):
    store = models.OneToOneField('core.Store', on_delete=models.CASCADE, related_name='loyalty_program')
    is_active = models.BooleanField(default=False, verbose_name="تفعيل نظام الولاء")
    points_per_egp = models.DecimalField(
        max_digits=8, decimal_places=2, default=1.00,
        validators=[MinValueValidator(0.01)],
        help_text="كل كام جنيه يدّي نقطة واحدة (مثلاً: 10.00 = كل 10 جنيه = نقطة)"
    )
    egp_per_point = models.DecimalField(
        max_digits=8, decimal_places=2, default=1.00,
        validators=[MinValueValidator(0.01)],
        help_text="كل نقطة تساوي كام جنيه خصم (مثلاً: 1.00 = النقطة بجنيه)"
    )
    min_points_to_redeem = models.PositiveIntegerField(default=50, help_text="أقل عدد نقاط للاستبدال")
    expiry_months = models.PositiveIntegerField(null=True, blank=True, help_text="عدد الشهور قبل انتهاء النقاط (اتركه فاضي = لا ينتهي)")

    class Meta:
        verbose_name = "برنامج الولاء"
        verbose_name_plural = "برامج الولاء"

    def __str__(self):
        status = "مفعل" if self.is_active else "معطل"
        return f"{self.store.name} - {status}"


class CustomerLoyalty(models.Model):
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='loyalty_customers')
    phone = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    points = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    last_visit = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('store', 'phone')
        verbose_name = "عميل ولاء"
        verbose_name_plural = "عملاء الولاء"

    def __str__(self):
        return f"{self.name or self.phone} ({self.store.name}) - {self.points} نقطة"


class LoyaltyTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('EARN', 'إضافة نقاط'),
        ('REDEEM', 'استبدال نقاط'),
        ('EXPIRE', 'انتهاء صلاحية'),
    ]

    customer = models.ForeignKey(CustomerLoyalty, on_delete=models.CASCADE, related_name='transactions')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    points = models.IntegerField(help_text="موجب = إضافة، سالب = خصم")
    note = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer.phone} | {self.points:+} | {self.get_type_display()}"