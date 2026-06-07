import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../utils/helpers';
import { hasPermission } from '../utils/permissions';
import axios from 'axios';

const DailyReportModal = ({ isOpen, onClose }) => {
  const { analytics, sessions, cafeItems, monthlyExpenses, permissions, showConfirm, showAlert, checkAutoEnd, fetchData, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [closedReport, setClosedReport] = useState(null);
  const [closeError, setCloseError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  if (!isOpen) return null;
  const canCloseShift = hasPermission(permissions, 'can_close_shift');

  const todayStr = new Date(`${selectedDate}T00:00:00`).toDateString();
  const todaysSessions = sessions.filter(s => s.endTime && new Date(s.endTime).toISOString().slice(0, 10) === selectedDate);
  const totalPlayEarnings = todaysSessions.reduce((sum, s) => sum + ((s.finalTotal ?? s.totalCost) - (s.ordersCost || 0)), 0);
  const totalCafeEarnings = todaysSessions.reduce((sum, s) => sum + (s.ordersCost || 0), 0);

  const handleCloseDay = async () => {
    const confirmed = await showConfirm({
      title: t('harvest_day'),
      message: t('confirm_close_day'),
      confirmText: t('harvest_day'),
      variant: 'danger',
    });
    if (!confirmed) return;
    // collect today's data
    const todays = sessions.filter(s => s.endTime && new Date(s.endTime).toISOString().slice(0, 10) === selectedDate);
    if (!todays || todays.length === 0) {
      if (showAlert) await showAlert(t('no_completed_today'));
      return;
    }

    const todaysOrders = todays.flatMap(s => (s.orders || []).map(o => ({ sessionId: s.id, ...o })));
    const totalPlay = todays.reduce((sum, s) => sum + ((s.finalTotal ?? s.totalCost) - (s.ordersCost || 0)), 0);
    const totalCafe = todays.reduce((sum, s) => sum + (s.ordersCost || 0), 0);
    // Fetch extra system data to include in the daily report
    let standaloneSales = [];
    let payments = [];
    let todaysAuditLogs = [];
    try {
      const salesRes = await axios.get('/sales/', { params: { page_size: 200 } }).catch(() => null);
      if (salesRes && salesRes.data) standaloneSales = Array.isArray(salesRes.data) ? salesRes.data : (Array.isArray(salesRes.data.results) ? salesRes.data.results : []);
    } catch {
      standaloneSales = [];
    }
    try {
      const payRes = await axios.get('/payments/', { params: { page_size: 200 } }).catch(() => null);
      if (payRes && payRes.data) payments = Array.isArray(payRes.data) ? payRes.data : (Array.isArray(payRes.data.results) ? payRes.data.results : []);
    } catch {
      payments = [];
    }
    try {
      // Use context audit logs as a fallback; fetch fresh list too
      const auditRes = await axios.get('/audit-logs/', { params: { page_size: 200 } }).catch(() => null);
      const allLogs = auditRes && auditRes.data ? (Array.isArray(auditRes.data) ? auditRes.data : (Array.isArray(auditRes.data.results) ? auditRes.data.results : [])) : (analytics && analytics.auditLogs ? analytics.auditLogs : []);
      todaysAuditLogs = allLogs.filter(l => {
        const d = new Date(l.created_at || l.created || l.timestamp || l.time || l.date || l.createdAt || null);
        return d && new Date(d).toISOString().slice(0,10) === selectedDate;
      });
    } catch {
      todaysAuditLogs = [];
    }
    const reportData = {
      date: selectedDate,
      generatedAt: new Date().toISOString(),
      sessions: todays,
      orders: todaysOrders,
      totals: { play: totalPlay, cafe: totalCafe, revenue: totalPlay + totalCafe },
      analytics: analytics || {},
    };

    // Generate PDF using jsPDF + autotable
    try {
      setLoading(true);
      // strict safeText helpers
      const safeText = (value, fallback = '-') => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (value instanceof Date) return value.toLocaleString();
        if (Array.isArray(value)) {
          return value
            .map(item => {
              if (typeof item === 'string' || typeof item === 'number') return String(item);
              if (item && typeof item === 'object') {
                return item.message || item.description || item.name || JSON.stringify(item);
              }
              return fallback;
            })
            .join('\n');
        }
        if (typeof value === 'object') {
          return value.message || value.description || value.name || JSON.stringify(value);
        }
        return fallback;
      };

      const docText = (docObj, val, x, y, fallbackX = 14, fallbackY = 20) => {
        const X = (typeof x === 'number' && !isNaN(x)) ? x : (Number(x) || fallbackX);
        const Y = (typeof y === 'number' && !isNaN(y)) ? y : (Number(y) || fallbackY);
        const text = (Array.isArray(val) ? val.map(v => safeText(v)) : safeText(val));
        try {
          docObj.text(text, X, Y);
        } catch (err) {
          console.error('docText failed for', { text, X, Y }, err);
          throw err;
        }
      };

      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new jsPDF('p', 'mm', 'a4');
      // dynamic vertical position
      let y = 20;
      doc.setFontSize(18);
      docText(doc, t('daily_report_title'), 14, y);
      y += 10;
      doc.setFontSize(11);
      // report subtitle
      if (y > 260) { doc.addPage(); y = 20; }
      docText(doc, `${t('daily_report_subtitle')} ${new Date(reportData.date).toDateString()}`, 14, y);
      y += 8;
      docText(doc, `Generated: ${new Date(reportData.generatedAt).toLocaleString()}`, 14, y);
      y += 10;

      // helper to ensure autoTable receives safe startY and string cells
      const safeAutoTable = (docObj, opts) => {
        const o = { ...opts };
        o.startY = (typeof o.startY === 'number' && !isNaN(o.startY)) ? o.startY : (Number(o.startY) || 20);
        if (o.head && Array.isArray(o.head)) {
          o.head = o.head.map(r => Array.isArray(r) ? r.map(c => safeText(c)) : r);
        }
        if (o.body && Array.isArray(o.body)) {
          o.body = o.body.map(r => Array.isArray(r) ? r.map(c => safeText(c)) : r);
        }
        return docObj.autoTable(o);
      };

      // Sessions table
      const sessionHead = [[t('s_id'), t('customer'), t('station'), t('duration'), t('total')]];
      const sessionBody = reportData.sessions.map(s => [
        `#${s.id}`,
        safeText(s.name || '-'),
        safeText(s.stationId || s.resourceId || '-'),
        safeText(s.durationMinutes ? `${Math.floor(s.durationMinutes/60)}h ${s.durationMinutes%60}m` : '-'),
        safeText(formatMoney(s.finalTotal ?? s.totalCost)),
      ]);
      const tableRes = safeAutoTable(doc, { startY: y, head: sessionHead, body: sessionBody, styles: { fontSize: 9 } });
      // advance y after sessions table
      y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : (tableRes && tableRes.finalY ? tableRes.finalY + 10 : y + 12);

      // Additional sections: per-session products and audit logs
      doc.setFontSize(11);
      // per-session product lists
      for (const s of reportData.sessions) {
        if (y > 260) { doc.addPage(); y = 20; }
        docText(doc, `${t('session')} #${String(s.id)} - ${s.name || '-'}`, 14, y);
        y += 6;
        const orders = (s.orders || []).map(o => ({
          name: o.name || o.item_name || o.product || '-',
          qty: o.quantity || o.qty || 1,
          unit: o.price || o.unit_price || o.unitPrice || 0,
        }));
        if (orders.length > 0) {
          const ordersHead = [[t('product'), t('quantity'), t('unit_price'), t('total')]];
          const ordersBody = orders.map(o => [safeText(o.name), safeText(o.qty), safeText(formatMoney(o.unit)), safeText(formatMoney((o.unit || 0) * (o.qty || 1)))]);
          const ordTable = safeAutoTable(doc, { startY: y, head: ordersHead, body: ordersBody, styles: { fontSize: 9 } });
          y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 6 : (ordTable && ordTable.finalY ? ordTable.finalY + 6 : y + 8);
        }
        // add a small gap
        y += 4;
      }
      // Summary totals (use autoTable)
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      const todaysSales = standaloneSales.filter(s => {
        const d = new Date(s.created_at || s.created || s.timestamp || s.date || s.createdAt || null);
        return d && new Date(d).toISOString().slice(0,10) === selectedDate;
      });
      const totalStandalone = todaysSales.reduce((sum, x) => sum + (Number(x.total || x.amount || x.price || 0) || 0), 0);
      const summaryHead = [[t('summary'), t('amount')]];
      const summaryBody = [
        [t('total_session_revenue'), safeText(formatMoney(reportData.totals.play))],
        [t('total_pos_sales'), safeText(formatMoney(totalStandalone))],
        [t('total_products_in_sessions'), safeText(String(reportData.orders.length))],
        [t('total_expenses'), safeText(formatMoney((reportData.analytics?.expenses_total) || (monthlyExpenses && monthlyExpenses.reduce ? monthlyExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0):0)))],
        [t('grand_total_revenue'), safeText(formatMoney(reportData.totals.revenue + totalStandalone))],
      ];
      const summaryTable = safeAutoTable(doc, { startY: y, head: summaryHead, body: summaryBody, styles: { fontSize: 10 }, theme: 'grid' });
      y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 12 : (summaryTable && summaryTable.finalY ? summaryTable.finalY + 12 : y + 12);

      // Audit logs section
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      docText(doc, t('audit_logs'), 14, y);
      y += 8;
      doc.setFontSize(10);
      if (todaysAuditLogs.length > 0) {
        const logsHead = [[t('time'), t('actor'), t('action')]];
        const logsBody = todaysAuditLogs.map(l => [
          safeText(new Date(l.created_at || l.created || l.timestamp || l.time || l.date || l.createdAt || '').toLocaleString()),
          safeText(l.username || l.actor || l.user || '-'),
          safeText(l.description || l.message || l.action || JSON.stringify(l).slice(0,80)),
        ]);
        const logsTable = safeAutoTable(doc, { startY: y, head: logsHead, body: logsBody, styles: { fontSize: 9 } });
        y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : (logsTable && logsTable.finalY ? logsTable.finalY + 10 : y + 10);
      } else {
        docText(doc, t('no_audit_logs_today') || 'No audit logs for today', 14, y);
        y += 12;
      }

      // download the PDF (user copy)
      const pdfBlob = doc.output('blob');
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `daily-report-${today}.pdf`;
      doc.save(fileName);

      // try to upload and archive on server (must archive after PDF generated)
      try {
        const form = new FormData();
        form.append('date', selectedDate);
        form.append('report_file', pdfBlob, fileName);
        const res = await axios.post('/daily-reports/close_day/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        // After archive succeeds, clear today's sessions (daily activity, history, recent activity)
        try {
          const ids = todays.map(s => s.id).filter(Boolean);
          if (ids.length > 0) {
            await Promise.all(ids.map(id => axios.delete(`/sessions/${id}/`).catch(() => null)));
          }
        } catch (delErr) {
          // ignore individual deletion errors but log
          console.info('Error deleting todays sessions after archive', delErr?.message || delErr);
        }
        // Also clear standalone POS sales for today
        try {
          const saleIds = (standaloneSales || []).filter(s => {
            const d = new Date(s.created_at || s.created || s.timestamp || s.date || s.createdAt || null);
            return d && new Date(d).toISOString().slice(0,10) === selectedDate;
          }).map(s => s.id).filter(Boolean);
          if (saleIds.length > 0) await Promise.all(saleIds.map(id => axios.delete(`/sales/${id}/`).catch(() => null)));
        } catch (saleErr) {
          console.info('Error deleting todays standalone sales', saleErr?.message || saleErr);
        }
        // Clear payments for today (best-effort)
        try {
          const payIds = (payments || []).filter(p => {
            const d = new Date(p.created_at || p.created || p.timestamp || p.date || p.createdAt || null);
            return d && new Date(d).toISOString().slice(0,10) === selectedDate;
          }).map(p => p.id).filter(Boolean);
          if (payIds.length > 0) await Promise.all(payIds.map(id => axios.delete(`/payments/${id}/`).catch(() => null)));
        } catch (payErr) {
          console.info('Error deleting todays payments', payErr?.message || payErr);
        }
        // Attempt to clear all audit logs (best-effort)
        try {
          await axios.post('/audit-logs/clear_logs/').catch(() => null);
          try { if (typeof fetchData === 'function') await fetchData(); } catch { /* best-effort refresh */ }
        } catch (auditDelErr) {
          console.info('Error clearing audit logs', auditDelErr?.message || auditDelErr);
        }
        // Attempt to delete monthly/expense entries created today (best-effort)
        try {
          const expenseIds = (monthlyExpenses || []).filter(e => {
            const d = new Date(e.date || e.created_at || e.created || e.timestamp || null);
            return d && new Date(d).toISOString().slice(0,10) === selectedDate;
          }).map(e => e.id).filter(Boolean);
          if (expenseIds.length > 0) await Promise.all(expenseIds.map(id => axios.delete(`/monthly-expenses/${id}/`).catch(() => null)));
        } catch (expErr) {
          console.info('Error deleting todays expenses', expErr?.message || expErr);
        }
        // refresh client-side data after deletions
        try { await checkAutoEnd(); } catch { /* best-effort refresh */ }
        setClosedReport(res.data);
        if (showAlert) showAlert(t('closed_success'));
      } catch (uploadErr) {
        const msg = uploadErr?.response?.data?.error || uploadErr?.message || String(uploadErr);
        setCloseError(msg);
        if (showAlert) showAlert(t('dialog_error') + ': ' + msg, { variant: 'danger' });
        setLoading(false);
        return;
      }
      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error('PDF generation failed:', e);
      const msg = e?.message || String(e);
      setCloseError(msg);
      if (showAlert) {
        try { showAlert('Failed to generate PDF. Please check console for details.', { variant: 'danger' }); } catch { /* ignore */ }
      } else {
        try { alert('Failed to generate PDF. Check console for details.'); } catch { /* ignore */ }
      }
      return;
    }
  };

  const handleClose = () => {
    setClosedReport(null);
    setCloseError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl overflow-y-auto border border-gray-200 dark:border-gray-700 animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 text-center relative [&_h2]:!text-xl sm:[&_h2]:!text-2xl [&_p]:!text-xs sm:[&_p]:!text-sm">
          <button onClick={handleClose} className="absolute right-4 top-4 text-gray-400 hover:text-red-500 transition"><i className="fas fa-times text-lg"></i></button>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mx-auto mb-3">
            <i className="fas fa-file-invoice text-xl"></i>
          </div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-2">{t('daily_report_title')}</h2>
          <p className="text-gray-500 dark:text-gray-400">{t('daily_report_subtitle')} {todayStr}</p>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="mt-4 px-4 py-2 rounded-xl border dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white text-gray-800"
          />
        </div>

        {/* Closed Report Result */}
        {closedReport && (
          <div className="px-4 sm:px-5 pt-4">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-3">
              <div className="flex items-center gap-2 mb-4">
                <i className="fas fa-check-circle text-emerald-500 text-xl"></i>
                <span className="font-black text-emerald-600 dark:text-emerald-400">{t('closed_success')}</span>
                <span className="text-xs text-gray-400 ml-auto">{closedReport.date}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('revenue_sessions')}</p>
                  <p className="text-xl font-black text-rose-500">{formatMoney(closedReport.revenue_sessions)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('revenue_sales')}</p>
                  <p className="text-xl font-black text-amber-500">{formatMoney(closedReport.revenue_standalone)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('total_revenue')}</p>
                  <p className="text-xl font-black text-indigo-500">{formatMoney(closedReport.total_revenue)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('inventory_cost')}</p>
                  <p className="text-xl font-black text-red-500">-{formatMoney(closedReport.total_cost)}</p>
                </div>
                <div className="col-span-2 bg-emerald-500 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-white/80 uppercase mb-1">{t('net_profit_label')}</p>
                  <p className="text-2xl font-black text-white">{formatMoney(closedReport.net_profit)}</p>
                </div>
              </div>
              {closedReport.active_sessions_at_close > 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3 text-center">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  {t('active_sessions_warning').replace('{count}', closedReport.active_sessions_at_close)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {closeError && (
        <div className="px-4 sm:px-5 pt-4">
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-red-500 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i> {closeError}
            </div>
          </div>
        )}

        {/* Live Analytics */}
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('live_revenue')}</p>
            <p className="text-2xl font-black text-rose-500">{formatMoney(analytics?.completedRevenue || 0)}</p>
            <div className="mt-3 space-y-2 border-t pt-3 border-gray-100 dark:border-gray-700">
               <div className="flex justify-between text-xs"><span className="text-gray-500">{t('play_time')}</span><span className="font-bold dark:text-white">{formatMoney(totalPlayEarnings)}</span></div>
               <div className="flex justify-between text-xs"><span className="text-gray-500">{t('cafe_sales')}</span><span className="font-bold dark:text-white">{formatMoney(totalCafeEarnings)}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-emerald-500/20 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('live_net_profit')}</p>
            <p className="text-2xl font-black text-emerald-500">{formatMoney(analytics?.netProfit || 0)}</p>
            <p className="text-[10px] text-gray-400 mt-2 italic">{t('after_inventory_costs')}</p>
            <div className="mt-3 space-y-2 border-t pt-3 border-gray-100 dark:border-gray-700">
               <div className="flex justify-between text-xs"><span className="text-gray-500">{t('operational_cost')}</span><span className="font-bold text-red-400">-{formatMoney(analytics?.totalCost || 0)}</span></div>
            </div>
          </div>
        </div>

        {/* Inventory Checklist */}
        <div className="px-4 sm:px-5 pb-4">
          <h4 className="font-black text-gray-400 uppercase text-[10px] mb-4">{t('inventory_harvest')}</h4>
          <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-xl dark:border-gray-700">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 font-bold text-gray-500">
                <tr>
                  <th className="px-3 py-2">{t('product')}</th>
                  <th className="px-3 py-2 text-right">{t('sale_price_col')}</th>
                  <th className="px-3 py-2 text-right">{t('current_stock')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {cafeItems.map(item => (
                  <tr key={item.id} className="dark:text-gray-300">
                    <td className="px-3 py-2 font-bold">{item.name}</td>
                    <td className="px-3 py-2 text-right text-indigo-500">{formatMoney(item.price)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`px-2 py-0.5 rounded font-mono ${item.stock < 5 ? 'bg-red-500/10 text-red-500' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {item.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 flex flex-wrap justify-between gap-3">
          <button onClick={handleClose} className="px-6 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 font-bold transition flex-1">{t('close')}</button>
          <button onClick={() => window.print()} className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold transition flex-1 flex items-center justify-center gap-2">
            <i className="fas fa-print"></i> {t('print')}
          </button>
          <button
            onClick={handleCloseDay}
            disabled={loading || !canCloseShift}
            className={`px-6 py-3 rounded-2xl font-bold transition flex-1 flex items-center justify-center gap-2
              ${!canCloseShift ? 'hidden' : loading ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg active:scale-95'}`}
          >
            {loading
              ? <><i className="fas fa-spinner fa-spin"></i> {t('harvesting')}</>
              : <><i className="fas fa-cash-register"></i> {t('harvest_day')}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyReportModal;
