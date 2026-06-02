from rest_framework import status
from .base import BaseAPITestCase
from api.models import ResourceType, ResourceUnit


class ResourceViewSetTests(BaseAPITestCase):
    rt_url = '/api/resource-types/'
    ru_url = '/api/resource-units/'

    def setUp(self):
        super().setUp()
        self.rt1 = ResourceType.objects.create(name="PC", code="PC_TYPE", prefix="PC", base_price=10.00)
        self.ru1 = ResourceUnit.objects.create(resource_type=self.rt1, code="PC-01")

    def test_list_unauthenticated(self):
        self.assertEqual(self.client.get(self.rt_url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(self.ru_url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_resource_type_staff(self):
        self.authenticate('staff')
        data = {"name": "Console", "code": "CONS", "prefix": "CN"}
        self.assertEqual(self.client.post(self.rt_url, data).status_code, status.HTTP_403_FORBIDDEN)

    def test_create_resource_type_owner(self):
        self.authenticate('owner')
        data = {"name": "Console", "code": "CONS", "prefix": "CN"}
        response = self.client.post(self.rt_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ResourceType.objects.count(), 2)

    def test_create_resource_unit_owner(self):
        self.authenticate('owner')
        data = {
            "resource_type": self.rt1.id,
            "code": "PC-02"
        }
        response = self.client.post(self.ru_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ResourceUnit.objects.count(), 2)

    def test_delete_resource_unit_staff(self):
        self.authenticate('staff')
        response = self.client.delete(f'{self.ru_url}{self.ru1.id}/')
        # Only OWNER can delete
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_resource_unit_owner(self):
        self.authenticate('owner')
        response = self.client.delete(f'{self.ru_url}{self.ru1.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_owner_can_stop_and_activate_resource_unit(self):
        self.authenticate('owner')

        stop_response = self.client.post(f'{self.ru_url}{self.ru1.id}/stop/')
        self.ru1.refresh_from_db()
        self.assertEqual(stop_response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.ru1.status, ResourceUnit.STATUS_STOPPED)
        self.assertTrue(stop_response.data["is_stopped"])

        activate_response = self.client.post(f'{self.ru_url}{self.ru1.id}/activate/')
        self.ru1.refresh_from_db()
        self.assertEqual(activate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.ru1.status, ResourceUnit.STATUS_ACTIVE)
        self.assertFalse(activate_response.data["is_stopped"])
