# reports/tests/test_reports.py
import pytest  # ← أضفنا


@pytest.mark.django_db
class TestReports:
    def test_placeholder(self):
        # هنكملها لما نعمل الـ reports
        assert True