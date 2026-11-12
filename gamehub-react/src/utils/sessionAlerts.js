const DISMISSED_KEY = 'gamehub_dismissed_session_alerts';

// Running prepaid sessions whose paid time is up and that nobody has dismissed yet.
export const findExpiredSessions = (sessions, dismissedIds, now = Date.now()) =>
  sessions.filter((session) => {
    if (session.sessionType !== 'PRE' || !session.plannedEndTime) return false;
    if (session.endTime || session.isPaused || dismissedIds.has(session.id)) return false;
    return now >= new Date(session.plannedEndTime).getTime();
  });

export const loadDismissedIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY)) || []);
  } catch {
    return new Set();
  }
};

export const saveDismissedIds = (ids) => {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
};

export const playAlertSound = (audioContext) => {
  [0, 0.25, 0.5].forEach((delay) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  });
};
