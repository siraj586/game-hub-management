"""Create, validate and restore copies of the SQLite database."""
import logging
import re
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.db import connection
from django.utils import timezone

logger = logging.getLogger(__name__)

KIND_AUTO = "auto"
KIND_MANUAL = "manual"
KIND_PRE_RESTORE = "pre-restore"

_NAME_PATTERN = re.compile(r"^gamehub-(\d{8}-\d{6})-(auto|manual|pre-restore)\.sqlite3$")
_REQUIRED_TABLES = {"api_session", "api_sale", "api_user", "api_dailyreport"}
_CHECK_INTERVAL_SECONDS = 600

_check_lock = threading.Lock()
_last_check = None


class BackupError(Exception):
    pass


def backup_dir():
    path = Path(settings.BACKUP_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def resolve_backup(name):
    """Map a client-supplied name to a file; the pattern rejects path traversal."""
    if not _NAME_PATTERN.match(name or ""):
        raise BackupError("Invalid backup name.")
    path = backup_dir() / name
    if not path.is_file():
        raise BackupError("Backup not found.")
    return path


def list_backups():
    backups = []
    for path in backup_dir().iterdir():
        match = _NAME_PATTERN.match(path.name)
        if not match or not path.is_file():
            continue
        created = datetime.strptime(match.group(1), "%Y%m%d-%H%M%S")
        backups.append(
            {
                "name": path.name,
                "kind": match.group(2),
                "size": path.stat().st_size,
                "created_at": timezone.make_aware(created).isoformat(),
            }
        )
    return sorted(backups, key=lambda item: item["created_at"], reverse=True)


def create_backup(kind=KIND_MANUAL):
    stamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
    target = backup_dir() / f"gamehub-{stamp}-{kind}.sqlite3"
    temp = target.with_suffix(".tmp")
    connection.ensure_connection()
    try:
        destination = sqlite3.connect(temp)
        try:
            connection.connection.backup(destination)
        finally:
            destination.close()
        temp.replace(target)
    finally:
        temp.unlink(missing_ok=True)
    return target


def validate_backup(path):
    try:
        source = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
        try:
            tables = {
                row[0]
                for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            integrity = source.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            source.close()
    except sqlite3.DatabaseError as exc:
        raise BackupError("This file is not a valid database.") from exc
    if integrity != "ok":
        raise BackupError("This backup is damaged.")
    if not _REQUIRED_TABLES <= tables:
        raise BackupError("This file is not a GameHub backup.")


def restore_backup(name):
    """Replace the live database, first saving a copy of its current state."""
    path = resolve_backup(name)
    validate_backup(path)
    safety_copy = create_backup(KIND_PRE_RESTORE)
    connection.ensure_connection()
    source = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    try:
        source.backup(connection.connection)
    except sqlite3.OperationalError as exc:
        raise BackupError("The database is busy. Please try again.") from exc
    finally:
        source.close()
    # An older backup may predate the current schema.
    call_command("migrate", interactive=False, verbosity=0)
    return safety_copy


def prune_auto_backups():
    autos = [item for item in list_backups() if item["kind"] == KIND_AUTO]
    for item in autos[settings.AUTO_BACKUP_KEEP:]:
        (backup_dir() / item["name"]).unlink(missing_ok=True)


def run_daily_backup_if_due():
    """Make one automatic backup per calendar day, checking at most every 10 minutes."""
    global _last_check
    if not _check_lock.acquire(blocking=False):
        return
    try:
        current = time.monotonic()
        if _last_check is not None and current - _last_check < _CHECK_INTERVAL_SECONDS:
            return
        _last_check = current
        today = timezone.localdate().isoformat()
        already_done = any(
            item["kind"] == KIND_AUTO and item["created_at"].startswith(today)
            for item in list_backups()
        )
        if not already_done:
            create_backup(KIND_AUTO)
            prune_auto_backups()
    except Exception:
        # A failed backup must never break the request that triggered it.
        logger.exception("Automatic database backup failed")
    finally:
        _check_lock.release()
