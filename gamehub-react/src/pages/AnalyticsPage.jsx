import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { getRevenueTrend } from '../utils/helpers';
import {
  BASE_CURRENCY,
  canManageCurrencySettings,
  convertMoney,
  defaultCurrencySettings,
  formatCurrencyAmount,
  getCurrencyOptions,
  isLocalCurrencyEnabled,
  usdToLocal,
} from '../utils/currency';
import StatCard from '../components/StatCard';

const AnalyticsPage = ({ onOpenReport }) => {
  const {
    sessions,
    devices,
    analytics,
    permissions,
    currencySettings,
    checkAutoEnd,
    saveCurrencySettings,
    t,
  } = useApp();
  const [calculatorAmount, setCalculatorAmount] = useState('1');
  const [calculatorFrom, setCalculatorFrom] = useState(BASE_CURRENCY);
  const [calculatorTo, setCalculatorTo] = useState(BASE_CURRENCY);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('today');
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().slice(0, 10));
  const [filteredAnalytics, setFilteredAnalytics] = useState(analytics);
  const [tempCurrency, setTempCurrency] = useState({ ...defaultCurrencySettings, ...(currencySettings || {}) });
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => {
    checkAutoEnd();
  }, [checkAutoEnd]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTempCurrency({ ...defaultCurrencySettings, ...(currencySettings || {}) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currencySettings]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const params = { period: analyticsPeriod };
      if (analyticsPeriod === 'custom') {
        params.start = rangeStart;
        params.end = rangeEnd;
      }
      try {
        const response = await axios.get('/analytics/', { params });
        setFilteredAnalytics(response.data);
      } catch {
        setFilteredAnalytics(analytics);
      }
    };
    fetchAnalytics();
  }, [analyticsPeriod, rangeStart, rangeEnd, analytics]);

  const currencyOptions = useMemo(
    () => getCurrencyOptions(currencySettings),
    [currencySettings]
  );
  const localCurrency = currencyOptions.find((option) => option.code !== BASE_CURRENCY)?.code || '';
  const dualCurrencyEnabled = isLocalCurrencyEnabled(currencySettings);
  const isCurrencyOption = (code) => currencyOptions.some((option) => option.code === code);
  const calculatorFromCurrency = isCurrencyOption(calculatorFrom) ? calculatorFrom : BASE_CURRENCY;
  const fallbackToCurrency = dualCurrencyEnabled ? localCurrency : BASE_CURRENCY;
  const configuredToCurrency = isCurrencyOption(calculatorTo) ? calculatorTo : fallbackToCurrency;
  const calculatorToCurrency =
    dualCurrencyEnabled && calculatorFromCurrency === BASE_CURRENCY && configuredToCurrency === BASE_CURRENCY
      ? localCurrency
      : configuredToCurrency;

  const activeSessions = sessions.filter((s) => !s.endTime);
  const activeAnalytics = filteredAnalytics || analytics;
  const todayRevenue = activeAnalytics ? activeAnalytics.completedRevenue : 0;
  const netProfit = activeAnalytics ? activeAnalytics.netProfit : 0;
  const monthlyExpenses = activeAnalytics ? activeAnalytics.monthlyExpenses || 0 : 0;
  const totalActive = activeAnalytics ? activeAnalytics.activeSessions : activeSessions.length;
  const revenueTrend = getRevenueTrend(sessions);
  const canViewNetProfit = permissions?.view_analytics;
  const canViewReport = permissions?.can_view_shift_report || permissions?.view_analytics;
  const canManageCurrency = canManageCurrencySettings(permissions);
  const totalCapacity = devices.reduce((a, b) => a + b.count, 0);
  const calculatorResult = convertMoney(
    Number(calculatorAmount || 0),
    calculatorFromCurrency,
    calculatorToCurrency,
    currencySettings
  );

  const formatUsd = (value) => formatCurrencyAmount(value, BASE_CURRENCY);
  const formatLocal = (value) =>
    dualCurrencyEnabled ? formatCurrencyAmount(usdToLocal(value, currencySettings), localCurrency) : null;
  const swapCalculatorCurrencies = () => {
    setCalculatorFrom(calculatorToCurrency);
    setCalculatorTo(calculatorFromCurrency);
  };
  const updateCurrency = (field, value) => {
    setTempCurrency(prev => ({ ...prev, [field]: value }));
  };
  const toggleLocalCurrency = (enabled) => {
    setTempCurrency(prev => ({
      ...prev,
      local_currency_enabled: enabled,
      local_currency_code: enabled ? (prev.local_currency_code || 'SYP') : prev.local_currency_code,
      local_currency_name: enabled ? (prev.local_currency_name || 'Syrian Pound') : prev.local_currency_name,
    }));
  };
  const handleSaveCurrency = async () => {
    if (tempCurrency.local_currency_enabled) {
      if (!tempCurrency.local_currency_code || !tempCurrency.local_currency_name) {
        alert('Local currency code and name are required.');
        return;
      }
      if (!(Number(tempCurrency.local_units_per_usd) > 0)) {
        alert('Exchange rate must be greater than 0.');
        return;
      }
    }
    setSavingCurrency(true);
    await saveCurrencySettings(tempCurrency);
    setSavingCurrency(false);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
            <i className="fas fa-chart-pie text-indigo-500" />
            {t('nav_analytics')}
          </h2>
          <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">{t('analytics_subtitle')}</p>
        </div>
        {canViewReport && (
          <button
            type="button"
            onClick={onOpenReport}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 shadow-md"
          >
            <i className="fas fa-file-invoice mr-2" />
            {t('daily_report')}
          </button>
        )}
      </div>

      <div className="rounded-xl p-3 sm:p-4 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
              {t('analytics_period')}
            </span>
            <select
              value={analyticsPeriod}
              onChange={(event) => setAnalyticsPeriod(event.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="today">{t('today')}</option>
              <option value="yesterday">{t('yesterday')}</option>
              <option value="this_week">{t('this_week')}</option>
              <option value="this_month">{t('this_month')}</option>
              <option value="custom">{t('custom_range')}</option>
            </select>
          </label>
          {analyticsPeriod === 'custom' && (
            <>
              <label className="block">
                <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {t('date_from')}
                </span>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {t('date_to')}
                </span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(event) => setRangeEnd(event.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          title={t('income_today')}
          value={formatUsd(todayRevenue)}
          secondaryValue={formatLocal(todayRevenue)}
          icon="fa-coins"
          trend={revenueTrend.text}
          trendUp={revenueTrend.up}
          onClick={canViewReport ? onOpenReport : undefined}
        />
        {canViewNetProfit && (
          <StatCard
            title={t('net_profit')}
            value={formatUsd(netProfit)}
            secondaryValue={formatLocal(netProfit)}
            icon="fa-chart-line"
            subText={monthlyExpenses > 0 ? t('after_monthly_expenses') : t('after_inventory')}
            onClick={onOpenReport}
          />
        )}
        {canViewNetProfit && monthlyExpenses > 0 && (
          <StatCard
            title={t('monthly_expenses')}
            value={formatUsd(monthlyExpenses)}
            secondaryValue={formatLocal(monthlyExpenses)}
            icon="fa-receipt"
            subText={t('deducted_from_profit')}
          />
        )}
        <StatCard
          title={t('live_gamers')}
          value={totalActive}
          icon="fa-users"
          subText={t('currently_active')}
        />
        <StatCard
          title={t('stations_active')}
          value={`${activeSessions.length} / ${totalCapacity}`}
          icon="fa-gamepad"
          subText={t('total_capacity')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('currency_calculator')}
              </h3>
              <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">
                {dualCurrencyEnabled ? t('analytics_money_hint') : t('local_currency_disabled')}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-500">
              {dualCurrencyEnabled
                ? `1 ${BASE_CURRENCY} = ${formatCurrencyAmount(currencySettings.local_units_per_usd, localCurrency)}`
                : BASE_CURRENCY}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_0.9fr_auto_0.9fr] gap-3 items-end">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {t('amount')}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calculatorAmount}
                onChange={(event) => setCalculatorAmount(event.target.value)}
                className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {t('from_currency')}
              </span>
              <select
                value={calculatorFromCurrency}
                onChange={(event) => setCalculatorFrom(event.target.value)}
                className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={swapCalculatorCurrencies}
              disabled={currencyOptions.length < 2}
              title="Swap currencies"
              className="h-11 w-11 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center"
            >
              <i className="fas fa-right-left" />
            </button>

            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {t('to_currency')}
              </span>
              <select
                value={calculatorToCurrency}
                onChange={(event) => setCalculatorTo(event.target.value)}
                className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 pt-5 border-t dark:border-gray-700 border-gray-100 flex justify-between items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest dark:text-gray-500 text-gray-400">
              {t('converted_amount')}
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-500">
              {calculatorResult === null
                ? '--'
                : formatCurrencyAmount(calculatorResult, calculatorToCurrency)}
            </span>
          </div>
        </div>

        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('exchange_rate')}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Set the lira value used by analytics and POS previews.</p>
            </div>
            {canManageCurrency && (
              <button
                type="button"
                onClick={handleSaveCurrency}
                disabled={savingCurrency}
                className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black disabled:opacity-60"
              >
                <i className={`fas ${savingCurrency ? 'fa-spinner fa-spin' : 'fa-save'} mr-1`} />
                Save
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b dark:border-gray-700 border-gray-100 pb-3">
              <span className="text-sm dark:text-gray-300 text-gray-600">{BASE_CURRENCY}</span>
              <span className="font-black dark:text-white text-gray-800">{formatCurrencyAmount(1, BASE_CURRENCY)}</span>
            </div>
            {canManageCurrency ? (
              <>
                <label className="flex items-center justify-between gap-3 rounded-lg border dark:border-gray-700 border-gray-200 dark:bg-gray-900 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                  <span>Enable local currency</span>
                  <input
                    type="checkbox"
                    checked={Boolean(tempCurrency.local_currency_enabled)}
                    onChange={event => toggleLocalCurrency(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                {tempCurrency.local_currency_enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        Currency
                      </span>
                      <select
                        value={tempCurrency.local_currency_code || 'SYP'}
                        onChange={event => {
                          const code = event.target.value;
                          updateCurrency('local_currency_code', code);
                          updateCurrency('local_currency_name', code === 'SYP' ? 'Syrian Pound' : 'Lebanese Pound');
                        }}
                        className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="SYP">SYP</option>
                        <option value="LBP">LBP</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        Lira value per 1 USD
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={tempCurrency.local_units_per_usd || ''}
                        onChange={event => updateCurrency('local_units_per_usd', event.target.value)}
                        className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        Currency Name
                      </span>
                      <input
                        type="text"
                        value={tempCurrency.local_currency_name || ''}
                        onChange={event => updateCurrency('local_currency_name', event.target.value)}
                        className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between items-center border-b dark:border-gray-700 border-gray-100 pb-3">
                <span className="text-sm dark:text-gray-300 text-gray-600">
                  {localCurrency || 'SYP / LBP'}
                </span>
                <span className="font-black text-indigo-500">
                  {dualCurrencyEnabled
                    ? formatCurrencyAmount(currencySettings.local_units_per_usd, localCurrency)
                    : '--'}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-400 leading-relaxed">
              {t('configured_rate')}
              {dualCurrencyEnabled ? `: ${currencySettings.local_currency_name || localCurrency}` : ''}
            </p>
          </div>
        </div>
      </div>

      {activeAnalytics?.mostUsedResources?.length > 0 && (
        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500 mb-4">
            {t('most_used_stations')}
          </h3>
          <ul className="space-y-2">
            {activeAnalytics.mostUsedResources.map((r, i) => (
              <li
                key={i}
                className="flex justify-between items-center py-2 border-b last:border-0 dark:border-gray-700 border-gray-100"
              >
                <span className="font-mono text-sm dark:text-white text-gray-800">
                  {r.resource_unit__code}
                </span>
                <span className="text-xs font-bold text-indigo-500">{r.count} {t('sessions_count')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
