# core/admin.py
# ملف نهائي - يدعم ربط الموظف بستور من الـ admin + صلاحيات Owner/ Superuser
# ✅ متوافق مع QR Attendance الموحد على مستوى Store (Store.qr_attendance)

from django.contrib import admin
from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Q

from branches.models import Branch
from .models import User, Employee, Store, StoreSettings

def is_owner_or_superuser(request):
    """يرجع True فقط لو المستخدم OWNER أو superuser"""
    return (
        request.user.is_authenticated
        and (request.user.is_superuser or getattr(request.user, "role", None) == User.RoleChoices.OWNER)
    )


def get_owner_store_ids(request):
    """يرجع IDs للـ stores اللي الـ OWNER مالكها"""
    if not request.user.is_authenticated:
        return []

    if request.user.is_superuser:
        return list(Store.objects.values_list("id", flat=True))

    if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
        return list(Store.objects.filter(owner=request.user).values_list("id", flat=True))

    return []


# =========================
# Inline: Employee داخل صفحة User
# =========================
class EmployeeInline(admin.StackedInline):
    model = Employee
    extra = 1               # ✅ يسمح بإنشاء Employee لو مش موجود
    max_num = 1
    can_delete = True
    verbose_name = "ملف الموظف"
    verbose_name_plural = "ملف الموظف"

    # ✅ حذف حقول QR attendance القديمة من Employee (لأن QR صار على Store)
    fields = ("store", "hire_date", "salary", "advances")
    readonly_fields = ()

    def has_view_permission(self, request, obj=None):
        return is_owner_or_superuser(request)

    def has_change_permission(self, request, obj=None):
        return is_owner_or_superuser(request)

    def has_add_permission(self, request, obj):
        return is_owner_or_superuser(request)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """
        قصر اختيار الـ store على:
        - superuser: كل الفروع
        - owner: فروعه فقط
        """
        if db_field.name == "store":
            if request.user.is_superuser:
                kwargs["queryset"] = Store.objects.all()
            elif getattr(request.user, "role", None) == User.RoleChoices.OWNER:
                kwargs["queryset"] = Store.objects.filter(owner=request.user)
            else:
                kwargs["queryset"] = Store.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# =========================
# User Admin
# =========================
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "name", "role", "is_active", "is_staff", "date_joined")
    list_filter = ("role", "is_active", "is_staff", "date_joined")
    search_fields = ("email", "name", "phone")
    ordering = ("-date_joined",)
    readonly_fields = ("date_joined", "last_login")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("البيانات الشخصية", {"fields": ("name", "phone", "role")}),
        ("الصلاحيات", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("التواريخ", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "name", "phone", "role", "password1", "password2"),
        }),
    )

    # ✅ ربط Employee باليوزر من نفس الشاشة
    inlines = [EmployeeInline]

    def has_module_permission(self, request):
        return is_owner_or_superuser(request)

    def has_view_permission(self, request, obj=None):
        return is_owner_or_superuser(request)

    def has_add_permission(self, request):
        return is_owner_or_superuser(request)

    def has_change_permission(self, request, obj=None):
        # superuser يقدر يعدل أي حد
        if request.user.is_superuser:
            return True
        # OWNER يقدر يعدل (والفلترة هتحصره في scope بتاعه)
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            return True
        return False

    def get_queryset(self, request):
        """
        OWNER يشوف:
        - نفسه
        - وكل اليوزرز اللي ليهم Employee في Stores بتاعته
        superuser يشوف الكل
        """
        qs = super().get_queryset(request)

        if request.user.is_superuser:
            return qs

        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            store_ids = get_owner_store_ids(request)
            return qs.filter(
                Q(id=request.user.id) | Q(employee__store_id__in=store_ids)
            ).distinct()

        return qs.none()

    # ✅ مهم: ممنوع تعمل Employee تلقائي من غير store لأن store عندك إجباري null=False
    # لذا مفيش save_model auto-create هنا.


