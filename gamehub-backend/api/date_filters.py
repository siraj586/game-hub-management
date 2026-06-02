from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError


def get_date_range_from_request(request):
    today = timezone.localdate()
    period = (request.query_params.get("period") or "today").strip().lower()

    if period == "today":
        return today, today
    if period == "yesterday":
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, today
    if period == "this_month":
        return today.replace(day=1), today
    if period == "custom":
        start_raw = request.query_params.get("start") or request.query_params.get("date_from")
        end_raw = request.query_params.get("end") or request.query_params.get("date_to")
        start = parse_date(start_raw or "")
        end = parse_date(end_raw or "")
        if not start or not end:
            raise ValidationError({"date_range": "Custom range requires valid start and end dates."})
        if start > end:
            raise ValidationError({"date_range": "Start date must be before or equal to end date."})
        return start, end

    raise ValidationError({"period": "Use today, yesterday, this_week, this_month, or custom."})
