# backend/inventory/models.py
from django.db import models
from django.db.models import DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce

class Category(models.Model):
    name = models.CharField(max_length=100)
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='categories')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        unique_together = ('store', 'name')
        
class Item(models.Model):
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="سعر الوحدة بالجنيه")
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="تكلفة الوحدة")
    barcode = models.CharField(max_length=50, blank=True, null=True, unique=True)
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='items')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        unique_together = ('store', 'name')

class InventoryQuerySet(models.QuerySet):
    def low_stock(self):
        return self.filter(is_low=True)

    def out_of_stock(self):
        return self.filter(quantity=0)

    def at_branch(self, branch):
        return self.filter(branch=branch)

    def for_store(self, store):
        return self.filter(branch__store=store)

    def needs_reorder(self):
        return self.filter(quantity__lte=models.F('min_stock'))

    def active_items(self):
        return self.filter(item__is_active=True)

    def with_value_totals(self):
        """Annotate inventory rows with aggregated quantity and values per item."""
        cost_expr = F('quantity') * Coalesce(
            F('item__cost_price'),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
        sale_expr = F('quantity') * Coalesce(
            F('item__unit_price'),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )

        return (
            self.values('item_id', 'item__name', 'item__category_id', 'item__category__name')
            .annotate(
                total_quantity=Coalesce(Sum('quantity'), Value(0)),
                total_cost_value=Coalesce(
                    Sum(cost_expr),
                    Value(0),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                total_sale_value=Coalesce(
                    Sum(sale_expr),
                    Value(0),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
            )
        )

class InventoryManager(models.Manager):
    def get_queryset(self):
        return InventoryQuerySet(self.model, using=self._db)

    def low_stock(self, *args, **kwargs):
        return self.get_queryset().low_stock(*args, **kwargs)

    def out_of_stock(self, *args, **kwargs):
        return self.get_queryset().out_of_stock(*args, **kwargs)

    def for_store(self, *args, **kwargs):
        return self.get_queryset().for_store(*args, **kwargs)

    def needs_reorder(self, *args, **kwargs):
        return self.get_queryset().needs_reorder(*args, **kwargs)

    def with_value_totals(self, *args, **kwargs):
        return self.get_queryset().with_value_totals(*args, **kwargs)
            
class Inventory(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='inventory_entries')
    branch = models.ForeignKey('branches.Branch', on_delete=models.CASCADE, related_name='inventory')
    quantity = models.PositiveIntegerField(default=0)
    min_stock = models.PositiveIntegerField(default=0, help_text="الحد الأدنى للمخزون")
    last_updated = models.DateTimeField(auto_now=True)
    is_low = models.BooleanField(default=False, editable=False)
    objects = InventoryManager()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)  # نحفظ الأول (حتى لو quantity جاي من F)

        # نجيب القيمة الحقيقية من الداتابيز
        self.refresh_from_db(fields=['quantity', 'min_stock'])

        # نحدّث is_low بناءً على القيم الحقيقية
        new_is_low = self.quantity <= self.min_stock
        if self.is_low != new_is_low:
            self.is_low = new_is_low
            super().save(update_fields=['is_low'])

    def __str__(self):
        return f"{self.item.name} @ {self.branch.name}: {self.quantity}"

    class Meta:
        unique_together = ('item', 'branch')
        verbose_name_plural = "Inventory"
class InventoryMovement(models.Model):
    class MovementType(models.TextChoices):
        IN = 'IN', 'إضافة'
        OUT = 'OUT', 'خصم'

    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.CASCADE,
        related_name='movements'
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='inventory_movements'
    )
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.CASCADE,
        related_name='inventory_movements'
    )
    change = models.IntegerField(help_text="الكمية المضافة (+) أو المخصومة (-)")
    movement_type = models.CharField(max_length=3, choices=MovementType.choices)
    reason = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(
        'core.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_movements'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        sign = '+' if self.change >= 0 else ''
        return f"{self.item.name} ({self.branch.name}) {sign}{self.change}"

    class Meta:
        ordering = ['-created_at']
        verbose_name = "حركة مخزون"
        verbose_name_plural = "حركات المخزون"
