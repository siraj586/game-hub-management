import { useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { BASE_CURRENCY, formatCurrencyAmount } from '../utils/currency';

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white text-sm';

const differenceColor = (difference) => {
  if (difference === 0) return 'text-emerald-500';
  return difference < 0 ? 'text-red-500' : 'text-amber-500';
};

const CashRow = ({ currency, expected, value, onChange, t }) => {
  const difference = value === '' ? null : Number(value) - Number(expected);
  return (
    <div className="grid grid-cols-3 gap-3 items-end">
      <div>
        <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
          {t('expected_cash')} ({currency})
        </div>
        <div className="py-2 font-black dark:text-white text-gray-800">
          {formatCurrencyAmount(expected, currency)}
        </div>
      </div>
      <label className="block">
        <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
          {t('counted_cash')}
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      </label>
      <div>
        <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
          {t('cash_difference')}
        </div>
        <div className={`py-2 font-black ${difference === null ? 'text-gray-400' : differenceColor(difference)}`}>
          {difference === null ? '—' : formatCurrencyAmount(difference, currency)}
        </div>
      </div>
    </div>
  );
};

const HarvestDayModal = ({ date, localCurrency, onClose, onDone, onAlreadyClosed }) => {
  const { t } = useApp();
  const [preview, setPreview] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [countedUsd, setCountedUsd] = useState('');
  const [countedLocal, setCountedLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/daily-reports/preview/', { params: { date } })
      .then(({ data }) => {
        if (cancelled) return;
        setPreview(data);
        setCountedUsd(data.counted_usd ?? '');
        setCountedLocal(data.counted_local ?? '');
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const { data } = await axios.post('/daily-reports/close_day/', {
        date,
        counted_usd: countedUsd === '' ? null : countedUsd,
        counted_local: countedLocal === '' ? null : countedLocal,
      });
      await onDone(data);
    } catch (error) {
      if (error?.response?.status === 409) {
        await onAlreadyClosed(error.response.data?.detail);
      } else {
        setSubmitError(true);
        setSubmitting(false);
      }
    }
  };

  const running = preview?.running_sessions || [];
  const showLocal = Boolean(localCurrency) || Number(preview?.actual_local_received) > 0;
  const nothingNew = preview?.already_closed && !preview?.has_changes;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl"
      >
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-black dark:text-white text-gray-900 flex items-center gap-2">
              <i className="fas fa-calendar-check text-emerald-500" />
              {t('harvest_day')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{date}</p>
          </div>

          {loadFailed && <p className="text-sm text-red-500">{t('failed_close_day')}</p>}
          {!preview && !loadFailed && <i className="fas fa-spinner fa-spin text-gray-400" />}

          {preview && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800">
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{t('total_revenue')}</div>
                  <div className="font-black dark:text-white text-gray-800">
                    {formatCurrencyAmount(preview.total_revenue, BASE_CURRENCY)}
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800">
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{t('net_profit')}</div>
                  <div className="font-black text-emerald-500">
                    {formatCurrencyAmount(preview.net_profit, BASE_CURRENCY)}
                  </div>
                </div>
              </div>

              {running.length > 0 && (
                <div className="rounded-xl p-3 border border-amber-500/40 bg-amber-500/10 text-sm text-amber-700 dark:text-amber-300">
                  <div className="font-bold">
                    <i className="fas fa-triangle-exclamation me-2" />
                    {t('running_sessions_warning').replace('{count}', running.length)}
                  </div>
                  <ul className="mt-1 text-xs">
                    {running.map((session) => (
                      <li key={session.id}>
                        {session.name} · {session.stationId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.has_changes && (
                <p className="rounded-xl p-3 bg-sky-500/10 text-sm text-sky-700 dark:text-sky-300">
                  {t('harvest_has_changes')}
                </p>
              )}
              {nothingNew && (
                <p className="rounded-xl p-3 bg-gray-100 dark:bg-gray-800 text-sm dark:text-gray-300 text-gray-600">
                  {t('harvest_already_closed')}
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-black dark:text-white text-gray-800">{t('cash_count')}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('cash_count_hint')}</p>
                </div>
                <CashRow
                  currency={BASE_CURRENCY}
                  expected={preview.actual_usd_received}
                  value={countedUsd}
                  onChange={setCountedUsd}
                  t={t}
                />
                {showLocal && (
                  <CashRow
                    currency={localCurrency || 'LOCAL'}
                    expected={preview.actual_local_received}
                    value={countedLocal}
                    onChange={setCountedLocal}
                    t={t}
                  />
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">{t('harvest_clears_activity')}</p>
              {submitError && <p className="text-sm text-red-500">{t('failed_close_day')}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-950/70 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold dark:text-gray-200 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            {t('dialog_cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!preview || submitting}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black transition disabled:opacity-60"
          >
            {submitting ? t('harvesting') : preview?.already_closed ? t('harvest_update') : t('harvest_day')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HarvestDayModal;
