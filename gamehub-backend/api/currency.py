from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.core.exceptions import ValidationError

from api.models import CurrencySettings


BASE_CURRENCY = CurrencySettings.BASE_CURRENCY_CODE
MONEY_QUANT = Decimal("0.01")


def round_money(amount):
    return Decimal(str(amount)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def get_currency_settings():
    return CurrencySettings.get_solo()


def _normalize_currency(currency_code):
    return (currency_code or BASE_CURRENCY).strip().upper()


def _require_enabled_local(settings):
    if not settings.local_currency_enabled:
        raise ValidationError("Local currency is not enabled.")
    if not settings.local_currency_code or not settings.local_units_per_usd:
        raise ValidationError("Local currency exchange rate is not configured.")
    if settings.local_units_per_usd <= 0:
        raise ValidationError("Local currency exchange rate must be greater than 0.")


def usd_to_local(usd_amount, settings=None):
    settings = settings or get_currency_settings()
    _require_enabled_local(settings)
    return round_money(Decimal(str(usd_amount)) * settings.local_units_per_usd)


def local_to_usd(local_amount, settings=None):
    settings = settings or get_currency_settings()
    _require_enabled_local(settings)
    return round_money(Decimal(str(local_amount)) / settings.local_units_per_usd)


def frozen_rate_for_currency(payment_currency, settings=None):
    """
    Return the exchange rate to freeze on a transaction.
    Always returns a Decimal — never None.
      USD (or any unknown currency)  → Decimal("1")
      configured local currency      → settings.local_units_per_usd
    """
    settings = settings or get_currency_settings()
    code = _normalize_currency(payment_currency)
    if code == BASE_CURRENCY:
        return Decimal("1")
    local_code = _normalize_currency(settings.local_currency_code or "")
    if local_code and code == local_code and settings.local_units_per_usd:
        return Decimal(str(settings.local_units_per_usd))
    return Decimal("1")


def convert_money(amount, from_currency, to_currency, settings=None):
    settings = settings or get_currency_settings()
    from_code = _normalize_currency(from_currency)
    to_code = _normalize_currency(to_currency)

    try:
        decimal_amount = Decimal(str(amount))
    except (InvalidOperation, ValueError):
        raise ValidationError("Amount must be a valid decimal value.")

    if from_code == to_code:
        return round_money(decimal_amount)

    local_code = _normalize_currency(settings.local_currency_code)
    if from_code == BASE_CURRENCY and to_code == local_code:
        return usd_to_local(decimal_amount, settings)
    if from_code == local_code and to_code == BASE_CURRENCY:
        return local_to_usd(decimal_amount, settings)

    raise ValidationError("Unsupported currency conversion.")
