import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import SessionForm from '../components/SessionForm';
import ActiveSessionCard from '../components/ActiveSessionCard';
import SessionHistory from '../components/SessionHistory';
import SessionOrderModal from '../components/SessionOrderModal';
import FinalizeModal from '../components/FinalizeModal';

const SessionsPage = ({ onOpenSettings, resetSetup }) => {
  const { sessions, devices, permissions, t } = useApp();
  const [orderSession, setOrderSession] = useState(null);
  const [finalizeSessionId, setFinalizeSessionId] = useState(null);

  const activeSessions = sessions.filter((s) => !s.endTime);
  const canStartSession = hasPermission(permissions, 'can_start_session');
  const canAddOrder = hasPermission(permissions, 'can_add_session_order');

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-3xl p-10 max-w-lg text-center shadow-2xl border border-gray-200 dark:border-gray-700">
          <i className="fas fa-cogs text-5xl text-indigo-500 mb-4" />
          <h2 className="text-2xl font-extrabold dark:text-white text-gray-800 mb-3">
            {t('system_not_configured')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{t('configure_devices_hint')}</p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold mb-3"
          >
            <i className="fas fa-magic mr-2" />
            {t('quick_config')}
          </button>
          <button
            type="button"
            onClick={resetSetup}
            className="w-full py-3 rounded-xl border dark:border-gray-600 border-gray-300 font-bold dark:text-gray-300 text-gray-600"
          >
            {t('rerun_setup')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          {canStartSession && (
            <div className="rounded-2xl shadow-xl p-5 dark:bg-gray-800/80 bg-white/90 border dark:border-gray-700 border-gray-200">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white text-gray-800 mb-0">
                <i className="fas fa-play-circle text-green-500" />
                {t('start_session')}
              </h3>
              <SessionForm />
            </div>
          )}
          {canAddOrder && activeSessions.length > 0 && (
            <p className="mt-4 text-xs text-center dark:text-gray-500 text-gray-400 px-2">
              <i className="fas fa-hand-pointer mr-1" />
              {t('tap_session_for_buffet')}
            </p>
          )}
        </div>

        <div className="xl:col-span-2 space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="fas fa-tv text-rose-500 text-xl" />
              <h2 className="text-xl font-bold dark:text-white text-gray-800">{t('live_session_monitor')}</h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  activeSessions.length ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {activeSessions.length} {t('active')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeSessions.map((session) => (
                <ActiveSessionCard
                  key={session.id}
                  session={session}
                  onOpenBuffet={canAddOrder ? () => setOrderSession(session) : undefined}
                />
              ))}
            </div>
            {activeSessions.length === 0 && (
              <div className="rounded-2xl p-8 text-center dark:bg-gray-800/40 bg-white/60 border dark:border-gray-700 border-gray-200">
                <i className="fas fa-hourglass-half text-4xl text-gray-500 mb-2" />
                <p className="dark:text-gray-400 text-gray-500">{t('no_active')}</p>
              </div>
            )}
          </div>
          <SessionHistory onViewReceipt={(id) => setFinalizeSessionId(id)} />
        </div>
      </div>

      <SessionOrderModal session={orderSession} onClose={() => setOrderSession(null)} />
      {finalizeSessionId && (
        <FinalizeModal sessionId={finalizeSessionId} onClose={() => setFinalizeSessionId(null)} />
      )}
    </>
  );
};

export default SessionsPage;
