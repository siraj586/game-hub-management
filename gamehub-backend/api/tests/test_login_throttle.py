from django.urls import reverse
from rest_framework import status

from api.throttles import LoginRateThrottle

from .base import BaseAPITestCase


class LoginThrottleTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self._original_rate = LoginRateThrottle.THROTTLE_RATES.get("login")
        LoginRateThrottle.THROTTLE_RATES["login"] = "3/min"

    def tearDown(self):
        LoginRateThrottle.THROTTLE_RATES["login"] = self._original_rate
        super().tearDown()

    def test_wrong_password_attempts_are_blocked_after_the_limit(self):
        url = reverse("auth-login")
        payload = {"username": "owner", "password": "wrong"}

        for _ in range(3):
            response = self.client.post(url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_correct_password_is_also_blocked_once_the_limit_is_hit(self):
        url = reverse("auth-login")
        wrong = {"username": "owner", "password": "wrong"}
        for _ in range(3):
            self.client.post(url, wrong, format="json")

        response = self.client.post(
            url, {"username": "owner", "password": "password"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_works_under_the_limit(self):
        response = self.client.post(
            reverse("auth-login"),
            {"username": "owner", "password": "password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)

    def test_other_endpoints_are_not_throttled(self):
        self.authenticate("owner")
        for _ in range(6):
            response = self.client.get(reverse("auth-me"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
