# core/models.py

from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.core.mail import send_mail

import uuid
import base64
from io import BytesIO
import qrcode
from django.core.files import File


# ======================
# User & Authentication
# ======================

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "OWNER")
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class RoleChoices(models.TextChoices):
        OWNER = "OWNER", "Owner"
        MANAGER = "MANAGER", "Manager"
        STAFF = "STAFF", "Staff"

    username = None
    email = models.EmailField(max_length=254, unique=True)

    name = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=10, choices=RoleChoices.choices, default=RoleChoices.STAFF)

    # important: you’re using activation via magic-link
    is_active = models.BooleanField(default=False)

    # Magic Link Fields
    verification_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, null=True, blank=True)
    verification_token_expires_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def send_verification_link(self):
        if not self.email:
            return False

        self.verification_token = uuid.uuid4()
        self.verification_token_expires_at = timezone.now() + timezone.timedelta(minutes=15)
        self.save(update_fields=["verification_token", "verification_token_expires_at"])

        verification_url = f"{settings.SITE_URL}/api/v1/auth/verify-link/{self.verification_token}/"

        subject = "تفعيل حسابك في MVP POS"
        message = f"""
مرحبًا {self.name or 'العميل'},

تم إنشاء حسابك بنجاح في MVP POS!

اضغط على الرابط التالي لتفعيل حسابك وتسجيل الدخول مباشرة:

{verification_url}

الرابط صالح لمدة 15 دقيقة فقط.

لو ما طلبتش الحساب ده، تجاهل الرسالة.

فريق MVP POS
"""

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [self.email],
            fail_silently=False,
        )
        return True

    def __str__(self):
        return f"{self.name or self.email} - {self.role}"


# ======================
# Store + StoreSettings
# ======================

class Store(models.Model):
    name = models.CharField("اسم الفرع", max_length=255)

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="owned_stores",
        null=True,
        blank=True,
        limit_choices_to={"role": User.RoleChoices.OWNER},
    )

    address = models.TextField("العنوان", blank=True, null=True)
    phone = models.CharField("تليفون الفرع", max_length=20, blank=True, null=True)

    paymob_keys = models.JSONField(default=dict, blank=True)

    # ✅ QR للمنيو العام للفرع
    qr_menu = models.ImageField(upload_to="store_qr/", blank=True, null=True)
    qr_menu_base64 = models.TextField(blank=True, null=True, editable=False)

    # ✅ NEW: QR موحّد للحضور/الانصراف (Store-level)
    qr_attendance = models.ImageField(upload_to="store_qr/", blank=True, null=True)
    qr_attendance_base64 = models.TextField(blank=True, null=True, editable=False)

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True, editable=False)

    def __str__(self):
        owner_name = (
            self.owner.name if self.owner and self.owner.name else (self.owner.email if self.owner else "غير محدد")
        )
        return f"{self.name} - {owner_name}"

    class Meta:
        verbose_name = "فرع"
        verbose_name_plural = "الفروع"
        ordering = ["-created_at"]

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

        # 1) Generate menu QR if missing
        if not self.qr_menu:
            menu_url = f"{settings.SITE_URL}/store/{self.id}/menu/"
            buffer, b64 = self._generate_qr_image_and_base64(menu_url)

            filename = f"qr_store_menu_{self.id}.png"
            self.qr_menu.save(filename, File(buffer), save=False)

            Store.objects.filter(pk=self.pk).update(
                qr_menu=self.qr_menu,
                qr_menu_base64=b64,
            )

        # 2) Generate attendance QR if missing (موحّد للحضور/الانصراف)
        if not self.qr_attendance:
            attendance_url = f"{settings.SITE_URL}/attendance/qr/?store={self.id}"
            buffer, b64 = self._generate_qr_image_and_base64(attendance_url)

            filename = f"qr_store_attendance_{self.id}.png"
            self.qr_attendance.save(filename, File(buffer), save=False)

            Store.objects.filter(pk=self.pk).update(
                qr_attendance=self.qr_attendance,
                qr_attendance_base64=b64,
            )


class StoreSettings(models.Model):
    store = models.OneToOneField(Store, on_delete=models.CASCADE, related_name="settings")

    loyalty_enabled = models.BooleanField("تفعيل برنامج الولاء", default=False)
    allow_negative_stock = models.BooleanField("السماح بمخزون سالب", default=False)
    allow_order_without_stock = models.BooleanField("السماح بطلب بدون مخزون", default=True)

    tax_rate = models.DecimalField("نسبة الضريبة %", max_digits=5, decimal_places=2, default=14.00)
    service_charge = models.DecimalField("مصاريف خدمة %", max_digits=5, decimal_places=2, default=0.00)

    printer_ip = models.GenericIPAddressField("IP الطابعة", null=True, blank=True)
    printer_port = models.PositiveIntegerField("Port الطابعة", null=True, blank=True)

    # ✅ NEW: إعدادات الشفت والتأخير للحضور (مرحلة أولى)
    attendance_shift_start = models.TimeField("بداية الشفت", default=timezone.datetime(2000, 1, 1, 9, 0).time())
    attendance_grace_minutes = models.PositiveIntegerField("سماحية التأخير بالدقائق", default=30)
    attendance_penalty_per_15min = models.DecimalField("غرامة كل 15 دقيقة", max_digits=8, decimal_places=2, default=50.00)

    def __str__(self):
        return f"إعدادات - {self.store.name}"

    class Meta:
        verbose_name = "إعدادات الفرع"
        verbose_name_plural = "إعدادات الفروع"


