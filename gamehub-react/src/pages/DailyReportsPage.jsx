import { Fragment, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { BASE_CURRENCY, formatCurrencyAmount } from '../utils/currency';
import { escapeHtml } from '../utils/helpers';

const inputClass =
  'px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white text-sm';

const usd = (value) => formatCurrencyAmount(value, BASE_CURRENCY);

const varianceClass = (value) => {
  if (value === null || value === undefined) return 'text-gray-400';
  const amount = Number(value);
  if (amount === 0) return 'text-emerald-500';
  return amount < 0 ? 'text-red-500' : 'text-amber-500';
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const DailyReportsPage = () => {
  const { currencySettings, language, showAlert, t } = useApp();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const localCode = currencySettings?.local_currency_code || 'LOCAL';
  const local = (value) => formatCurrencyAmount(value, localCode);
  const rangeParams = useCallback(
    () => ({ ...(start && { start }), ...(end && { end }) }),
    [start, end],
  );

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/daily-reports/', { params: rangeParams() })
      .then(({ data }) => {
        if (!cancelled) setReports(data.results ?? data);
      })
      .catch(() => {
        if (!cancelled) showAlert(t('reports_load_failed'), { title: t('dialog_error'), variant: 'danger' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // showAlert and t change identity between renders; refetch only for a new range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeParams]);

  const exportExcel = async () => {
    try {
      const { data } = await axios.get('/daily-reports/export/', {
        params: { ...rangeParams(), lang: language },
        responseType: 'blob',
      });
      downloadBlob(data, 'daily-reports.xlsx');
    } catch {
      await showAlert(t('export_failed'), { title: t('dialog_error'), variant: 'danger' });
    }
  };

  // The browser's "Save as PDF" print option renders Arabic correctly.
  const exportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert(t('export_failed'), { title: t('dialog_error'), variant: 'danger' });
      return;
    }
    const headers = [
      t('report_date'), t('total_revenue'), t('inventory_cost'), t('net_profit'),
      t('expected_cash'), t('counted_cash'), t('cash_difference'), t('closed_by'),
    ];
    const rows = reports.map((report) => [
      report.date,
      usd(report.total_revenue),
      usd(report.total_cost),
      usd(report.net_profit),
      usd(report.actual_usd_received),
      report.counted_usd === null ? '—' : usd(report.counted_usd),
      report.usd_variance === null ? '—' : usd(report.usd_variance),
      report.closed_by || '—',
    ]);
    const cells = (values, tag) =>
      values.map((value) => `<${tag}>${escapeHtml(String(value))}</${tag}>`).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<title>${escapeHtml(t('daily_reports_title'))}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 6px; text-align: start; }
  th { background: #eee; }
</style></head><body>
<h2>${escapeHtml(t('daily_reports_title'))}</h2>
<table><thead><tr>${cells(headers, 'th')}</tr></thead>
<tbody>${rows.map((row) => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const DetailItem = ({ label, value }) => (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{label}</div>
      <div className="font-bold dark:text-gray-200 text-gray-800">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
          <i className="fas fa-file-lines text-indigo-500" />
          {t('daily_reports_title')}
        </h2>
        <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">{t('daily_reports_subtitle')}</p>
      </div>

      <div className="rounded-xl p-3 sm:p-4 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('report_from')}</span>
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('report_to')}</span>
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} />
        </label>
        <div className="flex gap-2 ms-auto">
          <button
            type="button"
            onClick={exportExcel}
            disabled={reports.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50"
          >
            <i className="fas fa-file-excel me-2" />
            {t('export_excel')}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={reports.length === 0}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition disabled:opacity-50"
          >
            <i className="fas fa-file-pdf me-2" />
            {t('export_pdf')}
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-xl dark:bg-gray-800/70 bg-white/90">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="dark:bg-gray-900/80 bg-gray-100 dark:text-gray-300 text-gray-700">
              <tr>
                {['report_date', 'total_revenue', 'inventory_cost', 'net_profit', 'expected_cash', 'counted_cash', 'cash_difference', 'closed_by'].map((key) => (
                  <th key={key} className="px-4 py-3 text-start">{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && reports.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-8 dark:text-gray-400 text-gray-500">{t('no_reports')}</td>
                </tr>
              )}
              {reports.map((report) => (
                <Fragment key={report.id}>
                  <tr
                    onClick={() => setExpandedId((current) => (current === report.id ? null : report.id))}
                    className="cursor-pointer border-b dark:border-gray-700 border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <td className="px-4 py-2 font-mono text-xs dark:text-gray-300">{report.date}</td>
                    <td className="px-4 py-2 font-bold dark:text-white text-gray-800">{usd(report.total_revenue)}</td>
                    <td className="px-4 py-2 dark:text-gray-300">{usd(report.total_cost)}</td>
                    <td className="px-4 py-2 font-bold text-emerald-500">{usd(report.net_profit)}</td>
                    <td className="px-4 py-2 dark:text-gray-300">{usd(report.actual_usd_received)}</td>
                    <td className="px-4 py-2 dark:text-gray-300">
                      {report.counted_usd === null ? t('not_counted') : usd(report.counted_usd)}
                    </td>
                    <td className={`px-4 py-2 font-bold ${varianceClass(report.usd_variance)}`}>
                      {report.usd_variance === null ? '—' : usd(report.usd_variance)}
                    </td>
                    <td className="px-4 py-2 dark:text-gray-300">{report.closed_by || '—'}</td>
                  </tr>
                  {expandedId === report.id && (
                    <tr className="border-b dark:border-gray-700 border-gray-200 bg-gray-50 dark:bg-gray-900/40">
                      <td colSpan="8" className="px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <DetailItem label={t('revenue_sessions')} value={usd(report.revenue_sessions)} />
                          <DetailItem label={t('revenue_sales')} value={usd(report.revenue_standalone)} />
                          <DetailItem label={`${t('expected_cash')} (${localCode})`} value={local(report.actual_local_received)} />
                          <DetailItem
                            label={`${t('counted_cash')} (${localCode})`}
                            value={report.counted_local === null ? t('not_counted') : local(report.counted_local)}
                          />
                          <DetailItem label={t('running_at_close')} value={report.active_sessions_at_close} />
                          <DetailItem
                            label={t('report_updates')}
                            value={report.metadata?.revisions?.length || 0}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyReportsPage;
