import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import {
  BASE_CURRENCY,
  convertMoney,
  formatCurrencyAmount,
  getCurrencyOptions,
} from '../utils/currency';

const SessionForm = () => {
  const { devices, addSession, isStationActive, permissions, currencySettings, t } = useApp();
  const [name, setName] = useState('');

  const canStartSession = hasPermission(permissions, 'can_start_session');
  const canEditPricing = permissions?.manage_settings;
  const [deviceType, setDeviceType] = useState('');
  const [stationId, setStationId] = useState('');
  const [sessionType, setSessionType] = useState('PRE');
  const [durationHours, setDurationHours] = useState(1);
  const [paymentCurrency, setPaymentCurrency] = useState(BASE_CURRENCY);
  const [prepaidAmount, setPrepaidAmount] = useState('');

  const selectedDeviceType = deviceType || devices[0]?.id || '';
  const activeDevice = devices.find(d => d.id === selectedDeviceType);
  const strategy = activeDevice ? (activeDevice.pricing_strategy || 'HOURLY') : 'HOURLY';
  const pricePerHour = activeDevice?.base_price || 0;
  const fixedPrice = activeDevice?.base_price || 0;
  const stations = useMemo(() => {
    if (!activeDevice) return [];
    if (activeDevice.stations?.length) return activeDevice.stations;
    const opts = [];
    for (let i = 1; i <= activeDevice.count; i += 1) {
      const code = `${activeDevice.prefix}${i.toString().padStart(2, '0')}`;
      opts.push({ code, status: 'ACTIVE', isStopped: false, statusLabel: 'Working' });
    }
    return opts;
  }, [activeDevice]);
  const selectedStation = stations.find(station => station.code === stationId)
    || stations.find(station => !station.isStopped && !isStationActive(station.code))
    || stations[0];
  const selectedStationId = selectedStation?.code || '';
  const currencyOptions = getCurrencyOptions(currencySettings);
  const selectedPaymentCurrency = currencyOptions.some(option => option.code === paymentCurrency)
    ? paymentCurrency
    : BASE_CURRENCY;
  const prepaidUsdPreview = prepaidAmount
    ? convertMoney(prepaidAmount, selectedPaymentCurrency, BASE_CURRENCY, currencySettings)
    : null;
  const prepaidLocalPreview = prepaidUsdPreview !== null && selectedPaymentCurrency === BASE_CURRENCY && currencyOptions.length > 1
    ? convertMoney(prepaidUsdPreview, BASE_CURRENCY, currencyOptions[1].code, currencySettings)
    : null;

  if (devices.length === 0) {
    return (
      <div className="mt-4 text-center text-sm text-gray-500 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
        {t('no_devices_configured')}<br />{t('add_devices_settings')}
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canStartSession) return;
    if (!selectedDeviceType || !selectedStationId) { alert(t('select_device_station')); return; }
    if (selectedStation?.isStopped) { alert(`${t('station')} ${selectedStationId} is stopped.`); return; }

    if (strategy === 'HOURLY' && pricePerHour < 0) { alert(t('price_must_be_positive')); return; }
    if (strategy !== 'HOURLY' && fixedPrice < 0) { alert(t('price_must_be_positive')); return; }
    if (strategy === 'HOURLY' && sessionType === 'PRE' && durationHours <= 0) { alert(t('duration_must_be_positive')); return; }
    if (strategy === 'HOURLY' && sessionType === 'PRE' && prepaidAmount && Number(prepaidAmount) <= 0) { alert(t('price_must_be_positive')); return; }
    if (isStationActive(selectedStationId)) { alert(`${t('station')} ${selectedStationId} ${t('is_already_occupied')}`); return; }

    addSession({
      name: name.trim(),
      deviceType: selectedDeviceType,
      stationId: selectedStationId,
      sessionType: strategy === 'HOURLY' ? sessionType : 'POST',
      pricePerHour: canEditPricing && strategy === 'HOURLY' ? parseFloat(pricePerHour) : null,
      fixedPrice: canEditPricing && strategy !== 'HOURLY' ? parseFloat(fixedPrice) : null,
      paymentCurrency: selectedPaymentCurrency,
      prepaidAmount: (strategy === 'HOURLY' && sessionType === 'PRE' && prepaidAmount) ? parseFloat(prepaidAmount) : null,
      durationHours: (strategy === 'HOURLY' && sessionType === 'PRE') ? parseFloat(durationHours) : null,
    });
    setName('');
    setPrepaidAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('customer_name')}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-rose-500 outline-none transition dark:bg-gray-700 bg-gray-50 dark:border-gray-600 border-gray-300 dark:text-white text-gray-900"
          placeholder={t('leave_blank_auto_number')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border p-3 transition-colors dark:border-gray-600 border-gray-300">
        <div>
          <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('device_type')}</label>
          <select
            value={selectedDeviceType}
            onChange={e => {
              setDeviceType(e.target.value);
              setStationId('');
            }}
            className="mt-1 w-full px-3 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
          >
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('station')}</label>
          <select
            value={selectedStationId}
            onChange={e => setStationId(e.target.value)}
            className={`mt-1 w-full px-3 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-white dark:border-gray-600 dark:text-white ${isStationActive(selectedStationId) ? 'border-red-500' : 'border-gray-300'}`}
          >
            {stations.map(st => (
              <option key={st.code} value={st.code} disabled={st.isStopped || isStationActive(st.code)}>
                {st.code} {st.isStopped ? '[Stopped]' : isStationActive(st.code) ? `[${t('active')}]` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {strategy === 'HOURLY' ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('type')}</label>
            <select
              value={sessionType}
              onChange={e => setSessionType(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
            >
              <option value="PRE">{t('prepaid')}</option>
              <option value="POST">{t('postpaid')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('price_hr')}</label>
            <input
              type="number"
              step="0.5"
              value={pricePerHour}
              disabled={true}
              className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-gray-100 dark:border-gray-600 border-gray-300 dark:text-gray-400 text-gray-500 opacity-80 cursor-not-allowed"
              title={t('price_edit_settings_only')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('hrs')}</label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={durationHours}
              onChange={e => setDurationHours(e.target.value)}
              disabled={sessionType === 'POST'}
              className={`mt-1 w-full px-4 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-gray-50 dark:border-gray-600 border-gray-300 dark:text-white transition-opacity ${sessionType === 'POST' ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="col-span-3 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">Currency</label>
              <select
                value={selectedPaymentCurrency}
                onChange={e => setPaymentCurrency(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
              >
                {currencyOptions.map(option => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">Prepaid Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prepaidAmount}
                onChange={e => setPrepaidAmount(e.target.value)}
                disabled={sessionType === 'POST'}
                className={`mt-1 w-full px-4 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-gray-50 dark:border-gray-600 border-gray-300 dark:text-white transition-opacity ${sessionType === 'POST' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {sessionType === 'PRE' && prepaidAmount && (
                <p className="mt-1 text-xs dark:text-gray-400 text-gray-500">
                  {prepaidUsdPreview === null
                    ? 'Set a valid exchange rate'
                    : `Converted: ${formatCurrencyAmount(prepaidUsdPreview, BASE_CURRENCY)}${prepaidLocalPreview !== null ? ` / ${formatCurrencyAmount(prepaidLocalPreview, currencyOptions[1].code)}` : ''}`}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">
              {strategy === 'PER_GAME' ? t('price_per_game') : t('fixed_cost')}
            </label>
            <input
              type="number"
              step="0.5"
              value={fixedPrice}
              disabled={true}
              className="mt-1 w-full px-4 py-2 rounded-xl border focus:ring-rose-500 dark:bg-gray-700 bg-gray-100 dark:border-gray-600 border-gray-300 dark:text-gray-400 text-gray-500 opacity-80 cursor-not-allowed"
              title={t('price_edit_settings_only')}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canStartSession}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg transition transform active:scale-95"
      >
        <i className="fas fa-bolt"></i> {t('start_session')}
      </button>
      <div className="mt-4 pt-3 text-xs flex justify-between dark:text-gray-400 text-gray-500">
        <span><i className="fas fa-info-circle"></i> {t('strategy')}: {strategy}</span>
      </div>
    </form>
  );
};

export default SessionForm;
