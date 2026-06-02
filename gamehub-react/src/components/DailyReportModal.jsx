import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../utils/helpers';
import { hasPermission } from '../utils/permissions';

const DailyReportModal = ({ isOpen, onClose }) => {
  const { analytics, sessions, cafeItems, closeDayReport, permissions } = useApp();
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
    if (!window.confirm('هل تريد حصاد اليوم وإغلاق التقرير اليومي؟ سيتم تسجيل جميع الأرقام الحالية.')) return;
    setLoading(true);
    setCloseError('');
    setClosedReport(null);
    const result = await closeDayReport(selectedDate);
    setLoading(false);
    if (result.success) {
      setClosedReport(result.data);
    } else {
      setCloseError(result.error);
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
          <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-2">التقرير اليومي</h2>
          <p className="text-gray-500 dark:text-gray-400">حصاد المخزون وملخص الأرباح ليوم {todayStr}</p>
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
                <span className="font-black text-emerald-600 dark:text-emerald-400">تم إغلاق اليوم بنجاح!</span>
                <span className="text-xs text-gray-400 ml-auto">{closedReport.date}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">إيرادات الجلسات</p>
                  <p className="text-xl font-black text-rose-500">{formatMoney(closedReport.revenue_sessions)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">إيرادات المبيعات</p>
                  <p className="text-xl font-black text-amber-500">{formatMoney(closedReport.revenue_standalone)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">إجمالي الإيرادات</p>
                  <p className="text-xl font-black text-indigo-500">{formatMoney(closedReport.total_revenue)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">تكلفة المخزون</p>
                  <p className="text-xl font-black text-red-500">-{formatMoney(closedReport.total_cost)}</p>
                </div>
                <div className="col-span-2 bg-emerald-500 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-white/80 uppercase mb-1">صافي الربح</p>
                  <p className="text-2xl font-black text-white">{formatMoney(closedReport.net_profit)}</p>
                </div>
              </div>
              {closedReport.active_sessions_at_close > 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3 text-center">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  تنبيه: كان هناك {closedReport.active_sessions_at_close} جلسة نشطة عند إغلاق اليوم
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
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">إجمالي الإيرادات (لحظي)</p>
            <p className="text-2xl font-black text-rose-500">{formatMoney(analytics?.completedRevenue || 0)}</p>
            <div className="mt-3 space-y-2 border-t pt-3 border-gray-100 dark:border-gray-700">
               <div className="flex justify-between text-xs"><span className="text-gray-500">وقت اللعب:</span><span className="font-bold dark:text-white">{formatMoney(totalPlayEarnings)}</span></div>
               <div className="flex justify-between text-xs"><span className="text-gray-500">مبيعات الكافيه:</span><span className="font-bold dark:text-white">{formatMoney(totalCafeEarnings)}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-emerald-500/20 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">صافي الربح (لحظي)</p>
            <p className="text-2xl font-black text-emerald-500">{formatMoney(analytics?.netProfit || 0)}</p>
            <p className="text-[10px] text-gray-400 mt-2 italic">بعد خصم تكاليف المخزون</p>
            <div className="mt-3 space-y-2 border-t pt-3 border-gray-100 dark:border-gray-700">
               <div className="flex justify-between text-xs"><span className="text-gray-500">التكلفة التشغيلية:</span><span className="font-bold text-red-400">-{formatMoney(analytics?.totalCost || 0)}</span></div>
            </div>
          </div>
        </div>

        {/* Inventory Checklist */}
        <div className="px-4 sm:px-5 pb-4">
          <h4 className="font-black text-gray-400 uppercase text-[10px] mb-4">حصاد المخزون (المستوى الحالي)</h4>
          <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-xl dark:border-gray-700">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 font-bold text-gray-500">
                <tr>
                  <th className="px-3 py-2">المنتج</th>
                  <th className="px-3 py-2 text-right">سعر البيع</th>
                  <th className="px-3 py-2 text-right">المخزون الحالي</th>
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
          <button onClick={handleClose} className="px-6 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 font-bold transition flex-1">إغلاق</button>
          <button onClick={() => window.print()} className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold transition flex-1 flex items-center justify-center gap-2">
            <i className="fas fa-print"></i> طباعة
          </button>
          <button
            onClick={handleCloseDay}
            disabled={loading || !canCloseShift}
            className={`px-6 py-3 rounded-2xl font-bold transition flex-1 flex items-center justify-center gap-2
              ${!canCloseShift ? 'hidden' : loading ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg active:scale-95'}`}
          >
            {loading
              ? <><i className="fas fa-spinner fa-spin"></i> جاري الحصاد...</>
              : <><i className="fas fa-cash-register"></i> حصاد اليوم</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyReportModal;
