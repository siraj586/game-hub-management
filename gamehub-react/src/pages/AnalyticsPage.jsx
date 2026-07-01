import { useCallback, useEffect, useMemo, useState } from 'react';
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
    showConfirm,
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

  // New UI state
  const [detailTab, setDetailTab] = useState('sessions');
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [harvestingDay, setHarvestingDay] = useState(false);

  useEffect(() => { checkAutoEnd(); }, [checkAutoEnd]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTempCurrency({ ...defaultCurrencySettings, ...(currencySettings || {}) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currencySettings]);

  const fetchAnalytics = useCallback(async () => {
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
  }, [analyticsPeriod, rangeStart, rangeEnd, selectedDetailDate, analytics]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const currencyOptions = useMemo(() => getCurrencyOptions(currencySettings), [currencySettings]);
  const localCurrency = currencyOptions.find((o) => o.code !== BASE_CURRENCY)?.code || '';
  const dualCurrencyEnabled = isLocalCurrencyEnabled(currencySettings);
  const isCurrencyOption = (code) => currencyOptions.some((o) => o.code === code);
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
  const selectedDaySummary = dailyBreakdown.find((day) => day.date === detail.date);
  const totalActive = activeAnalytics ? activeAnalytics.activeSessions : activeSessions.length;
  const revenueTrend = getRevenueTrend(sessions);
  const canViewNetProfit = permissions?.view_analytics;
  const canManageCurrency = canManageCurrencySettings(permissions);
  const canCloseShift = permissions?.can_close_shift;
  const totalCapacity = devices.reduce((a, b) => a + b.count, 0);
  const calculatorResult = convertMoney(
    Number(calculatorAmount || 0),
    calculatorFromCurrency,
    calculatorToCurrency,
    currencySettings,
  );

  const formatUsd = (value) => formatCurrencyAmount(value, BASE_CURRENCY);
  const formatLocal = (value) =>
    dualCurrencyEnabled ? formatCurrencyAmount(usdToLocal(value, currencySettings), localCurrency) : null;

  // Badge showing how a transaction was actually paid
  const PaymentBadge = ({ currency, paidAmount }) => {
    if (!currency || currency === 'UNKNOWN') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-500">
          <i className="fas fa-circle-question text-[9px]" />
          {t('unknown_currency')}
        </span>
      );
    }
    if (currency === BASE_CURRENCY) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-sky-500/15 text-sky-400">
          <i className="fas fa-dollar-sign text-[9px]" />
          USD
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-violet-500/15 text-violet-400">
        <i className="fas fa-coins text-[9px]" />
        {paidAmount != null
          ? `${Number(paidAmount).toLocaleString()} ${currency}`
          : currency}
      </span>
    );
  };

  const swapCalculatorCurrencies = () => {
    setCalculatorFrom(calculatorToCurrency);
    setCalculatorTo(calculatorFromCurrency);
  };
  const updateCurrency = (field, value) => setTempCurrency((prev) => ({ ...prev, [field]: value }));
  const toggleLocalCurrency = (enabled) =>
    setTempCurrency((prev) => ({
      ...prev,
      local_currency_enabled: enabled,
      local_currency_code: enabled ? (prev.local_currency_code || 'SYP') : prev.local_currency_code,
      local_currency_name: enabled ? (prev.local_currency_name || t('syrian_pound')) : prev.local_currency_name,
    }));

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

  const handleHarvestDay = async () => {
    const targetDate = detail.date || selectedDetailDate;
    const confirmed = await showConfirm({
      title: t('harvest_day'),
      message: t('confirm_close_day'),
      confirmLabel: t('harvest_day'),
    });
    if (!confirmed) return;

    setHarvestingDay(true);
    try {
      const res = await axios.post('/daily-reports/close_day/', { date: targetDate });
      const r = res.data;
      const localLine =
        dualCurrencyEnabled && Number(r.actual_local_received) > 0
          ? `\n${localCurrency}: ${Number(r.actual_local_received).toLocaleString()}`
          : '';
      await showAlert(
        `${t('total_revenue')}: ${formatUsd(r.total_revenue)}\n${t('usd_received')}: ${formatUsd(r.actual_usd_received)}${localLine}\n${t('net_profit')}: ${formatUsd(r.net_profit)}`,
        { title: `${t('daily_report')} ✓`, variant: 'success' },
      );
    } catch (e) {
      if (e?.response?.status === 409) {
        await showAlert(e.response.data?.detail || 'This day is already closed.', {
          title: t('daily_report'),
          variant: 'warning',
        });
      } else {
        await showAlert(t('failed_close_day'), { title: t('dialog_error'), variant: 'danger' });
      }
    } finally {
      setHarvestingDay(false);
    }
  };

  const toggleSession = (id) => setExpandedSessionId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Header ── */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
            <i className="fas fa-chart-pie text-indigo-500" />
            {t('nav_analytics')}
          </h2>
          <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">{t('analytics_subtitle')}</p>
        </div>
        {canCloseShift && (
          <button
            type="button"
            onClick={handleHarvestDay}
            disabled={harvestingDay}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-black transition disabled:opacity-60 shadow-sm"
          >
            <i className={`fas ${harvestingDay ? 'fa-spinner fa-spin' : 'fa-calendar-check'}`} />
            {harvestingDay ? t('harvesting') : t('harvest_day')}
          </button>
        )}
      </div>

      {/* ── Period selector ── */}
      <div className="rounded-xl p-3 sm:p-4 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
              {t('analytics_period')}
            </span>
            <select
              value={analyticsPeriod}
              onChange={(e) => setAnalyticsPeriod(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
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
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {t('date_to')}
                </span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* ── KPI stat cards ── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          title={t('total_revenue')}
          value={formatUsd(todayRevenue)}
          secondaryValue={
            dualCurrencyEnabled && todayRate
              ? `≈ ${Math.round(todayRevenue * todayRate).toLocaleString()} ${localCurrency} (${t('today_rate')})`
              : unknownCount > 0
              ? t(unknownCount > 1 ? 'unknown_txns_excluded' : 'unknown_txn_excluded').replace('{count}', unknownCount)
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
            value={formatUsd(activeAnalytics?.totalCost || 0)}
            secondaryValue={formatLocal(activeAnalytics?.totalCost || 0)}
            icon="fa-box-open"
            subText={`${t('sales')}: ${formatUsd(salesCapital)} | ${t('sessions')}: ${formatUsd(sessionProductCost)}`}
          />
        )}
        <StatCard title={t('live_gamers')} value={totalActive} icon="fa-users" subText={t('currently_active')} />
        <StatCard
          title={t('stations_active')}
          value={`${activeSessions.length} / ${totalCapacity}`}
          icon="fa-gamepad"
          subText={t('total_capacity')}
        />
      </div>

      {/* ── Daily breakdown + Day detail ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">

        {/* Daily breakdown table */}
        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('daily_reference')}
              </h3>
              <p className="text-xs dark:text-gray-500 text-gray-400 mt-0.5">{t('daily_reference_hint')}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-500 shrink-0">
              {activeAnalytics?.dateRange?.start} — {activeAnalytics?.dateRange?.end}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border dark:border-gray-700 border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="dark:bg-gray-900/80 bg-gray-100 dark:text-gray-300 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">{t('date')}</th>
                  <th className="px-3 py-2.5 text-right hidden sm:table-cell">{t('sessions')}</th>
                  <th className="px-3 py-2.5 text-right hidden sm:table-cell">{t('sales')}</th>
                  <th className="px-3 py-2.5 text-right">{t('revenue')}</th>
                  <th className="px-3 py-2.5 text-right hidden md:table-cell">{t('capital')}</th>
                  <th className="px-3 py-2.5 text-right">{t('profit')}</th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-sm text-gray-500">{t('no_data_available')}</td>
                  </tr>
                ) : (
                  dailyBreakdown.map((day) => {
                    const isSelected = day.date === detail.date;
                    return (
                      <tr
                        key={day.date}
                        onClick={() => setSelectedDetailDate(day.date)}
                        className={`border-b dark:border-gray-700 border-gray-200 cursor-pointer transition-colors ${
                          isSelected
                            ? 'dark:bg-indigo-500/15 bg-indigo-50'
                            : 'hover:dark:bg-gray-700/40 hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs dark:text-white text-gray-800 whitespace-nowrap">
                          {isSelected && (
                            <i className="fas fa-caret-right text-indigo-500 mr-1.5" />
                          )}
                          {day.date}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                          {day.sessionsCount}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                          {day.salesCount}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-500">
                          {formatUsd(day.totalRevenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-500 hidden md:table-cell">
                          {formatUsd(day.totalCost)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-indigo-500">
                          {formatUsd(day.grossProfit)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Day detail — tabbed */}
        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm flex flex-col gap-4">

          {/* Detail header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500">
                {t('selected_day_details')}
              </h3>
              <p className="text-xs dark:text-gray-500 text-gray-400 mt-0.5">
                {detail.date || selectedDetailDate}
              </p>
            </div>
            {/* Day summary badges */}
            {selectedDaySummary && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold">
                  {formatUsd(selectedDaySummary.totalRevenue)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 font-bold">
                  -{formatUsd(selectedDaySummary.totalCost)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 font-bold">
                  {formatUsd(selectedDaySummary.grossProfit)}
                </span>
                {Number(selectedDaySummary.actualUsdReceived) > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-500 font-bold">
                    {formatUsd(selectedDaySummary.actualUsdReceived)} USD
                  </span>
                )}
                {dualCurrencyEnabled && Number(selectedDaySummary.actualLocalReceived) > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-500 font-bold">
                    {Number(selectedDaySummary.actualLocalReceived).toLocaleString()} {localCurrency}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex rounded-lg overflow-hidden border dark:border-gray-700 border-gray-200 text-xs font-black uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setDetailTab('sessions')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition ${
                detailTab === 'sessions'
                  ? 'bg-indigo-500 text-white'
                  : 'dark:bg-gray-900 bg-gray-50 dark:text-gray-400 text-gray-500 hover:dark:bg-gray-800 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-gamepad" />
              {t('sessions')}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                detailTab === 'sessions' ? 'bg-white/20 text-white' : 'dark:bg-gray-700 bg-gray-200 dark:text-gray-300 text-gray-600'
              }`}>
                {detailSessions.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('sales')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition border-l dark:border-gray-700 border-gray-200 ${
                detailTab === 'sales'
                  ? 'bg-indigo-500 text-white'
                  : 'dark:bg-gray-900 bg-gray-50 dark:text-gray-400 text-gray-500 hover:dark:bg-gray-800 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-shopping-cart" />
              {t('sales')}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                detailTab === 'sales' ? 'bg-white/20 text-white' : 'dark:bg-gray-700 bg-gray-200 dark:text-gray-300 text-gray-600'
              }`}>
                {detailSales.length}
              </span>
            </button>
          </div>

          {/* Sessions tab */}
          {detailTab === 'sessions' && (
            <div className="overflow-x-auto rounded-lg border dark:border-gray-700 border-gray-200">
              {detailSessions.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  <i className="fas fa-gamepad text-2xl mb-2 block opacity-30" />
                  {t('no_completed_sessions')}
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="dark:bg-gray-900 bg-gray-100 dark:text-gray-400 text-gray-600 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2.5 text-left">{t('customer')}</th>
                      <th className="px-3 py-2.5 text-left hidden sm:table-cell">{t('station')}</th>
                      <th className="px-3 py-2.5 text-right hidden md:table-cell">{t('duration')}</th>
                      <th className="px-3 py-2.5 text-right">{t('total')}</th>
                      <th className="px-3 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {detailSessions.map((session) => {
                      const isExpanded = expandedSessionId === session.id;
                      const hasOrders = session.orders && session.orders.length > 0;
                      return (
                        <>
                          <tr
                            key={session.id}
                            className={`border-t dark:border-gray-700 border-gray-200 transition-colors ${
                              hasOrders ? 'cursor-pointer hover:dark:bg-gray-700/40 hover:bg-gray-50' : ''
                            } ${isExpanded ? 'dark:bg-gray-700/30 bg-gray-50' : ''}`}
                            onClick={() => hasOrders && toggleSession(session.id)}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-bold dark:text-white text-gray-800">
                                #{session.id} {session.name}
                              </div>
                              <div className="text-gray-400 mt-0.5 sm:hidden">{session.stationId}</div>
                              <div className="text-gray-400 mt-0.5">
                                {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' — '}
                                {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 dark:text-gray-300 text-gray-600 hidden sm:table-cell">
                              {session.stationId}
                            </td>
                            <td className="px-3 py-2.5 text-right dark:text-gray-300 text-gray-600 hidden md:table-cell">
                              {formatDuration(session.durationMinutes)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="font-bold text-emerald-500">{formatUsd(session.finalTotal)}</div>
                              {session.sessionProductRevenue > 0 && (
                                <div className="text-gray-400 font-normal text-[11px]">
                                  +{formatUsd(session.sessionProductRevenue)} {t('products')}
                                </div>
                              )}
                              <div className="mt-1 flex justify-end">
                                <PaymentBadge
                                  currency={session.paymentCurrency}
                                  paidAmount={session.paidAmount}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {hasOrders && (
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400 text-[10px]`} />
                              )}
                            </td>
                          </tr>
                          {isExpanded && hasOrders && (
                            <tr key={`${session.id}-orders`} className="dark:bg-gray-900/50 bg-gray-50/80">
                              <td colSpan="5" className="px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                  {t('products')}
                                </div>
                                <div className="space-y-1.5">
                                  {session.orders.map((order) => (
                                    <div
                                      key={order.id}
                                      className="flex justify-between items-center text-xs"
                                    >
                                      <span className="dark:text-gray-300 text-gray-700">
                                        {order.quantity}× {order.name}
                                      </span>
                                      <span className="font-bold text-emerald-500">
                                        {formatUsd(order.totalPrice)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Sales tab */}
          {detailTab === 'sales' && (
            <div className="overflow-x-auto rounded-lg border dark:border-gray-700 border-gray-200">
              {detailSales.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  <i className="fas fa-shopping-cart text-2xl mb-2 block opacity-30" />
                  {t('no_sales_for_day')}
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="dark:bg-gray-900 bg-gray-100 dark:text-gray-400 text-gray-600 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2.5 text-left">{t('time')}</th>
                      <th className="px-3 py-2.5 text-left hidden sm:table-cell">{t('user')}</th>
                      <th className="px-3 py-2.5 text-left">{t('products')}</th>
                      <th className="px-3 py-2.5 text-right">{t('revenue')}</th>
                      <th className="px-3 py-2.5 text-right hidden md:table-cell">{t('capital')}</th>
                      <th className="px-3 py-2.5 text-right">{t('profit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailSales.map((sale) => (
                      <tr key={sale.id} className="border-t dark:border-gray-700 border-gray-200">
                        <td className="px-3 py-2.5 whitespace-nowrap dark:text-gray-300 text-gray-700">
                          <span className="font-mono text-gray-400">#{sale.id}</span>{' '}
                          {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div className="text-gray-400 sm:hidden">{sale.username}</div>
                        </td>
                        <td className="px-3 py-2.5 dark:text-gray-300 text-gray-600 hidden sm:table-cell">
                          {sale.username}
                        </td>
                        <td className="px-3 py-2.5 max-w-[180px] dark:text-gray-300 text-gray-700 truncate">
                          {(sale.items || []).map((item) => `${item.quantity}× ${item.name}`).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="font-bold text-emerald-500">{formatUsd(sale.totalPrice)}</div>
                          <div className="mt-1 flex justify-end">
                            <PaymentBadge
                              currency={sale.paymentCurrency}
                              paidAmount={sale.paidAmount}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-500 hidden md:table-cell">
                          {formatUsd(sale.totalCost)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-indigo-500">
                          {formatUsd(sale.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Currency calculator + exchange rate ── */}
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

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.9fr_auto_0.9fr] gap-3 items-end">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {t('amount')}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calculatorAmount}
                onChange={(e) => setCalculatorAmount(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                {t('from_currency')}
              </span>
              <select
                value={calculatorFromCurrency}
                onChange={(e) => setCalculatorFrom(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currencyOptions.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
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
                onChange={(e) => setCalculatorTo(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currencyOptions.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
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

        {/* Exchange rate card */}
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
                className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black disabled:opacity-60 transition shrink-0"
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
                    onChange={(e) => toggleLocalCurrency(e.target.checked)}
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
                        onChange={(e) => {
                          const code = e.target.value;
                          updateCurrency('local_currency_code', code);
                          updateCurrency('local_currency_name', code === 'SYP' ? t('syrian_pound') : t('lebanese_pound'));
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
                        onChange={(e) => updateCurrency('local_units_per_usd', e.target.value)}
                        className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        {t('currency_name')}
                      </span>
                      <input
                        type="text"
                        value={tempCurrency.local_currency_name || ''}
                        onChange={(e) => updateCurrency('local_currency_name', e.target.value)}
                        className="w-full rounded-lg px-3 py-2.5 dark:bg-gray-900 bg-gray-50 border dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between items-center border-b dark:border-gray-700 border-gray-100 pb-3">
                <span className="text-sm dark:text-gray-300 text-gray-600">{localCurrency || 'SYP / LBP'}</span>
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

      {/* ── Most used stations ── */}
      {activeAnalytics?.mostUsedResources?.length > 0 && (
        <div className="rounded-xl p-4 sm:p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-500 mb-4">
            {t('most_used_stations')}
          </h3>
          <ul className="space-y-1.5">
            {activeAnalytics.mostUsedResources.map((r, i) => (
              <li
                key={i}
                className="flex justify-between items-center py-2 border-b last:border-0 dark:border-gray-700 border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-400 w-5 text-center">{i + 1}</span>
                  <span className="font-mono text-sm dark:text-white text-gray-800">{r.resource_unit__code}</span>
                  <span className="text-xs text-gray-400">{r.resource_unit__resource_type__name}</span>
                </div>
                <span className="text-xs font-black text-indigo-500">
                  {r.count} {t('sessions_count')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
