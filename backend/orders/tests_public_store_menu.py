from django.test import TestCase
from rest_framework.test import APIClient

from branches.models import Branch
from core.models import Store
from inventory.models import Item


class PublicStoreMenuViewTests(TestCase):
    def setUp(self):
        self.store = Store.objects.create(
            name="Test Store",
            qr_menu="dummy.png",
            qr_attendance="dummy_attendance.png",
        )
        self.branch = Branch.objects.create(name="Main Branch", store=self.store)
        Item.objects.create(name="Latte", unit_price=25, store=self.store)

        self.client = APIClient()

    def test_returns_branches_and_branch_selection_with_branch_alias(self):
        url = f"/api/v1/orders/public/store/{self.store.id}/menu/?branch={self.branch.id}"
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertIn("branches", response.data)
        self.assertEqual(len(response.data["branches"]), 1)
        self.assertEqual(response.data["branches"][0]["id"], self.branch.id)
        self.assertEqual(response.data["branch"]["id"], self.branch.id)
        self.assertEqual(response.data["branch"]["name"], self.branch.name)
        self.assertTrue(response.data["items"])