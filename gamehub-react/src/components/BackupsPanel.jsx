import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const errorText = (error, fallback) => error?.response?.data?.error || fallback;

const BusinessDayCard = () => {
  const { showAlert, t } = useApp();
  const [startHour, setStartHour] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/business-day-settings/')
      .then(({ data }) => {
        if (!cancelled) setStartHour(data.start_hour);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch('/business-day-settings/', { start_hour: startHour });
      await showAlert(t('business_day_saved'));
    } catch (error) {
      await showAlert(errorText(error, t('dialog_error')), { title: t('dialog_error'), variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
      <div>
        <h3 className="font-extrabold text-gray-800 dark:text-white text-base">{t('business_day_title')}</h3>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t('business_day_hint')}</p>
      </div>
      <div className="flex items-end gap-3">
        <label className="block">
          <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            {t('business_day_start')}
          </span>
          <select
            value={startHour ?? ''}
            disabled={startHour === null}
            onChange={(event) => setStartHour(Number(event.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white text-sm"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving || startHour === null}
          className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition disabled:opacity-60"
        >
          {t('save_changes')}
        </button>
      </div>
    </div>
  );
};

const BackupsPanel = () => {
  const { showAlert, showConfirm, t } = useApp();
  const [backups, setBackups] = useState([]);
  const [directory, setDirectory] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await axios.get('/backups/');
    setBackups(data.backups);
    setDirectory(data.directory);
  }, []);

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/backups/')
      .then(({ data }) => {
        if (cancelled) return;
        setBackups(data.backups);
        setDirectory(data.directory);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const showFailure = (error, fallback) =>
    showAlert(errorText(error, fallback), { title: t('dialog_error'), variant: 'danger' });

  const createBackup = async () => {
    setBusy(true);
    try {
      await axios.post('/backups/');
      await load();
    } catch (error) {
      await showFailure(error, t('backup_failed'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (name) => {
    try {
      const { data } = await axios.get(`/backups/${name}/download/`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      await showFailure(error, t('backup_failed'));
    }
  };

  const restore = async (backup) => {
    const confirmed = await showConfirm({
      title: t('backup_restore'),
      message: t('confirm_restore').replace('{date}', new Date(backup.created_at).toLocaleString()),
      confirmText: t('backup_restore'),
      variant: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await axios.post(`/backups/${backup.name}/restore/`);
      window.location.reload();
    } catch (error) {
      setBusy(false);
      await showFailure(error, t('restore_failed'));
    }
  };

  return (
    <div className="space-y-5">
      <BusinessDayCard />

      <div className="rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-extrabold text-gray-800 dark:text-white text-base">{t('backups_title')}</h3>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t('backups_hint')}</p>
            {directory && (
              <p className="text-[11px] font-mono text-gray-400 mt-1 break-all" dir="ltr">{directory}</p>
            )}
          </div>
          <button
            type="button"
            onClick={createBackup}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition disabled:opacity-60"
          >
            <i className="fas fa-database me-2" />
            {t('backup_now')}
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_backups')}</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {backups.map((backup) => (
              <li key={backup.name} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-bold dark:text-gray-200 text-gray-800">
                    {new Date(backup.created_at).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t(`backup_kind_${backup.kind}`)} · {(backup.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => download(backup.name)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold dark:text-gray-200 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <i className="fas fa-download me-1" />
                    {t('backup_download')}
                  </button>
                  <button
                    type="button"
                    onClick={() => restore(backup)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg border border-red-500/50 text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white transition disabled:opacity-60"
                  >
                    <i className="fas fa-rotate-left me-1" />
                    {t('backup_restore')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BackupsPanel;
