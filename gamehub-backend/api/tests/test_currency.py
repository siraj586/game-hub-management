from decimal import Decimal

from rest_framework import status

from api.currency import convert_money, local_to_usd, usd_to_local
from api.models import CurrencySettings
from .base import BaseAPITestCase


class CurrencySettingsTests(BaseAPITestCase):
    url = "/api/currency-settings/"

    def test_owner_can_update_exchange_rate(self):
        self.authenticate("owner")
        response = self.client.patch(
            self.url,
            {
                "local_currency_enabled": True,
                "local_currency_code": "SYP",
                "local_currency_name": "Syrian Pound",
                "local_units_per_usd": "13800",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        settings = CurrencySettings.get_solo()
        self.assertTrue(settings.local_currency_enabled)
        self.assertEqual(settings.local_currency_code, "SYP")
        self.assertEqual(settings.local_units_per_usd, Decimal("13800.000000"))

    def test_staff_cannot_update_exchange_rate(self):
        self.authenticate("staff")
        response = self.client.patch(
            self.url,
            {"local_currency_enabled": True, "local_units_per_usd": "13800"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_zero_or_negative_exchange_rate_is_rejected(self):
        self.authenticate("owner")
        for rate in ["0", "-1"]:
            response = self.client.patch(
                self.url,
                {
                    "local_currency_enabled": True,
                    "local_currency_code": "SYP",
                    "local_currency_name": "Syrian Pound",
                    "local_units_per_usd": rate,
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_conversion_helpers_use_decimal_manual_rate(self):
        settings = CurrencySettings.get_solo()
        settings.local_currency_enabled = True
        settings.local_currency_code = "SYP"
        settings.local_currency_name = "Syrian Pound"
        settings.local_units_per_usd = Decimal("13800")
        settings.save()

        self.assertEqual(local_to_usd(Decimal("27600"), settings), Decimal("2.00"))
        self.assertEqual(usd_to_local(Decimal("2"), settings), Decimal("27600.00"))
        self.assertEqual(
            convert_money(Decimal("27600"), "SYP", "USD", settings),
            Decimal("2.00"),
        )

    def test_staff_can_use_conversion_calculator(self):
        settings = CurrencySettings.get_solo()
        settings.local_currency_enabled = True
        settings.local_currency_code = "SYP"
        settings.local_currency_name = "Syrian Pound"
        settings.local_units_per_usd = Decimal("13800")
        settings.save()

        self.authenticate("staff")
        response = self.client.post(
            f"{self.url}convert/",
            {"amount": "27600", "from_currency": "SYP", "to_currency": "USD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data["converted_amount"]), Decimal("2.00"))