# ======================
# Employee
# ======================

class EmployeeQuerySet(models.QuerySet):
    def active(self):
        return self.filter(user__is_active=True)

    def at_store(self, store):
        return self.filter(store=store)


class EmployeeManager(models.Manager):
    def get_queryset(self):
        return EmployeeQuerySet(self.model, using=self._db)

    def active(self, *args, **kwargs):
        return self.get_queryset().active(*args, **kwargs)

    def at_store(self, *args, **kwargs):
        return self.get_queryset().at_store(*args, **kwargs)


# core/models.py (Employee فقط)

class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employee")

    store = models.ForeignKey(
        "core.Store",
        on_delete=models.PROTECT,
        null=False,
        blank=False,
        related_name="employees",
    )

    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="employees",
    )
    
    # ✅ Attendance QR per-employee
    qr_attendance = models.ImageField(upload_to="employee_attendance_qr/", blank=True, null=True)
    qr_attendance_base64 = models.TextField(blank=True, null=True, editable=False)

    hire_date = models.DateField(null=True, blank=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    advances = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    objects = EmployeeManager()

    def __str__(self):
        return f"{self.user.name or self.user.email} - {self.user.role}"

    def clean(self):
        super().clean()

        if self.branch and self.store_id and self.branch.store_id != self.store_id:
            raise ValidationError({
                "branch": "يجب أن يكون الفرع تابعًا لنفس المتجر الخاص بالموظف."
            })
            
    def _generate_qr_image_and_base64(self, url: str):
        import base64
        from io import BytesIO
        import qrcode
        from django.core.files import File

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        base64_str = base64.b64encode(buffer.read()).decode("utf-8")
        buffer.seek(0)

        return buffer, base64_str, File(buffer)

    def save(self, *args, **kwargs):
        # تأكيد تطابق الفرع مع المتجر قبل الحفظ
        self.full_clean()

        super().save(*args, **kwargs)
        
        # ✅ Generate employee attendance QR if missing
        if not self.qr_attendance:
            # رابط الـ QR يفتح redirect عام لكنه يحتوي employee + store
            # (مهم جدًا: الموظف بيفتحه من داخل التطبيق + JWT يسجل الحضور)
            attendance_url = f"{settings.SITE_URL}/attendance/qr/?store={self.store_id}&employee={self.id}"

            buffer, b64, file_obj = self._generate_qr_image_and_base64(attendance_url)

            filename = f"qr_employee_attendance_{self.id}.png"
            self.qr_attendance.save(filename, file_obj, save=False)

            Employee.objects.filter(pk=self.pk).update(
                qr_attendance=self.qr_attendance,
                qr_attendance_base64=b64,
            )




# ======================
# Payroll
# ======================

class PayrollPeriod(models.Model):
    employee = models.ForeignKey("core.Employee", on_delete=models.CASCADE, related_name="payrolls")

    month = models.DateField(help_text="أول يوم في الشهر")
    
    base_salary = models.DecimalField(max_digits=10, decimal_places=2)
    total_work_minutes = models.PositiveIntegerField(default=0)
    total_late_minutes = models.PositiveIntegerField(default=0)

    penalties = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    bonuses = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    advances = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    net_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, editable=False)

    is_locked = models.BooleanField(default=False)
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateField(null=True, blank=True)
    paid_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_payrolls",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ("employee", "month")
        ordering = ["-month"]

    def calculate_net_salary(self):
        self.net_salary = self.base_salary - self.penalties - self.advances + self.bonuses

    def lock(self):
        self.calculate_net_salary()
        self.is_locked = True
        self.save(update_fields=["net_salary", "is_locked"])

    def mark_paid(self, by_user=None, paid_date=None):
        self.calculate_net_salary()
        self.is_paid = True
        self.paid_at = paid_date or timezone.localdate()
        if by_user:
            self.paid_by = by_user
        self.save(update_fields=["net_salary", "is_paid", "paid_at", "paid_by"])
        
    def __str__(self):
        return f"{self.employee} - {self.month.strftime('%Y-%m')}"


class EmployeeLedger(models.Model):
    ENTRY_TYPES = [
        ("SALARY", "Salary"),
        ("PENALTY", "Penalty"),
        ("ADVANCE", "Advance"),
        ("BONUS", "Bonus"),
    ]

    employee = models.ForeignKey("core.Employee", on_delete=models.CASCADE, related_name="ledger_entries")

    payroll = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )

    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)

    # تاريخ صرف/تسجيل الحركة (اليوم الفعلي للصرف)
    payout_date = models.DateField(default=timezone.localdate, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.amount >= 0 else "-"
        return f"{self.employee} | {self.entry_type} | {sign}{abs(self.amount)}"


# ======================
# Signals
# ======================

@receiver(post_save, sender=User)
def create_employee_profile(sender, instance, created, **kwargs):
    """
    - OWNER: يتفعل مباشرة (ولا ننشئ Employee تلقائيًا)
    - STAFF/MANAGER: Employee ينشأ فقط من RegisterUserSerializer/Admin (علشان store إجباري)
    """
    if not created:
        return

    if instance.role == User.RoleChoices.OWNER:
        if not instance.is_active:
            instance.is_active = True
            instance.save(update_fields=["is_active"])
        return


@receiver(post_save, sender=Store)
def create_store_settings(sender, instance, created, **kwargs):
    if created:
        StoreSettings.objects.get_or_create(store=instance)
