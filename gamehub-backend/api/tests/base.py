from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from api.models import User, StaffPermission


class BaseAPITestCase(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", password="password", role=User.ROLE_OWNER
        )
        self.staff = User.objects.create_user(
            username="staff", password="password", role=User.ROLE_STAFF
        )

        self.owner_token = Token.objects.create(user=self.owner)
        self.staff_token = Token.objects.create(user=self.staff)

        # Create a default empty StaffPermission for the staff user
        StaffPermission.objects.create(user=self.staff)

    def authenticate(self, user_role):
        if user_role == "owner":
            self.client.credentials(HTTP_AUTHORIZATION="Token " + self.owner_token.key)
        elif user_role == "staff":
            self.client.credentials(HTTP_AUTHORIZATION="Token " + self.staff_token.key)
        else:
            self.client.credentials()

    def grant_staff_permission(self, **permissions):
        """Helper to grant specific permissions to the staff user in a test."""
        perms = self.staff.staff_permissions
        for perm, value in permissions.items():
            setattr(perms, perm, value)
        perms.save()

