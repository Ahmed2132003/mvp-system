# core/pagination.py
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    page_size = 20                    # عدد العناصر في الصفحة افتراضيًا
    page_size_query_param = 'page_size'   # يسمح للكلاينت يغيّر الحجم: ?page_size=50
    max_page_size = 100               # الحد الأقصى (أمان)

    def get_paginated_response(self, data):
        return Response({
            "links": {
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
            },
            "count": self.page.paginator.count,           # إجمالي العناصر
            "total_pages": self.page.paginator.num_pages, # عدد الصفحات
            "current_page": self.page.number,             # الصفحة الحالية
            "page_size": self.page_size,                  # حجم الصفحة الحالي
            "results": data                               # البيانات
        })