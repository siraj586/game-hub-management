import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import { formatDuration, getRevenueTrend } from '../utils/helpers';
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

const AnalyticsPage = () => {
  const {
    sessions,
    devices,
    analytics,
    permissions,
    currencySettings,
    checkAutoEnd,
    saveCurrencySettings,
    showAlert,
    t,
  } = useApp();
  const [calculatorAmount, setCalculatorAmount] = useState('1');
  const [calculatorFrom, setCalculatorFrom] = useState(BASE_CURRENCY);
  const [calculatorTo, setCalculatorTo] = useState(BASE_CURRENCY);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('today');
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDetailDate, setSelectedDetailDate] = useState(new Date().toISOString().slice(0, 10));
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
      const params = { period: analyticsPeriod, detail_date: selectedDetailDate };
      if (analyticsPeriod === 'custom') {
        params.start = rangeStart;
        params.end = rangeEnd;
      }
      try {
        const response = await axios.get('/analytics/', { params });
        setFilteredAnalytics(response.data);
        if (response.data?.detail?.date && response.data.detail.date !== selectedDetailDate) {
          setSelectedDetailDate(response.data.detail.date);
        }
      } catch {
        setFilteredAnalytics(analytics);
      }
    };
    fetchAnalytics();
  }, [analyticsPeriod, rangeStart, rangeEnd, selectedDetailDate, analytics]);

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
  const dailyBreakdown = activeAnalytics?.dailyBreakdown || [];
  const detail = activeAnalytics?.detail || { sessions: [], sales: [] };
  const detailSessions = detail.sessions || [];
  const detailSales = detail.sales || [];
  const todayRevenue = activeAnalytics ? (activeAnalytics.revenueUsd ?? activeAnalytics.completedRevenue ?? 0) : 0;
  const todayRate = activeAnalytics?.todayRate ?? null;
  const unknownCount = activeAnalytics?.unknownTransactionCount ?? 0;
  const netProfit = activeAnalytics ? activeAnalytics.netProfit : 0;
  const monthlyExpenses = activeAnalytics ? activeAnalytics.monthlyExpenses || 0 : 0;
  const salesCapital = dailyBreakdown.reduce((sum, day) => sum + Number(day.salesCapital || 0), 0);
  const sessionProductCost = dailyBreakdown.reduce((sum, day) => sum + Number(day.sessionProductCost || 0), 0);
  const selectedDaySummary = dailyBreakdown.find(day => day.date === detail.date);
  const totalActive = activeAnalytics ? activeAnalytics.activeSessions : activeSessions.length;
  const revenueTrend = getRevenueTrend(sessions);
  const canViewNetProfit = permissions?.view_analytics;
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
        await showAlert(t('local_currency_required'));
        return;
      }
      if (!(Number(tempCurrency.local_units_per_usd) > 0)) {
        await showAlert(t('exchange_rate_required'));
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
          title={t('total_revenue')}
          value={formatUsd(todayRevenue)}
          secondaryValue={
            dualCurrencyEnabled && todayRate
              ? `≈ ${Math.round(todayRevenue * todayRate).toLocaleString()} ${localCurrency} (today's rate)`
              : unknownCount > 0
              ? `${unknownCount} unknown txn${unknownCount > 1 ? 's' : ''} excluded`
              : null
          }
          icon="fa-coins"
          trend={revenueTrend.text}
          trendUp={revenueTrend.up}
        />
        {canViewNetProfit && (
          <StatCard
            title={t('net_profit')}
            value={formatUsd(netProfit)}
            secondaryValue={formatLocal(netProfit)}
            icon="fa-chart-line"
            subText={monthlyExpenses > 0 ? t('after_monthly_expenses') : t('after_inventory')}
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
        {canViewNetProfit && (
          <StatCard
            title={t('sales_capital')}
            value={formatUsd(salesCapital)}
            secondaryValue={formatLocal(salesCapital)}
            icon="fa-boxes-stacked"
            subText={t('standalone_sales_cost')}
          />
        )}
        {canViewNetProfit && (
          <StatCard
            title={t('inventory_cost')}
            value={formatUsd((activeAnalytics?.totalCost || 0))}
            secondaryValue={formatLocal(activeAnalytics?.totalCost || 0)}
            icon="fa-box-open"
            subText={`${t('sales')}: ${formatUsd(salesCapital)} | ${t('sessions')}: ${formatUsd(sessionProductCost)}`}
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

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('daily_reference')}
              </h3>
              <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">{t('daily_reference_hint')}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-500">
              {activeAnalytics?.dateRange?.start} - {activeAnalytics?.dateRange?.end}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="dark:bg-gray-900/80 bg-gray-100 dark:text-gray-300 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">{t('date')}</th>
                  <th className="px-3 py-2 text-right">{t('sessions')}</th>
                  <th className="px-3 py-2 text-right">{t('sales')}</th>
                  <th className="px-3 py-2 text-right">{t('revenue')}</th>
                  <th className="px-3 py-2 text-right">{t('capital')}</th>
                  <th className="px-3 py-2 text-right">{t('profit')}</th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-sm text-gray-500">{t('no_data_available')}</td>
                  </tr>
                ) : dailyBreakdown.map(day => (
                  <tr
                    key={day.date}
                    onClick={() => setSelectedDetailDate(day.date)}
                    className={`border-b dark:border-gray-700 border-gray-200 cursor-pointer transition ${
                      day.date === detail.date
                        ? 'dark:bg-indigo-500/15 bg-indigo-50'
                        : 'hover:dark:bg-gray-700/40 hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs dark:text-white text-gray-800">{day.date}</td>
                    <td className="px-3 py-2 text-right">{day.sessionsCount}</td>
                    <td className="px-3 py-2 text-right">{day.salesCount}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-500">{formatUsd(day.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right text-rose-500">{formatUsd(day.totalCost)}</td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-500">{formatUsd(day.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('selected_day_details')}
              </h3>
              <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">
                {detail.date || selectedDetailDate}
              </p>
            </div>
            {selectedDaySummary && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold">
                  {t('revenue')}: {formatUsd(selectedDaySummary.totalRevenue)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-bold">
                  {t('capital')}: {formatUsd(selectedDaySummary.totalCost)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 font-bold">
                  {t('profit')}: {formatUsd(selectedDaySummary.grossProfit)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-xs font-black uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('session_details')}
              </h4>
              <div className="overflow-x-auto rounded-lg border dark:border-gray-700 border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="dark:bg-gray-900 bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('customer')}</th>
                      <th className="px-3 py-2 text-left">{t('station')}</th>
                      <th className="px-3 py-2 text-left">{t('start_end')}</th>
                      <th className="px-3 py-2 text-right">{t('duration')}</th>
                      <th className="px-3 py-2 text-right">{t('products')}</th>
                      <th className="px-3 py-2 text-right">{t('capital')}</th>
                      <th className="px-3 py-2 text-right">{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailSessions.length === 0 ? (
                      <tr><td colSpan="7" className="py-5 text-center text-gray-500">{t('no_completed_sessions')}</td></tr>
                    ) : detailSessions.map(session => (
                      <tr key={session.id} className="border-t dark:border-gray-700 border-gray-200">
                        <td className="px-3 py-2 font-bold dark:text-white text-gray-800">#{session.id} {session.name}</td>
                        <td className="px-3 py-2">{session.stationId}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(session.startTime).toLocaleTimeString()} - {new Date(session.endTime).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2 text-right">{formatDuration(session.durationMinutes)}</td>
                        <td className="px-3 py-2 text-right">{formatUsd(session.sessionProductRevenue)}</td>
                        <td className="px-3 py-2 text-right text-rose-500">{formatUsd(session.sessionProductCost)}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-500">{formatUsd(session.finalTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-black uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('sales_details')}
              </h4>
              <div className="overflow-x-auto rounded-lg border dark:border-gray-700 border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="dark:bg-gray-900 bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('time')}</th>
                      <th className="px-3 py-2 text-left">{t('user')}</th>
                      <th className="px-3 py-2 text-left">{t('products')}</th>
                      <th className="px-3 py-2 text-right">{t('revenue')}</th>
                      <th className="px-3 py-2 text-right">{t('capital')}</th>
                      <th className="px-3 py-2 text-right">{t('profit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailSales.length === 0 ? (
                      <tr><td colSpan="6" className="py-5 text-center text-gray-500">{t('no_sales_for_day')}</td></tr>
                    ) : detailSales.map(sale => (
                      <tr key={sale.id} className="border-t dark:border-gray-700 border-gray-200">
                        <td className="px-3 py-2 whitespace-nowrap">#{sale.id} {new Date(sale.timestamp).toLocaleTimeString()}</td>
                        <td className="px-3 py-2">{sale.username}</td>
                        <td className="px-3 py-2 max-w-[220px]">
                          {(sale.items || []).map(item => `${item.quantity}x ${item.name}`).join(', ') || '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-500">{formatUsd(sale.totalPrice)}</td>
                        <td className="px-3 py-2 text-right text-rose-500">{formatUsd(sale.totalCost)}</td>
                        <td className="px-3 py-2 text-right font-bold text-indigo-500">{formatUsd(sale.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
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
              title={t('swap_currencies')}
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
              <p className="text-xs text-gray-400 mt-1">{t('exchange_rate_instruction')}</p>
            </div>
            {canManageCurrency && (
              <button
                type="button"
                onClick={handleSaveCurrency}
                disabled={savingCurrency}
                className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black disabled:opacity-60"
              >
                <i className={`fas ${savingCurrency ? 'fa-spinner fa-spin' : 'fa-save'} mr-1`} />
                {t('save_changes')}
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
                  <span>{t('enable_local_currency')}</span>
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
                        {t('currency')}
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
                        {t('local_units_per_usd')}
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
