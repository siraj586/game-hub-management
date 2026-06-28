/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import UserManagement from './UserManagement';
import AuditLogsView from './AuditLogsView';
import { hasPermission } from '../utils/permissions';

const expenseCategories = [
  ['electricity', 'expense_electricity', 'fa-bolt'],
  ['internet', 'expense_internet', 'fa-wifi'],
  ['rent', 'expense_rent', 'fa-building'],
  ['salaries', 'expense_salaries', 'fa-users'],
  ['maintenance', 'expense_maintenance', 'fa-wrench'],
  ['other', 'expense_other', 'fa-ellipsis'],
];

const deviceSnapshot = (deviceList) =>
  deviceList.map(device => ({
    id: (device.id || '').trim(),
    name: (device.name || '').trim(),
    prefix: (device.prefix || '').trim(),
    count: Number(device.count || 0),
    pricing_strategy: device.pricing_strategy || 'HOURLY',
    base_price: Number(device.base_price || 0),
    stations: (device.stations || [])
      .map(station => ({
        code: station.code,
        status: station.status || 'ACTIVE',
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  }));

const FieldGroup = ({ label, children, col }) => (
  <div className={col}>
    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border text-sm dark:bg-gray-900 bg-white dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition';

const SectionHeader = ({ icon, iconColor, title, description, badge }) => (
  <div className="flex items-start gap-3 mb-5">
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
      <i className={`fas ${icon} text-base`} />
    </span>
    <div className="flex-1 min-w-0">
      <h3 className="font-extrabold text-gray-800 dark:text-white text-base">{title}</h3>
      {description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
    </div>
    {badge}
  </div>
);

const StatPill = ({ label, value, color }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${color}`}>
    <span className="text-lg font-extrabold">{value}</span>
    <span className="opacity-70">{label}</span>
  </div>
);

const SettingsModal = ({ isOpen, onClose, embedded = false }) => {
  const {
    devices,
    cafeItems,
    monthlyExpenseSettings,
    monthlyExpenses,
    saveSettings,
    saveMonthlyExpenseSettings,
    saveMonthlyExpense,
    resetSetup,
    permissions,
    showAlert,
    showConfirm,
    t,
  } = useApp();

  const [tempDevices, setTempDevices] = useState([]);
  const [tempExpenseSettings, setTempExpenseSettings] = useState({});
  const [expenseMonth, setExpenseMonth] = useState(new Date().toISOString().slice(0, 7));
  const [tempMonthlyExpense, setTempMonthlyExpense] = useState({});
  const [activeTab, setActiveTab] = useState('system');
  const [expandedDevice, setExpandedDevice] = useState(null);

  const canManageUsers = permissions?.manage_users;
  const canViewLogs = hasPermission(permissions, 'can_view_audit_logs') || permissions?.view_audit_logs;
  const canFullConfig = permissions?.manage_settings;
  const visible = embedded || isOpen;

  useEffect(() => {
    if (visible) {
      setTempDevices(JSON.parse(JSON.stringify(devices)));
      setTempExpenseSettings({ ...(monthlyExpenseSettings || {}) });
      const currentExpense = monthlyExpenses.find(item => item.month?.slice(0, 7) === expenseMonth);
      setTempMonthlyExpense({
        month: `${expenseMonth}-01`,
        electricity: currentExpense?.electricity || 0,
        internet: currentExpense?.internet || 0,
        rent: currentExpense?.rent || 0,
        salaries: currentExpense?.salaries || 0,
        maintenance: currentExpense?.maintenance || 0,
        other: currentExpense?.other || 0,
        notes: currentExpense?.notes || '',
      });
      if (canFullConfig) setActiveTab('system');
      else if (canManageUsers) setActiveTab('users');
      else if (canViewLogs) setActiveTab('logs');
    }
  }, [visible, devices, monthlyExpenseSettings, monthlyExpenses, expenseMonth, canFullConfig, canManageUsers, canViewLogs]);

  const updateDevice = (index, field, value) =>
    setTempDevices(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));

  const updateDeviceStation = (deviceIndex, stationCode, field, value) =>
    setTempDevices(prev => prev.map((device, index) => {
      if (index !== deviceIndex) return device;
      return {
        ...device,
        stations: (device.stations || []).map(station =>
          station.code === stationCode ? { ...station, [field]: value } : station
        ),
      };
    }));

  const removeDevice = (index) => {
    setTempDevices(prev => prev.filter((_, i) => i !== index));
    if (expandedDevice === index) setExpandedDevice(null);
  };

  const addDevice = () => {
    let newId = 'NEW';
    let counter = 1;
    while (tempDevices.some(d => d.id === newId)) { newId = `NEW${counter}`; counter++; }
    const newIndex = tempDevices.length;
    setTempDevices(prev => [
      ...prev,
      { id: newId, name: t('new_device'), prefix: 'ND-', count: 1, stations: [], pricing_strategy: 'HOURLY', base_price: 5.00 },
    ]);
    setExpandedDevice(newIndex);
  };

  const updateExpenseEnabled = (field, value) =>
    setTempExpenseSettings(prev => ({ ...prev, [field]: value }));

  const updateMonthlyExpense = (field, value) =>
    setTempMonthlyExpense(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const deviceIds = new Set();
    const sanitizedDevices = tempDevices.map(d => ({
      ...d,
      id: (d.id || '').trim(),
      count: d.count <= 0 || isNaN(d.count) ? 1 : d.count,
    }));
    for (let d of sanitizedDevices) {
      if (!d.id || !d.name || !d.prefix) { await showAlert(t('settings_devices_required')); return; }
      if (deviceIds.has(d.id.toLowerCase())) { await showAlert(t('settings_duplicate_device').replace('{id}', d.id)); return; }
      deviceIds.add(d.id.toLowerCase());
    }

    const devicesChanged =
      JSON.stringify(deviceSnapshot(sanitizedDevices)) !== JSON.stringify(deviceSnapshot(devices));
    if (devicesChanged) {
      const saved = await saveSettings(sanitizedDevices, cafeItems, undefined, null);
      if (!saved) return;
    }

    const expenseSettingsSaved = await saveMonthlyExpenseSettings(tempExpenseSettings);
    if (!expenseSettingsSaved) return;

    const hasEnabledExpense = expenseCategories.some(([key]) => tempExpenseSettings[key]);
    if (hasEnabledExpense) {
      const monthlyPayload = expenseCategories.reduce((acc, [key]) => ({
        ...acc,
        [key]: Number(tempMonthlyExpense[key] || 0),
      }), {});
      const monthlySaved = await saveMonthlyExpense({
        ...monthlyPayload,
        notes: tempMonthlyExpense.notes || '',
        month: `${expenseMonth}-01`,
      });
      if (!monthlySaved) return;
    }
    if (onClose) onClose();
  };

  if (!visible) return null;

  const totalStations = tempDevices.reduce((sum, d) => sum + Number(d.count || 0), 0);
  const stoppedStations = tempDevices.reduce(
    (sum, d) => sum + (d.stations || []).filter(s => s.status === 'STOPPED').length, 0
  );
  const enabledExpenseCategories = expenseCategories.filter(([key]) => tempExpenseSettings[key]);
  const enabledExpenseCount = enabledExpenseCategories.length;

  const tabs = [
    canFullConfig && {
      id: 'system',
      icon: 'fa-sliders',
      label: t('tab_system_pos'),
      color: 'text-indigo-500',
      activeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    canManageUsers && {
      id: 'users',
      icon: 'fa-users-gear',
      label: t('tab_manage_staff'),
      color: 'text-violet-500',
      activeBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    canViewLogs && {
      id: 'logs',
      icon: 'fa-shield-halved',
      label: t('tab_audit_logs'),
      color: 'text-emerald-500',
      activeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
  ].filter(Boolean);

  return (
    <div className={embedded ? 'w-full' : 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 transition-opacity'}>
      <div className={`bg-white dark:bg-gray-900 w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col ${embedded ? 'shadow-sm' : 'max-w-5xl max-h-[90vh] shadow-2xl'}`}>

        {/* ── Header ── */}
        <div className="shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <i className="fas fa-sliders text-base" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold dark:text-white text-gray-800 leading-tight">
                {t('system_settings')}
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">{t('settings_subtitle')}</p>
            </div>
          </div>
          {!embedded && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <i className="fas fa-times" />
            </button>
          )}
        </div>

        {/* ── Body: sidebar + content ── */}
        <div className={`flex flex-1 overflow-hidden ${embedded ? '' : ''}`}>

          {/* Sidebar Navigation */}
          <aside className="shrink-0 w-52 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-3 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left
                  ${activeTab === tab.id
                    ? `${tab.activeBg} shadow-sm`
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800'
                  }`}
              >
                <i className={`fas ${tab.icon} w-4 text-center ${activeTab === tab.id ? '' : tab.color}`} />
                <span className="truncate">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                )}
              </button>
            ))}

            {/* Divider + Reset */}
            {canFullConfig && (
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={async () => {
                    const confirmed = await showConfirm({
                      title: t('rerun_setup'),
                      message: t('rerun_setup_confirm'),
                      confirmText: t('dialog_reset'),
                      variant: 'danger',
                    });
                    if (confirmed) resetSetup();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left"
                >
                  <i className="fas fa-rotate-left w-4 text-center" />
                  {t('rerun_setup')}
                </button>
              </div>
            )}
          </aside>

          {/* Content Area */}
          <div className={`flex-1 overflow-y-auto ${embedded ? '' : ''}`}>
            <div className="p-5 space-y-6">

              {/* ════ SYSTEM TAB ════ */}
              {activeTab === 'system' && canFullConfig && (
                <>
                  {/* Summary Stats */}
                  <div className="flex flex-wrap gap-2">
                    <StatPill
                      value={tempDevices.length}
                      label={t('device_types')}
                      color="border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300"
                    />
                    <StatPill
                      value={totalStations}
                      label={t('stations')}
                      color="border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300"
                    />
                    {stoppedStations > 0 && (
                      <StatPill
                        value={stoppedStations}
                        label={t('stopped_count').replace('{count}', '').trim() || 'stopped'}
                        color="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300"
                      />
                    )}
                    <StatPill
                      value={enabledExpenseCount}
                      label={t('tracked_cost_types')}
                      color="border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300"
                    />
                  </div>

                  {/* ── Monthly Expenses Section ── */}
                  <section className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-white dark:bg-gray-800 px-5 pt-5 pb-4">
                      <SectionHeader
                        icon="fa-receipt"
                        iconColor="bg-rose-500/10 text-rose-500"
                        title={t('monthly_expenses')}
                        description={t('monthly_expenses_hint')}
                        badge={
                          enabledExpenseCount > 0 && (
                            <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-500">
                              {t('active_count').replace('{count}', enabledExpenseCount)}
                            </span>
                          )
                        }
                      />

                      {/* Toggle Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {expenseCategories.map(([key, labelKey, icon]) => {
                          const enabled = Boolean(tempExpenseSettings[key]);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => updateExpenseEnabled(key, !enabled)}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/40
                                ${enabled
                                  ? 'border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 shadow-sm'
                                  : 'dark:border-gray-700 border-gray-200 dark:bg-gray-900 bg-gray-50 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                              <i className={`fas ${icon} text-base ${enabled ? '' : 'opacity-40'}`} />
                              <span>{t(labelKey)}</span>
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition
                                ${enabled ? 'border-rose-500 bg-rose-500' : 'border-gray-300 dark:border-gray-600'}`}
                              >
                                {enabled && <i className="fas fa-check text-white text-[8px]" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Values Input — only when categories are enabled */}
                    {enabledExpenseCount > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-5 py-4">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-3">
                          <i className="fas fa-calendar-alt mr-1.5" />
                          {t('month')} — {expenseMonth}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <FieldGroup label={t('month')} col="">
                            <input
                              type="month"
                              value={expenseMonth}
                              onChange={e => setExpenseMonth(e.target.value)}
                              className={inputClass}
                            />
                          </FieldGroup>
                          {enabledExpenseCategories.map(([key, labelKey]) => (
                            <FieldGroup key={key} label={`${t(labelKey)} ($)`} col="">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tempMonthlyExpense[key] || ''}
                                onChange={e => updateMonthlyExpense(key, e.target.value)}
                                className={inputClass}
                                placeholder="0.00"
                              />
                            </FieldGroup>
                          ))}
                        </div>
                        <div className="mt-3">
                          <FieldGroup label={t('notes')} col="">
                            <input
                              type="text"
                              value={tempMonthlyExpense.notes || ''}
                              onChange={e => updateMonthlyExpense('notes', e.target.value)}
                              className={inputClass}
                              placeholder="..."
                            />
                          </FieldGroup>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ── Gaming Devices Section ── */}
                  <section>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                          <i className="fas fa-gamepad text-base" />
                        </span>
                        <div>
                          <h3 className="font-extrabold text-gray-800 dark:text-white text-base">{t('gaming_devices')}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">{t('gaming_devices_hint')}</p>
                        </div>
                      </div>
                      {canFullConfig && (
                        <button
                          onClick={addDevice}
                          className="shrink-0 px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-2"
                        >
                          <i className="fas fa-plus text-xs" />
                          {t('add_device')}
                        </button>
                      )}
                    </div>

                    {/* Empty State */}
                    {tempDevices.length === 0 && (
                      <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10 p-8 text-center">
                        <i className="fas fa-gamepad text-4xl text-indigo-300 dark:text-indigo-700 mb-3 block" />
                        <p className="font-extrabold text-gray-700 dark:text-gray-300">{t('settings_empty_devices_title')}</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{t('settings_empty_devices_hint')}</p>
                        <button
                          onClick={addDevice}
                          className="mt-4 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition shadow-sm"
                        >
                          <i className="fas fa-plus mr-2" />
                          {t('add_device')}
                        </button>
                      </div>
                    )}

                    <div className="space-y-3">
                      {tempDevices.map((d, index) => {
                        const isExpanded = expandedDevice === index;
                        const stationCount = (d.stations || []).length;
                        const stoppedCount = (d.stations || []).filter(s => s.status === 'STOPPED').length;
                        const strategyIcon = d.pricing_strategy === 'HOURLY' ? 'fa-clock' : d.pricing_strategy === 'FIXED' ? 'fa-tag' : 'fa-gamepad';

                        return (
                          <div
                            key={index}
                            className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 transition-all"
                          >
                            {/* Card Header — click to expand */}
                            <button
                              type="button"
                              onClick={() => setExpandedDevice(isExpanded ? null : index)}
                              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left"
                            >
                              <span className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 text-sm">
                                <i className="fas fa-desktop" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-extrabold text-gray-800 dark:text-white text-sm truncate">
                                  {d.name || t('device_type_fallback')}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-gray-400">{d.id || '—'}</span>
                                  <span className="text-gray-300 dark:text-gray-600">·</span>
                                  <span className="text-[10px] text-gray-400">{d.count} {t('stations')}</span>
                                  <span className="text-gray-300 dark:text-gray-600">·</span>
                                  <span className="text-[10px] text-gray-400">
                                    <i className={`fas ${strategyIcon} mr-1 opacity-60`} />
                                    ${d.base_price}
                                  </span>
                                  {stoppedCount > 0 && (
                                    <span className="text-[10px] text-orange-500 font-bold">
                                      <i className="fas fa-pause-circle mr-1" />{stoppedCount} {t('stopped')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {canFullConfig && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={e => { e.stopPropagation(); removeDevice(index); }}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeDevice(index); } }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-xs"
                                    title={t('remove_device_type')}
                                  >
                                    <i className="fas fa-trash" />
                                  </span>
                                )}
                                <i className={`fas fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </button>

                            {/* Expanded Form */}
                            {isExpanded && (
                              <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-5">
                                {/* Basic Fields */}
                                <div>
                                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-3">
                                    {t('display_name')} & ID
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <FieldGroup label="ID" col="">
                                      <input
                                        type="text"
                                        value={d.id}
                                        onChange={e => updateDevice(index, 'id', e.target.value)}
                                        className={inputClass}
                                        placeholder="PS5"
                                      />
                                    </FieldGroup>
                                    <FieldGroup label={t('display_name')} col="sm:col-span-2">
                                      <input
                                        type="text"
                                        value={d.name}
                                        onChange={e => updateDevice(index, 'name', e.target.value)}
                                        className={inputClass}
                                        placeholder="PlayStation 5"
                                      />
                                    </FieldGroup>
                                    <FieldGroup label={t('prefix')} col="">
                                      <input
                                        type="text"
                                        value={d.prefix}
                                        onChange={e => updateDevice(index, 'prefix', e.target.value)}
                                        className={inputClass}
                                        placeholder="PS-"
                                      />
                                    </FieldGroup>
                                  </div>
                                </div>

                                {/* Pricing */}
                                <div>
                                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-3">
                                    <i className="fas fa-tag mr-1.5" />
                                    {t('pricing_strategy')}
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <FieldGroup label={t('pricing_strategy')} col="">
                                      <select
                                        value={d.pricing_strategy}
                                        onChange={e => updateDevice(index, 'pricing_strategy', e.target.value)}
                                        className={inputClass}
                                      >
                                        <option value="HOURLY">
                                          <i className="fas fa-clock" /> {t('hourly_rate')}
                                        </option>
                                        <option value="FIXED">{t('fixed_price')}</option>
                                        <option value="PER_GAME">{t('per_game')}</option>
                                      </select>
                                    </FieldGroup>
                                    <FieldGroup label={`${t('base_price')} ($)`} col="">
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={d.base_price}
                                        onChange={e => updateDevice(index, 'base_price', parseFloat(e.target.value) || 0)}
                                        className={inputClass}
                                        placeholder="0.00"
                                      />
                                    </FieldGroup>
                                    <FieldGroup label={t('count')} col="">
                                      <input
                                        type="number"
                                        min="1"
                                        value={d.count}
                                        onChange={e => updateDevice(index, 'count', parseInt(e.target.value) || 1)}
                                        className={inputClass}
                                      />
                                    </FieldGroup>
                                  </div>
                                </div>

                                {/* Station Status */}
                                {stationCount > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                                        <i className="fas fa-circle-dot mr-1.5" />
                                        {t('station_status')}
                                      </p>
                                      <span className="text-[10px] text-gray-400">
                                        {stationCount - stoppedCount}/{stationCount} {t('working')}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                      {d.stations.map(station => {
                                        const isActive = station.status !== 'STOPPED';
                                        return (
                                          <button
                                            key={station.code}
                                            type="button"
                                            onClick={() => updateDeviceStation(
                                              index, station.code, 'status',
                                              isActive ? 'STOPPED' : 'ACTIVE'
                                            )}
                                            className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1
                                              ${isActive
                                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-400'
                                                : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-500 focus:ring-red-400'
                                              }`}
                                            title={isActive ? t('working') : t('stopped')}
                                          >
                                            <span className="font-mono">{station.code}</span>
                                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}

              {/* ════ USERS TAB ════ */}
              {activeTab === 'users' && canManageUsers && (
                <section>
                  <SectionHeader
                    icon="fa-users-gear"
                    iconColor="bg-violet-500/10 text-violet-500"
                    title={t('tab_manage_staff')}
                    description={t('staff_accounts_permissions')}
                  />
                  <UserManagement />
                </section>
              )}

              {/* ════ LOGS TAB ════ */}
              {activeTab === 'logs' && canViewLogs && (
                <section>
                  <SectionHeader
                    icon="fa-shield-halved"
                    iconColor="bg-emerald-500/10 text-emerald-500"
                    title={t('tab_audit_logs')}
                    description={t('audit_logs_hint')}
                  />
                  <AuditLogsView />
                </section>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        {activeTab === 'system' && canFullConfig && (
          <div className="shrink-0 px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-end gap-3">
            {!embedded && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                {t('cancel') || 'Cancel'}
              </button>
            )}
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-xl font-bold text-sm transition shadow-sm flex items-center gap-2"
            >
              <i className="fas fa-check" />
              {t('save_changes')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
