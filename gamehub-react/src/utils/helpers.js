export const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return "0h 0m";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hrs}h ${mins}m`;
};

export const formatRemaining = (ms) => {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatMoney = (value) => `$${Number(value || 0).toFixed(2)} USD`;

export const escapeHtml = (str) => {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
};

export const formatOrderSummary = (orders) => {
  if (!orders || !orders.length) return "";
  const counts = {};
  orders.forEach(o => counts[o.name] = (counts[o.name] || 0) + 1);
  return Object.entries(counts).map(([name, qty]) => qty > 1 ? `${qty}x ${name}` : name).join(', ');
};

const deviceColorPalette = [
  { light: 'rgba(219, 234, 254, 0.72)', dark: 'rgba(37, 99, 235, 0.16)', border: 'rgba(59, 130, 246, 0.36)', text: '#1d4ed8' },
  { light: 'rgba(220, 252, 231, 0.72)', dark: 'rgba(22, 163, 74, 0.15)', border: 'rgba(34, 197, 94, 0.34)', text: '#15803d' },
  { light: 'rgba(254, 243, 199, 0.72)', dark: 'rgba(217, 119, 6, 0.16)', border: 'rgba(245, 158, 11, 0.36)', text: '#b45309' },
  { light: 'rgba(237, 233, 254, 0.72)', dark: 'rgba(124, 58, 237, 0.16)', border: 'rgba(139, 92, 246, 0.36)', text: '#6d28d9' },
  { light: 'rgba(252, 231, 243, 0.72)', dark: 'rgba(219, 39, 119, 0.15)', border: 'rgba(236, 72, 153, 0.34)', text: '#be185d' },
  { light: 'rgba(204, 251, 241, 0.72)', dark: 'rgba(13, 148, 136, 0.15)', border: 'rgba(20, 184, 166, 0.34)', text: '#0f766e' },
  { light: 'rgba(255, 237, 213, 0.72)', dark: 'rgba(234, 88, 12, 0.15)', border: 'rgba(249, 115, 22, 0.34)', text: '#c2410c' },
  { light: 'rgba(224, 242, 254, 0.72)', dark: 'rgba(2, 132, 199, 0.15)', border: 'rgba(14, 165, 233, 0.34)', text: '#0369a1' },
];

const getStableColorIndex = (value = '') => {
  const key = value.toString().trim();
  if (!key) return 0;

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash * 31) + key.charCodeAt(i)) >>> 0;
  }
  return hash % deviceColorPalette.length;
};

export const getDeviceTintStyle = (value = '', darkMode = false, options = {}) => {
  const { includeBorder = true } = options;
  const tone = getDeviceColorTone(value, darkMode);
  const style = {
    backgroundColor: tone.backgroundColor,
    boxShadow: `inset 0 0 0 1px ${tone.borderColor}`,
  };

  if (includeBorder) {
    style.borderColor = tone.borderColor;
  }

  return style;
};

export const getActiveDurationMs = (session, refDate = new Date()) => {
  const start = new Date(session.startTime);
  let paused = session.totalPausedMs || 0;
  if (session.isPaused && session.lastPauseTime && !session.endTime) {
    paused += (refDate - new Date(session.lastPauseTime));
  }
  return Math.max(0, refDate - start - paused);
};

export const getDeviceColorTone = (value = '', darkMode = false) => {
  const v = value.toString().toLowerCase();
  let color;
  if (v.includes('pc')) {
    color = { light: 'rgba(229, 231, 235, 1)', dark: 'rgba(55, 65, 81, 1)', border: 'rgba(156, 163, 175, 1)', text: '#374151' };
  } else if (v.includes('ps') || v.includes('playstation')) {
    color = { light: 'rgba(254, 202, 202, 1)', dark: 'rgba(127, 29, 29, 1)', border: 'rgba(248, 113, 113, 1)', text: '#991b1b' };
  } else {
    color = deviceColorPalette[getStableColorIndex(value)];
  }
  return {
    backgroundColor: darkMode ? color.dark : color.light,
    borderColor: color.border,
    textColor: darkMode ? '#ffffff' : color.text,
  };
};

export const getLiveCost = (session, refDate = new Date()) => {
  if (session.sessionType === 'PRE' && session.durationHours) {
    return (session.durationHours * session.pricePerHour) + (session.ordersCost || 0);
  }
  const activeMs = getActiveDurationMs(session, refDate);
  return ((activeMs / (1000 * 3600)) * session.pricePerHour) + (session.ordersCost || 0);
};

export const getTodayRevenue = (sessions) => {
  const today = new Date().toDateString();
  return sessions
    .filter(s => s.endTime && new Date(s.endTime).toDateString() === today)
    .reduce((sum, s) => sum + (s.totalCost || 0), 0);
};

export const getYesterdayRevenue = (sessions) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  return sessions
    .filter(s => s.endTime && new Date(s.endTime).toDateString() === yesterdayStr)
    .reduce((sum, s) => sum + (s.totalCost || 0), 0);
};

export const getRevenueTrend = (sessions) => {
  const todayRev = getTodayRevenue(sessions);
  const yesterdayRev = getYesterdayRevenue(sessions);
  if (yesterdayRev === 0) {
    if (todayRev > 0) return { text: "+100% vs yesterday", up: true };
    return { text: "0% vs yesterday", up: true };
  }
  const percent = Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100);
  const sign = percent >= 0 ? '+' : '';
  return { text: `${sign}${percent}% vs yesterday`, up: percent >= 0 };
};

export const getActiveCountByType = (sessions, deviceType) => {
  return sessions.filter(s => !s.endTime && s.deviceType === deviceType).length;
};

export const playAlertSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Audio Context not allowed or supported", e);
  }
};