# =========================
# Employee Admin
# =========================
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "store", "branch", "hire_date", "salary", "advances")
    list_filter = ("store", "branch", "hire_date")
    search_fields = ("user__email", "user__name", "user__phone")
    raw_id_fields = ("user", "store", "branch")
    
    readonly_fields = ("qr_attendance", "qr_attendance_base64")

    fieldsets = (
        ("الموظف", {"fields": ("user", "store")}),
        ("بيانات العمل", {"fields": ("hire_date", "salary", "advances")}),
        (
            "QR Codes",
            {
                "fields": ("qr_attendance", "qr_attendance_base64"),
                "classes": ("collapse",),
            },
        ),
    )

    def has_module_permission(self, request):
        return is_owner_or_superuser(request)

    def has_view_permission(self, request, obj=None):
        return is_owner_or_superuser(request)

    def has_add_permission(self, request):
        return is_owner_or_superuser(request)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            if obj is None:
                return True
            return obj.store and obj.store.owner == request.user
        return False

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            return qs.filter(store__owner=request.user)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """
        قصر اختيار الـ store في Employee على:
        - superuser: كله
        - owner: فروعه فقط
        """
        if db_field.name == "store":
            if request.user.is_superuser:
                kwargs["queryset"] = Store.objects.all()
            elif getattr(request.user, "role", None) == User.RoleChoices.OWNER:
                kwargs["queryset"] = Store.objects.filter(owner=request.user)
            else:
                kwargs["queryset"] = Store.objects.none()
        elif db_field.name == "branch":
            if request.user.is_superuser:
                kwargs["queryset"] = Branch.objects.all()
            elif getattr(request.user, "role", None) == User.RoleChoices.OWNER:
                kwargs["queryset"] = Branch.objects.filter(store__owner=request.user)
            else:
                kwargs["queryset"] = Branch.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    

# =========================
# Store Admin
# =========================
@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "phone", "created_at", "settings_link", "attendance_qr_preview"]
    list_filter = ["created_at", "owner"]
    search_fields = ["name", "owner__name", "owner__email", "phone"]
    readonly_fields = ["created_at", "updated_at", "qr_menu_preview", "attendance_qr_preview"]

    fieldsets = (
        ("معلومات الفرع", {
            "fields": ("name", "owner", "phone", "address")
        }),
        ("QR Codes", {
            "fields": ("qr_menu", "qr_menu_preview", "qr_attendance", "attendance_qr_preview"),
            "classes": ("collapse",),
        }),
        ("إعدادات الدفع", {
            "fields": ("paymob_keys",),
            "classes": ("collapse",)
        }),
        ("التواريخ", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    def qr_menu_preview(self, obj):
        if obj.qr_menu:
            return format_html('<img src="{}" style="max-height:140px;border:1px solid #ddd;border-radius:6px;" />', obj.qr_menu.url)
        return "لا يوجد"
    qr_menu_preview.short_description = "معاينة QR Menu"

    def attendance_qr_preview(self, obj):
        if getattr(obj, "qr_attendance", None):
            return format_html('<img src="{}" style="max-height:140px;border:1px solid #ddd;border-radius:6px;" />', obj.qr_attendance.url)
        return "لا يوجد"
    attendance_qr_preview.short_description = "معاينة QR Attendance"

    def settings_link(self, obj):
        if hasattr(obj, "settings") and obj.settings:
            url = f"/admin/core/storesettings/{obj.settings.id}/change/"
            return format_html(
                '<a href="{}" class="button button-small" style="background:#417690;color:white;padding:4px 8px;border-radius:4px;">تعديل الإعدادات</a>',
                url
            )
        return "لا توجد إعدادات"
    settings_link.short_description = "الإعدادات"

    def has_module_permission(self, request):
        return is_owner_or_superuser(request)

    def has_view_permission(self, request, obj=None):
        return is_owner_or_superuser(request)

    def has_add_permission(self, request):
        return is_owner_or_superuser(request)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            if obj is None:
                return True
            return obj.owner == request.user
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            return qs.filter(owner=request.user)
        return qs.none()


# =========================
# StoreSettings Admin
# =========================
@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ["store", "loyalty_enabled", "tax_rate", "service_charge", "printer_ip"]
    list_filter = ["loyalty_enabled", "allow_negative_stock", "allow_order_without_stock"]

    fieldsets = (
        ("إعدادات عامة", {
            "fields": (
                "store",
                "loyalty_enabled",
                "allow_negative_stock",
                "allow_order_without_stock",
            )
        }),
        ("الضرائب والمصاريف", {
            "fields": ("tax_rate", "service_charge")
        }),
        ("إعدادات الطابعة", {
            "fields": ("printer_ip", "printer_port")
        }),
        ("إعدادات الحضور", {
            "fields": ("attendance_shift_start", "attendance_grace_minutes", "attendance_penalty_per_15min"),
            "classes": ("collapse",)
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_module_permission(self, request):
        return is_owner_or_superuser(request)

    def has_view_permission(self, request, obj=None):
        return is_owner_or_superuser(request)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            if obj is None:
                return True
            return obj.store and obj.store.owner == request.user
        return False

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if getattr(request.user, "role", None) == User.RoleChoices.OWNER:
            return qs.filter(store__owner=request.user)
        return qs.none()
