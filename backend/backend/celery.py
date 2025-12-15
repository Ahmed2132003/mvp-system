# backend/backend/celery.py
import os
from celery import Celery
from decouple import config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# اختبار سريع
@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')