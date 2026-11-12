import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDuration, formatMoney, formatOrderSummary } from '../utils/helpers';
import SessionCorrectionModal from './SessionCorrectionModal';

const SessionHistory = ({ onViewReceipt }) => {
  const { sessions, deleteSession, permissions, clearAllActivity, t } = useApp();
  const [correctionSession, setCorrectionSession] = useState(null);
  const [hidingSession, setHidingSession] = useState(null);
  const [hideReason, setHideReason] = useState('');
  const endedSessions = sessions.filter(
    s => s.endTime && !s.metadata?.hidden_from_activity && s.inCurrentBusinessDay
  );
  const canDelete = permissions?.manage_settings;
  const canCorrect = permissions?.manage_settings;

  const closeHideDialog = () => {
    setHidingSession(null);
    setHideReason('');
  };

  const confirmHide = async () => {
    const hidden = await deleteSession(hidingSession.id, hideReason.trim());
    if (hidden) closeHideDialog();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <i className="fas fa-clock-rotate-left text-cyan-400"></i>
          <h2 className="text-xl font-bold dark:text-white text-gray-800">{t('recent_activity')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full dark:bg-gray-700 bg-gray-200">
            {endedSessions.length} {t('total_sessions')}
          </span>
          {permissions?.manage_settings && (
            <button
              onClick={clearAllActivity}
              className="px-4 py-2 border border-red-500/50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white transition"
            >
              <i className="fas fa-trash-alt mr-2"></i> {t('clear_all_activity')}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-xl dark:bg-gray-800/70 bg-white/90">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="dark:bg-gray-900/80 bg-gray-100 dark:text-gray-300 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">{t('s_id')}</th>
                <th className="px-4 py-3 text-left">{t('customer')}</th>
                <th className="px-4 py-3 text-left">{t('station')}</th>
                <th className="px-4 py-3 text-left">{t('start_end')}</th>
                <th className="px-4 py-3 text-left">{t('duration')}</th>
                <th className="px-4 py-3 text-left">{t('earnings')}</th>
                <th className="px-4 py-3 text-center">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {endedSessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 dark:text-gray-400 text-gray-500">
                    {t('no_completed_sessions')}
                  </td>
                </tr>
              ) : (
                endedSessions.slice().reverse().map(session => (
                  <tr key={session.id} className="border-b dark:border-gray-700 hover:dark:bg-gray-700/40 border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">#{session.id.toString().slice(-5)}</td>
                    <td className="px-4 py-2 font-medium dark:text-white text-gray-800">{session.name}</td>
                    <td className="px-4 py-2 dark:text-gray-300 text-gray-700">
                      {session.stationId} <span className="text-xs opacity-70">({session.deviceType})</span>
                    </td>
                    <td className="px-4 py-2 text-xs dark:text-gray-400 text-gray-500">
                      {new Date(session.startTime).toLocaleTimeString()} - {new Date(session.endTime).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 font-mono dark:text-gray-300">{formatDuration(session.elapsedTime ?? session.durationMinutes)}</td>
                    <td className="px-4 py-2">
                      <div className="font-bold text-emerald-500">{formatMoney(session.finalTotal ?? session.totalCost)}</div>
                      {session.orders && session.orders.length > 0 && (
                        <div className="text-[10px] dark:text-gray-400 text-gray-500 mt-1 max-w-[200px] leading-tight">
                          <i className="fas fa-coffee text-amber-500/70"></i>{' '}
                          ${Number(session.ordersCost || 0).toFixed(2)}: {formatOrderSummary(session.orders)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onViewReceipt(session.id)}
                          className="text-cyan-500 hover:text-cyan-600 transition"
                          title={t('receipt')}
                        >
                          <i className="fas fa-file-invoice-dollar"></i>
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setHidingSession(session)}
                            className="text-red-400 hover:text-red-600 transition"
                            title={t('hide_session_title')}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        )}
                        {canCorrect && (
                          <button
                            onClick={() => setCorrectionSession(session)}
                            className="text-amber-500 hover:text-amber-600 transition"
                            title={t('correct_session')}
                          >
                            <i className="fas fa-pen-to-square"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {hidingSession && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-5 space-y-3">
            <h2 className="text-lg font-black dark:text-white text-gray-900">{t('hide_session_title')}</h2>
            <p className="text-sm dark:text-gray-300 text-gray-600">
              {hidingSession.name} · {hidingSession.stationId}
            </p>
            <p className="text-xs dark:text-gray-400 text-gray-500">{t('hide_session_hint')}</p>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('hide_reason_label')}</span>
              <textarea
                autoFocus
                rows={2}
                value={hideReason}
                onChange={(event) => setHideReason(event.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeHideDialog} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold dark:text-gray-200 text-gray-700">
                {t('dialog_cancel')}
              </button>
              <button
                type="button"
                onClick={confirmHide}
                disabled={!hideReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black transition disabled:opacity-50"
              >
                {t('hide_session_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      <SessionCorrectionModal
        session={correctionSession}
        onClose={() => setCorrectionSession(null)}
      />
    </div>
  );
};

export default SessionHistory;
