from django.db import migrations


def backfill_unknown_legacy_rows(apps, schema_editor):
    """
    Phase 4 backfill: rows that pre-date the mandatory-currency enforcement
    (Phases 1-2) cannot be trusted for cash-position reporting.

    Rules agreed with product:
      - exchange_rate stays NULL  (0 would break division and look like a real rate)
      - payment_currency / original_payment_currency → "UNKNOWN"
        (not "USD", not blank — so analytics can exclude them from both buckets)
      - Session.metadata["exchange_rate_note"] = "unknown_rate_legacy"
        (the only durable flag we can attach to sessions; Sale has no metadata field)

    Identification logic:
      Sale      — exchange_rate IS NULL  (field added in 0010; NULL = pre-Phase-2)
      Session   — end_time IS NOT NULL AND exchange_rate IS NULL
                  (active sessions always have NULL; only completed ones are legacy)
    """
    Sale = apps.get_model('api', 'Sale')
    Session = apps.get_model('api', 'Session')

    # --- Sale -----------------------------------------------------------------
    # All sales created before migration 0010 (or where paymentCurrency was
    # never sent) have exchange_rate=NULL. We can't prove any of them were USD.
    Sale.objects.filter(exchange_rate__isnull=True).update(payment_currency='UNKNOWN')

    # --- Session (completed only) --------------------------------------------
    # Active sessions legitimately have exchange_rate=NULL (set at checkout).
    # Only completed sessions with NULL are legacy.
    legacy_sessions = Session.objects.filter(
        end_time__isnull=False,
        exchange_rate__isnull=True,
    )
    for session in legacy_sessions.only('id', 'metadata', 'original_payment_currency'):
        meta = dict(session.metadata or {})
        meta['exchange_rate_note'] = 'unknown_rate_legacy'
        session.metadata = meta
        session.original_payment_currency = 'UNKNOWN'
        session.save(update_fields=['metadata', 'original_payment_currency'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_sale_payment_currency_required'),
    ]

    operations = [
        migrations.RunPython(
            backfill_unknown_legacy_rows,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
