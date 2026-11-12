import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  findExpiredSessions,
  loadDismissedIds,
  playAlertSound,
  saveDismissedIds,
} from '../utils/sessionAlerts';

const REPEAT_SOUND_MS = 15000;

const SessionEndAlerts = () => {
  const { sessions, t } = useApp();
  const [dismissedIds, setDismissedIds] = useState(loadDismissedIds);
  const [now, setNow] = useState(() => Date.now());
  const audioContextRef = useRef(null);

  // Browsers only allow sound after the user has interacted with the page.
  useEffect(() => {
    const unlockAudio = () => {
      audioContextRef.current ??= new AudioContext();
      audioContextRef.current.resume();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expired = findExpiredSessions(sessions, dismissedIds, now);
  const expiredKey = expired.map((session) => session.id).join(',');

  useEffect(() => {
    if (!expiredKey) return undefined;
    const play = () => {
      if (audioContextRef.current?.state === 'running') playAlertSound(audioContextRef.current);
    };
    play();
    const timer = setInterval(play, REPEAT_SOUND_MS);
    return () => clearInterval(timer);
  }, [expiredKey]);

  const dismiss = (id) => {
    const next = new Set(dismissedIds).add(id);
    saveDismissedIds(next);
    setDismissedIds(next);
  };

  if (expired.length === 0) return null;

  return (
    <div className="fixed top-20 inset-x-0 z-[90] flex flex-col items-center gap-2 px-3 pointer-events-none">
      {expired.map((session) => (
        <div
          key={session.id}
          role="alert"
          className="pointer-events-auto w-full max-w-md flex items-center gap-3 p-4 rounded-2xl bg-red-600 text-white shadow-2xl animate-fade-in-up"
        >
          <i className="fas fa-bell text-xl animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="font-black">{t('session_ended_alert_title')}</div>
            <div className="text-sm truncate">
              {session.name} · {session.stationId}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(session.id)}
            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-bold transition"
          >
            {t('dismiss')}
          </button>
        </div>
      ))}
    </div>
  );
};

export default SessionEndAlerts;
