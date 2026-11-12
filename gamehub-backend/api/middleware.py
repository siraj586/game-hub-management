from django.conf import settings

from api.backups import run_daily_backup_if_due


class DailyBackupMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if settings.AUTO_BACKUP_ENABLED:
            run_daily_backup_if_due()
        return response
