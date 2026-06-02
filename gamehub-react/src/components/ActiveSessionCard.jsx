import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getActiveDurationMs, formatRemaining, getDeviceColorTone, getDeviceTintStyle } from '../utils/helpers';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

const ActiveSessionCard = ({ session, onOpenBuffet }) => {
  const { darkMode, togglePauseSession, endSession, removeOrderFromSession, permissions, t } = useApp();
  const canAddOrder = hasPermission(permissions, 'can_add_session_order');
  const [display, setDisplay] = useState({ timer: '00:00:00', cost: 0, pulsing: false });

  const canPauseOrResume = session.isPaused
    ? hasPermission(permissions, 'can_resume_session')
    : hasPermission(permissions, 'can_pause_session');
  const canEndSession = hasPermission(permissions, 'can_end_session');
  const canRemoveOrder = hasPermission(permissions, 'can_remove_session_order');
  const canActOnSession = hasAnyPermission(permissions, [
    'can_pause_session',
    'can_resume_session',
    'can_end_session',
  ]);
  const intervalRef = useRef(null);

  const handleRemoveOrder = (orderId, itemName) => {
    if (window.confirm(`Permanently remove ${itemName} order and restore stock?`)) {
      removeOrderFromSession(session.id, orderId);
    }
  };

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const activeMs = getActiveDurationMs(session, now);
      const liveCost = Number(session.liveCost ?? session.finalTotal ?? session.totalCost ?? 0);
      let timerText = '00:00:00';
      let pulsing = false;

      if (session.sessionType === 'PRE' && session.plannedEndTime) {
        const plannedEnd = new Date(session.plannedEndTime);
        let remainingMs = plannedEnd - now;
        if (session.isPaused) remainingMs += (now - new Date(session.lastPauseTime));
        timerText = remainingMs > 0 ? formatRemaining(remainingMs) : '00:00:00';
        pulsing = remainingMs > 0 && remainingMs <= 600000 && !session.isPaused;
      } else {
        timerText = formatRemaining(activeMs);
      }

      setDisplay({ timer: timerText, cost: liveCost, pulsing });
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [session]);

  const now = new Date();
  let remainingMs = null;
  let isExpired = false;
  if (session.sessionType === 'PRE' && session.plannedEndTime) {
    const plannedEnd = new Date(session.plannedEndTime);
    remainingMs = plannedEnd - now;
    if (session.isPaused) remainingMs += (now - new Date(session.lastPauseTime));
    isExpired = remainingMs <= 0 && !session.isPaused;
  }

  const borderColor = session.isPaused
    ? 'border-l-yellow-400 opacity-75'
    : isExpired
    ? 'border-l-red-500'
    : 'border-l-green-500';

  const timerColor = session.isPaused
    ? 'text-yellow-500'
    : isExpired
    ? 'text-red-400'
    : darkMode
    ? 'text-green-400'
    : 'text-green-600';
  const deviceColorKey = session.deviceType;
  const deviceTint = getDeviceTintStyle(deviceColorKey, darkMode, { includeBorder: false });
  const deviceTone = getDeviceColorTone(deviceColorKey, darkMode);


  const handleEnd = () => {
    if (window.confirm("End this session now?")) {
      endSession(session.id);
    }
  };

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-lg border-l-8 ${borderColor} border dark:border-gray-700 border-gray-200 transition-all`}
      style={deviceTint}
    >
      <div className="p-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex gap-3 min-w-0">
            {onOpenBuffet && canAddOrder && (
              <button
                type="button"
                onClick={onOpenBuffet}
                className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-amber-500/40 hover:scale-105 active:scale-95 transition flex flex-col items-center justify-center ring-2 ring-amber-400/30"
                title={t('add_buffet_to_session')}
              >
                <i className="fas fa-mug-hot text-lg" />
                <span className="text-[8px] font-bold uppercase mt-0.5">{t('buffet')}</span>
              </button>
            )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg dark:text-white text-gray-800">{session.name}</p>
              {session.isPaused && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 animate-pulse">{t('paused')}</span>
              )}
              {session.sessionType === 'POST' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">{t('open_time')}</span>
              )}
            </div>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: deviceTone.backgroundColor, color: deviceTone.textColor }}
              >
                {session.deviceType}
              </span>
              <span className="text-xs font-mono dark:text-gray-400 text-gray-600">
                <i className="fas fa-tower-cell"></i> {session.stationId}
              </span>
            </div>
            {session.orders && session.orders.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {session.orders.map(order => (
                  <div key={order.id} className="group relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] dark:text-amber-200 text-amber-700 animate-fade-in">
                    <i className="fas fa-coffee opacity-60"></i>
                    <span className="font-medium whitespace-nowrap">{order.quantity > 1 ? `${order.quantity}x ` : ""}{order.item_name}</span>
                    <span className="opacity-60">${parseFloat(order.total_price).toFixed(2)}</span>
                    {canRemoveOrder && (
                      <button 
                        onClick={() => handleRemoveOrder(order.id, order.item_name)}
                        className="ml-1 text-red-500 hover:text-red-700 transition-colors"
                        title="Remove Order"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs dark:text-gray-400 text-gray-500">{t('est_total')}</p>
            <p className="text-xl font-bold text-amber-400">{display.cost.toFixed(2)} USD</p>
          </div>
        </div>

        <div className="mt-3 flex justify-between items-end">
          <p className={`text-2xl font-mono font-bold tracking-wider timer-mono ${timerColor} ${display.pulsing ? 'pulse-ending' : ''}`}>
            {display.timer}
          </p>
          <div className="flex items-center gap-2">
            {canActOnSession && (
              <>
                {canPauseOrResume && (
                  <button
                    onClick={() => togglePauseSession(session)}
                    className={`w-10 h-10 rounded-lg ${session.isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'} text-white transition flex items-center justify-center shadow-md`}
                    title={session.isPaused ? 'Resume' : 'Pause'}
                  >
                    <i className={`fas ${session.isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                  </button>
                )}
                {canEndSession && (
                  <button
                    onClick={handleEnd}
                    className="px-4 py-2 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-md"
                  >
                    <i className="fas fa-power-off"></i> {t('end_session')}
                  </button>
                )}
              </>
            )}
            {!canActOnSession && (
              <span className="text-xs text-gray-400 italic">{t('view_only')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSessionCard;
