/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import UserManagement from './UserManagement';
import AuditLogsView from './AuditLogsView';
import { hasPermission } from '../utils/permissions';

const expenseCategories = [
  ['electricity', 'expense_electricity'],
  ['internet', 'expense_internet'],
  ['rent', 'expense_rent'],
  ['salaries', 'expense_salaries'],
  ['maintenance', 'expense_maintenance'],
  ['other', 'expense_other'],
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

  const canManageUsers = permissions?.manage_users;
  const canViewLogs = hasPermission(permissions, 'can_view_audit_logs') || permissions?.view_audit_logs;
  const canFullConfig = permissions?.manage_settings; // To add/remove devices
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

  const updateDevice = (index, field, value) => {
    setTempDevices(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const updateDeviceStation = (deviceIndex, stationCode, field, value) => {
    setTempDevices(prev => prev.map((device, index) => {
      if (index !== deviceIndex) return device;
      return {
        ...device,
        stations: (device.stations || []).map(station =>
          station.code === stationCode ? { ...station, [field]: value } : station
        ),
      };
    }));
  };

  const removeDevice = (index) => {
    setTempDevices(prev => prev.filter((_, i) => i !== index));
  };

  const addDevice = () => {
    let newId = 'NEW';
    let counter = 1;
    while (tempDevices.some(d => d.id === newId)) { newId = `NEW${counter}`; counter++; }
    setTempDevices(prev => [...prev, { id: newId, name: t('new_device'), prefix: 'ND-', count: 1, stations: [], pricing_strategy: 'HOURLY', base_price: 5.00 }]);
  };

  const updateExpenseEnabled = (field, value) => {
    setTempExpenseSettings(prev => ({ ...prev, [field]: value }));
  };

  const updateMonthlyExpense = (field, value) => {
    setTempMonthlyExpense(prev => ({ ...prev, [field]: value }));
  };

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
      const settingsSaved = await saveSettings(sanitizedDevices, cafeItems, undefined, null);
      if (!settingsSaved) return;
    }

    const expenseSettingsSaved = await saveMonthlyExpenseSettings(tempExpenseSettings);
    if (!expenseSettingsSaved) return;

    const hasEnabledExpense = expenseCategories.some(([key]) => tempExpenseSettings[key]);
    if (hasEnabledExpense) {
      const monthlyPayload = expenseCategories.reduce((acc, [key]) => ({
        ...acc,
        [key]: Number(tempMonthlyExpense[key] || 0),
      }), {});
      const monthlyExpenseSaved = await saveMonthlyExpense({
        ...monthlyPayload,
        notes: tempMonthlyExpense.notes || '',
        month: `${expenseMonth}-01`,
      });
      if (!monthlyExpenseSaved) return;
    }
    if (onClose) onClose();
  };

  if (!visible) return null;

  const totalStations = tempDevices.reduce((sum, device) => sum + Number(device.count || 0), 0);
  const stoppedStations = tempDevices.reduce(
    (sum, device) => sum + (device.stations || []).filter(station => station.status === 'STOPPED').length,
    0
  );
  const enabledExpenseCategories = expenseCategories.filter(([key]) => tempExpenseSettings[key]);
  const enabledExpenseCount = enabledExpenseCategories.length;
  const inputClass = "w-full px-3 py-2.5 rounded-lg border text-sm dark:bg-gray-900 bg-white dark:border-gray-700 border-gray-200 dark:text-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";
  const labelClass = "block text-[11px] font-black uppercase text-gray-400 mb-1.5";
  const panelClass = "rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-4 sm:p-5";

  return (
    <div className={embedded ? "w-full" : "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300 p-3"}>
      <div className={`bg-white dark:bg-gray-900 w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 ${embedded ? 'shadow-sm' : 'max-w-5xl shadow-2xl'}`}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <i className="fas fa-sliders" />
              </span>
              {t('system_settings')}
            </h2>
            <p className="text-xs sm:text-sm dark:text-gray-500 text-gray-400 mt-1">
              {t('system_settings_subtitle')}
            </p>
          </div>
          {!embedded && (
            <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition">
              <i className="fas fa-times text-xl"></i>
            </button>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="px-4 sm:px-5 py-3 flex gap-2 overflow-x-auto bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          {canFullConfig && (
            <button 
              onClick={() => setActiveTab('system')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap
                ${activeTab === 'system' ? 'bg-indigo-500 text-white shadow-sm' : 'dark:bg-gray-900 bg-white dark:text-gray-400 text-gray-500 hover:text-indigo-500 border dark:border-gray-800 border-gray-200'}
              `}
            >
              <i className="fas fa-cash-register mr-2" />
              {t('tab_system_pos')}
            </button>
          )}
          {canManageUsers && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap
                ${activeTab === 'users' ? 'bg-indigo-500 text-white shadow-sm' : 'dark:bg-gray-900 bg-white dark:text-gray-400 text-gray-500 hover:text-indigo-500 border dark:border-gray-800 border-gray-200'}
              `}
            >
              <i className="fas fa-users-gear mr-2" />
              {t('tab_manage_staff')}
            </button>
          )}
          {canViewLogs && (
            <button 
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap
                ${activeTab === 'logs' ? 'bg-indigo-500 text-white shadow-sm' : 'dark:bg-gray-900 bg-white dark:text-gray-400 text-gray-500 hover:text-indigo-500 border dark:border-gray-800 border-gray-200'}
              `}
            >
              <i className="fas fa-shield-halved mr-2" />
              {t('tab_audit_logs')}
            </button>
          )}
        </div>

        {/* Body */}
        <div className={`p-4 sm:p-5 overflow-y-auto w-full dark:bg-gray-950/40 bg-gray-50/60 ${embedded ? 'max-h-none' : 'max-h-[70vh]'}`}>
          {activeTab === 'system' && canFullConfig && (
            <>
              {/* First-time welcome banner */}
              {tempDevices.length < 0 && (
                <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 text-sm flex gap-3 items-start">
                  <i className="fas fa-hand-wave text-xl mt-0.5"></i>
                  <div>
                    <p className="font-bold">مرحباً! أول مرة تستخدم التطبيق؟</p>
                    <p className="opacity-80 mt-1">أضف أجهزتك (PC، PS5...) وعناصر الكافيه أدناه، ثم احفظ للبدء.</p>
                  </div>
                </div>
              )}

              {tempDevices.length === 0 && (
                <div className="mb-5 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-sm flex gap-3 items-start">
                  <i className="fas fa-circle-info text-xl mt-0.5"></i>
                  <div>
                    <p className="font-black">{t('settings_empty_devices_title')}</p>
                    <p className="opacity-80 mt-1">{t('settings_empty_devices_hint')}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className={panelClass}>
                  <p className="text-[11px] uppercase font-black text-gray-400">{t('device_types')}</p>
                  <p className="text-2xl font-black dark:text-white text-gray-800 mt-1">{tempDevices.length}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('configured_play_categories')}</p>
                </div>
                <div className={panelClass}>
                  <p className="text-[11px] uppercase font-black text-gray-400">{t('stations')}</p>
                  <p className="text-2xl font-black dark:text-white text-gray-800 mt-1">{totalStations}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('stopped_count').replace('{count}', stoppedStations)}</p>
                </div>
                <div className={panelClass}>
                  <p className="text-[11px] uppercase font-black text-gray-400">{t('monthly_expenses')}</p>
                  <p className="text-2xl font-black dark:text-white text-gray-800 mt-1">{enabledExpenseCount}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('tracked_cost_types')}</p>
                </div>
              </div>

              <div className={`${panelClass} mb-5`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                      <i className="fas fa-receipt text-rose-500"></i> {t('monthly_expenses')}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">{t('monthly_expenses_hint')}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/10 text-rose-500">
                    {t('active_count').replace('{count}', enabledExpenseCount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                  {expenseCategories.map(([key, labelKey]) => (
                    <label
                      key={key}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
                        tempExpenseSettings[key]
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                          : 'dark:border-gray-700 border-gray-200 dark:bg-gray-900 bg-gray-50 text-gray-500'
                      }`}
                    >
                      <span>{t(labelKey)}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(tempExpenseSettings[key])}
                        onChange={e => updateExpenseEnabled(key, e.target.checked)}
                        className="h-4 w-4"
                      />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>{t('month')}</label>
                    <input
                      type="month"
                      value={expenseMonth}
                      onChange={e => setExpenseMonth(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {enabledExpenseCategories.map(([key, labelKey]) => (
                    <div key={key}>
                      <label className={labelClass}>{t(labelKey)} ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tempMonthlyExpense[key] || ''}
                        onChange={e => updateMonthlyExpense(key, e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  ))}
                  {enabledExpenseCount > 0 && (
                    <div className="sm:col-span-3">
                      <label className={labelClass}>{t('notes')}</label>
                      <input
                        type="text"
                        value={tempMonthlyExpense.notes || ''}
                        onChange={e => updateMonthlyExpense('notes', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Devices */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <i className="fas fa-gamepad text-indigo-500"></i> {t('gaming_devices')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{t('gaming_devices_hint')}</p>
                </div>
                {canFullConfig && (
                  <button onClick={addDevice} className="px-4 py-2.5 text-sm bg-indigo-500 text-white hover:bg-indigo-600 rounded-xl font-black transition shadow-sm">
                    <i className="fas fa-plus mr-2"></i> {t('add_device')}
                  </button>
                )}
              </div>
              <div className="mb-4 space-y-3">
                {tempDevices.map((d, index) => (
                  <div key={index} className={panelClass}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <p className="text-sm font-black dark:text-white text-gray-800 truncate">{d.name || t('device_type_fallback')}</p>
                        <p className="text-xs text-gray-400 font-mono">{d.id || 'ID'} · {d.count || 0} {t('stations')}</p>
                      </div>
                      {canFullConfig && (
                        <button onClick={() => removeDevice(index)} className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-500/10 transition" title={t('remove_device_type')}>
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-3">
                      <div className="lg:col-span-2">
                        <label className={labelClass}>ID</label>
                        <input type="text" value={d.id} onChange={e => updateDevice(index, 'id', e.target.value)}
                          className={inputClass} />
                      </div>
                      <div className="lg:col-span-4">
                        <label className={labelClass}>{t('display_name')}</label>
                        <input type="text" value={d.name} onChange={e => updateDevice(index, 'name', e.target.value)}
                          className={inputClass} />
                      </div>
                      <div className="lg:col-span-2">
                        <label className={labelClass}>{t('prefix')}</label>
                        <input type="text" value={d.prefix} onChange={e => updateDevice(index, 'prefix', e.target.value)}
                          className={inputClass} />
                      </div>
                      <div className="lg:col-span-2">
                        <label className={labelClass}>{t('count')}</label>
                        <input type="number" min="1" value={d.count} onChange={e => updateDevice(index, 'count', parseInt(e.target.value) || 1)}
                          className={inputClass} />
                      </div>
                      <div className="lg:col-span-2">
                        <label className={labelClass}>{t('base_price')} ($)</label>
                        <input type="number" step="0.5" min="0" value={d.base_price} onChange={e => updateDevice(index, 'base_price', parseFloat(e.target.value) || 0)}
                          className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>{t('pricing_strategy')}</label>
                        <select value={d.pricing_strategy} onChange={e => updateDevice(index, 'pricing_strategy', e.target.value)}
                          className={inputClass}>
                          <option value="HOURLY">{t('hourly_rate')}</option>
                          <option value="FIXED">{t('fixed_price')}</option>
                          <option value="PER_GAME">{t('per_game')}</option>
                        </select>
                      </div>
                    </div>
                    {(d.stations || []).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className={labelClass}>{t('station_status')}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                          {d.stations.map(station => (
                            <div key={station.code} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-2">
                              <span className="text-xs font-mono dark:text-white text-gray-800">{station.code}</span>
                              <button
                                type="button"
                                onClick={() => updateDeviceStation(
                                  index,
                                  station.code,
                                  'status',
                                  station.status === 'STOPPED' ? 'ACTIVE' : 'STOPPED'
                                )}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                                  station.status === 'STOPPED'
                                    ? 'bg-red-500/10 text-red-500'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {station.status === 'STOPPED' ? t('stopped') : t('working')}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </>
          )}

          {activeTab === 'users' && canManageUsers && <UserManagement />}
          {activeTab === 'logs' && canViewLogs && <AuditLogsView />}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center gap-3 flex-wrap">
          {canFullConfig && (
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
              className="px-4 py-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:hover:bg-red-900/20 rounded-xl transition font-medium flex items-center gap-2"
            >
              <i className="fas fa-rotate-left"></i> {t('rerun_setup')}
            </button>
          )}
          {canFullConfig && (
            <button 
              onClick={handleSave} 
              className={`px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition shadow-lg
                ${activeTab !== 'system' && 'hidden'}
              `}
            >
              <i className="fas fa-save mr-1"></i> {t('save_changes')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
