# backend/branches/models.py
from django.db import models

class Branch(models.Model):
    name = models.CharField(max_length=255)  # اسم الفرع
    store = models.ForeignKey('core.Store', on_delete=models.CASCADE, related_name='branches')
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.store.name} - {self.name}"

    class Meta:
        unique_together = ('store', 'name')