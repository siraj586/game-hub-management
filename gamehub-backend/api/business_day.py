"""The business day: late-night sessions belong to the day they started in.

With a start hour of 4, a session ending at 01:30 counts for the previous date.
"""
from datetime import datetime, time, timedelta

from django.utils import timezone

from api.models.core_model import BusinessDaySettings


def get_start_hour():
    return BusinessDaySettings.get_solo().start_hour


def business_date_of(value, start_hour=None):
    hour = get_start_hour() if start_hour is None else start_hour
    return (timezone.localtime(value) - timedelta(hours=hour)).date()


def business_today(start_hour=None):
    return business_date_of(timezone.now(), start_hour)


def day_bounds(first_day, last_day=None, start_hour=None):
    """Return the [start, end) datetimes covering first_day through last_day."""
    hour = get_start_hour() if start_hour is None else start_hour
    last_day = last_day or first_day
    start = datetime.combine(first_day, time(hour))
    end = datetime.combine(last_day + timedelta(days=1), time(hour))
    return timezone.make_aware(start), timezone.make_aware(end)
