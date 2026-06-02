import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { defaultCurrencySettings } from '../utils/currency';

const STEP_DEVICE = 0;
const STEP_SYSTEM = 1;
const STEP_CAFE = 2;
const STEP_DONE = 3;

const defaultDevices = [
  { id: 'PC', name: '🖥️ Gaming PC', prefix: 'PC-', count: 4, pricing_strategy: 'HOURLY', base_price: 3.00 },
  { id: 'PS', name: '🎮 PlayStation', prefix: 'PS-', count: 2, pricing_strategy: 'HOURLY', base_price: 5.00 },
];
const defaultCafe = [
  { name: '☕ Coffee', price: 1.50, cost_price: 0.50, stock: 100, minStock: 10 },
  { name: '🥤 Soda', price: 1.00, cost_price: 0.30, stock: 100, minStock: 10 },
  { name: '🍕 Pizza Slice', price: 2.50, cost_price: 1.00, stock: 50, minStock: 5 },
];

const expenseOptions = [
  ['electricity', 'Electricity'],
  ['internet', 'Internet'],
  ['rent', 'Rent'],
  ['salaries', 'Salaries'],
  ['maintenance', 'Maintenance'],
  ['other', 'Other'],
];

// ─── Reusable small components ───────────────────────────────────────────────

const StepIndicator = ({ current }) => {
  const steps = ['Devices', 'Settings', 'Services', 'Done'];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300
              ${i < current ? 'bg-emerald-500 text-white' :
                i === current ? 'bg-indigo-500 text-white ring-4 ring-indigo-500/30' :
                'dark:bg-gray-700 bg-gray-200 dark:text-gray-400 text-gray-400'}`}>
              {i < current ? <i className="fas fa-check text-xs" /> : i + 1}
            </div>
            <span className={`text-[11px] sm:text-xs mt-1 font-medium
              ${i === current ? 'text-indigo-500' : 'dark:text-gray-500 text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-10 sm:w-14 h-0.5 mb-4 mx-1 transition-all duration-500
              ${i < current ? 'bg-emerald-500' : 'dark:bg-gray-700 bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Step 0: Devices ─────────────────────────────────────────────────────────

const DeviceStep = ({ devices, setDevices, shopName, setShopName, onNext, language }) => {
  const addDevice = () => {
    let newId = 'NEW';
    let c = 1;
    while (devices.some(d => d.id === newId)) { newId = `NEW${c}`; c++; }
    setDevices(prev => [...prev, { id: newId, name: '🎮 New Device', prefix: 'ND-', count: 1, pricing_strategy: 'HOURLY', base_price: 5.00 }]);
  };

  const update = (index, field, value) =>
    setDevices(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));

  const remove = (index) =>
    setDevices(prev => prev.filter((_, i) => i !== index));

  const validate = () => {
    if (!shopName.trim()) { alert('Please enter your shop name.'); return; }
    if (devices.length === 0) { alert('Add at least one device to continue.'); return; }
    const ids = new Set();
    for (let d of devices) {
      if (!d.id.trim() || !d.name.trim() || !d.prefix.trim()) { alert('Fill all device fields.'); return; }
      if (ids.has(d.id.toLowerCase())) { alert(`Duplicate ID: "${d.id}"`); return; }
      ids.add(d.id.toLowerCase());
    }
    onNext();
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 mb-4">
          <i className="fas fa-gamepad text-3xl text-indigo-500"></i>
        </div>
        <h2 className="text-2xl font-extrabold dark:text-white text-gray-800">
          {language === 'ar' ? 'ما هو اسم محلك وما هي الأجهزة المتوفرة؟' : 'What is your shop name and what devices do you have?'}
        </h2>
        <p className="dark:text-gray-400 text-gray-500 mt-2 text-sm">
          {language === 'ar' ? 'أدخل اسم محلك ليظهر في النظام والفواتير، ثم أضف كافة أجهزتك.' : 'Enter your shop name to appear in the system and receipts, then add all your gaming stations.'}
        </p>
      </div>

      <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/30">
        <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-2">
          {language === 'ar' ? 'اسم المحل / الصالة (Shop Name)' : 'Shop / Hall Name'}
        </label>
        <input 
          value={shopName} 
          onChange={e => setShopName(e.target.value)}
          placeholder="e.g. Matrix Gaming Lounge"
          className="w-full px-4 py-3 rounded-lg border text-base font-bold dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" 
        />
      </div>

      <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
        {devices.map((d, i) => (
          <div key={i} className="rounded-xl border dark:border-gray-600 border-gray-200 dark:bg-gray-700/40 bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Display Name</label>
                <input value={d.name} onChange={e => update(i, 'name', e.target.value)}
                  placeholder="e.g. 🎮 PlayStation"
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Short ID</label>
                <input value={d.id} onChange={e => update(i, 'id', e.target.value.toUpperCase())}
                  placeholder="e.g. PS"
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Station Prefix</label>
                <input value={d.prefix} onChange={e => update(i, 'prefix', e.target.value)}
                  placeholder="e.g. PS-"
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Count</label>
                <input type="number" min="1" value={d.count}
                    onChange={e => update(i, 'count', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Pricing Strategy</label>
                <select value={d.pricing_strategy} onChange={e => update(i, 'pricing_strategy', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50">
                  <option value="HOURLY">Hourly Rate</option>
                  <option value="FIXED">Fixed Price</option>
                  <option value="PER_GAME">Per Game</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Base Price ($)</label>
                  <input type="number" step="0.5" min="0" value={d.base_price} onChange={e => update(i, 'base_price', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                </div>
                <button onClick={() => remove(i)}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition">
                  <i className="fas fa-trash text-sm"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addDevice}
        className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed dark:border-gray-600 border-gray-300 dark:text-gray-400 text-gray-500 hover:border-indigo-500 hover:text-indigo-500 transition text-sm font-medium">
        <i className="fas fa-plus mr-2"></i> Add Device
      </button>

      <button onClick={validate}
        className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg transition active:scale-95">
        Next: Services <i className="fas fa-arrow-right"></i>
      </button>
    </div>
  );
};

// ─── Step 1: Cafe / Services ─────────────────────────────────────────────────

const SystemStep = ({ currency, setCurrency, expenseSettings, setExpenseSettings, onNext, onBack }) => {
  const updateCurrency = (field, value) => {
    setCurrency(prev => ({ ...prev, [field]: value }));
  };

  const toggleLocalCurrency = (enabled) => {
    setCurrency(prev => ({
      ...prev,
      local_currency_enabled: enabled,
      local_currency_code: enabled ? (prev.local_currency_code || 'SYP') : prev.local_currency_code,
      local_currency_name: enabled ? (prev.local_currency_name || 'Syrian Pound') : prev.local_currency_name,
    }));
  };

  const updateExpense = (field, value) => {
    setExpenseSettings(prev => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (currency.local_currency_enabled) {
      if (!currency.local_currency_code || !currency.local_currency_name) {
        alert('Local currency code and name are required.');
        return;
      }
      if (!(Number(currency.local_units_per_usd) > 0)) {
        alert('Exchange rate must be greater than 0.');
        return;
      }
    }
    onNext();
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
          <i className="fas fa-sliders-h text-3xl text-emerald-500"></i>
        </div>
        <h2 className="text-2xl font-extrabold dark:text-white text-gray-800">Core Settings</h2>
        <p className="dark:text-gray-400 text-gray-500 mt-2 text-sm">
          Set currency and optional monthly expense categories. You can edit these later.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border dark:border-gray-600 border-gray-200 dark:bg-gray-700/40 bg-gray-50 p-4">
          <label className="flex items-center gap-3 text-sm font-bold dark:text-gray-200 text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(currency.local_currency_enabled)}
              onChange={e => toggleLocalCurrency(e.target.checked)}
              className="h-4 w-4"
            />
            Enable local currency beside USD
          </label>

          {currency.local_currency_enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Currency</label>
                <select
                  value={currency.local_currency_code || 'SYP'}
                  onChange={e => {
                    const code = e.target.value;
                    updateCurrency('local_currency_code', code);
                    updateCurrency('local_currency_name', code === 'SYP' ? 'Syrian Pound' : 'Lebanese Pound');
                  }}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
                >
                  <option value="SYP">SYP - Syrian Pound</option>
                  <option value="LBP">LBP - Lebanese Pound</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Currency Name</label>
                <input
                  value={currency.local_currency_name || ''}
                  onChange={e => updateCurrency('local_currency_name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold dark:text-gray-400 text-gray-500 mb-1">Local Units Per 1 USD</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={currency.local_units_per_usd || ''}
                  onChange={e => updateCurrency('local_units_per_usd', e.target.value)}
                  placeholder="13800"
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border dark:border-gray-600 border-gray-200 dark:bg-gray-700/40 bg-gray-50 p-4">
          <h3 className="text-sm font-bold dark:text-gray-200 text-gray-700 mb-3">Monthly Expense Categories</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {expenseOptions.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm dark:text-gray-300 text-gray-600">
                <input
                  type="checkbox"
                  checked={Boolean(expenseSettings[key])}
                  onChange={e => updateExpense(key, e.target.checked)}
                  className="h-4 w-4"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={onBack}
          className="px-5 py-3 rounded-xl dark:bg-gray-700 bg-gray-200 dark:text-gray-300 text-gray-700 font-bold transition hover:opacity-80">
          <i className="fas fa-arrow-left mr-2"></i> Back
        </button>
        <button onClick={validate}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg transition active:scale-95">
          Next: Services <i className="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};

const CafeStep = ({ cafeItems, setCafeItems, onNext, onBack }) => {
  const add = () => setCafeItems(prev => [...prev, { name: '', price: 1.00, cost_price: 0.50, stock: 50, minStock: 5 }]);
  const update = (i, field, val) =>
    setCafeItems(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const remove = (i) => setCafeItems(prev => prev.filter((_, idx) => idx !== i));

  const validate = () => {
    for (let c of cafeItems) {
      if (!c.name.trim()) { alert('All items need a name.'); return; }
      if (c.price < 0) { alert('Prices must be 0 or more.'); return; }
      if (c.stock < 0 || c.minStock < 0) { alert('Stock values must be 0 or more.'); return; }
    }
    onNext();
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-4">
          <i className="fas fa-coffee text-3xl text-amber-500"></i>
        </div>
        <h2 className="text-2xl font-extrabold dark:text-white text-gray-800">Cafe & Services</h2>
        <p className="dark:text-gray-400 text-gray-500 mt-2 text-sm">Add drinks, snacks, or any extras you sell. You can skip this if you don't have a cafe.</p>
      </div>

      <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
        {cafeItems.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-xl border dark:border-gray-600 border-gray-200 dark:bg-gray-700/40 bg-gray-50 p-3">
            <input value={c.name} onChange={e => update(i, 'name', e.target.value)}
              placeholder="Name (e.g. ☕ Coffee)"
              className="col-span-12 sm:col-span-4 px-2 py-2 rounded-lg border text-sm dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50" />
            <input type="number" step="0.25" min="0" value={c.price} placeholder="Sale $"
              onChange={e => update(i, 'price', parseFloat(e.target.value) || 0)}
              className="col-span-6 sm:col-span-2 px-2 py-2 rounded-lg border text-[11px] font-bold text-amber-600 dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50" title="Sale Price" />
            <input type="number" step="0.25" min="0" value={c.cost_price} placeholder="Cost $"
              onChange={e => update(i, 'cost_price', parseFloat(e.target.value) || 0)}
              className="col-span-6 sm:col-span-2 px-2 py-2 rounded-lg border text-[11px] text-gray-500 dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50" title="Cost Price" />
            <input type="number" step="1" min="0" value={c.stock} placeholder="Stock"
              onChange={e => update(i, 'stock', parseInt(e.target.value) || 0)}
              className="col-span-5 sm:col-span-2 px-2 py-2 rounded-lg border text-[11px] font-mono dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50" title="Stock Quantity" />
            <input type="number" step="1" min="0" value={c.minStock ?? 0} placeholder="Min"
              onChange={e => update(i, 'minStock', parseInt(e.target.value) || 0)}
              className="col-span-5 sm:col-span-1 px-2 py-2 rounded-lg border text-[11px] font-mono dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50" title="Minimum Stock" />
            <div className="col-span-2 sm:col-span-1 flex justify-end">
              <button onClick={() => remove(i)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition">
                <i className="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        ))}
        {cafeItems.length === 0 && (
          <div className="text-center py-6 dark:text-gray-500 text-gray-400 text-sm">
            No items yet. Add some or skip to continue.
          </div>
        )}
      </div>

      <button onClick={add}
        className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed dark:border-gray-600 border-gray-300 dark:text-gray-400 text-gray-500 hover:border-amber-500 hover:text-amber-500 transition text-sm font-medium">
        <i className="fas fa-plus mr-2"></i> Add Item
      </button>

      <div className="mt-6 flex gap-3">
        <button onClick={onBack}
          className="px-5 py-3 rounded-xl dark:bg-gray-700 bg-gray-200 dark:text-gray-300 text-gray-700 font-bold transition hover:opacity-80">
          <i className="fas fa-arrow-left mr-2"></i> Back
        </button>
        <button onClick={validate}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg transition active:scale-95">
          Finish Setup <i className="fas fa-check"></i>
        </button>
      </div>
    </div>
  );
};

// ─── Step 2: Done ─────────────────────────────────────────────────────────────

const DoneStep = ({ devicesCount, cafeCount, onGo }) => (
  <div className="text-center py-4">
    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 mb-6">
      <i className="fas fa-check-circle text-5xl text-emerald-500"></i>
    </div>
    <h2 className="text-2xl font-extrabold dark:text-white text-gray-800 mb-2">You're all set!</h2>
    <p className="dark:text-gray-400 text-gray-500 text-sm mb-8">
      Your hall is configured with <span className="font-bold text-indigo-400">{devicesCount} device type{devicesCount !== 1 ? 's' : ''}</span> and{' '}
      <span className="font-bold text-amber-400">{cafeCount} cafe item{cafeCount !== 1 ? 's' : ''}</span>.
      You can always change these from Settings.
    </p>
    <button onClick={onGo}
      className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:shadow-lg transition active:scale-95">
      <i className="fas fa-rocket"></i> Go to Dashboard
    </button>
  </div>
);

// ─── Main SetupPage ───────────────────────────────────────────────────────────

const SetupPage = () => {
  const {
    saveSettings,
    saveMonthlyExpenseSettings,
    completeSetup,
    permissions,
    isAuthenticated,
    systemName: savedSystemName,
    currencySettings,
    monthlyExpenseSettings,
    language,
  } = useApp();
  const [step, setStep] = useState(STEP_DEVICE);
  const [devices, setDevices] = useState(defaultDevices);
  const [cafeItems, setCafeItems] = useState(defaultCafe);
  const [shopName, setShopName] = useState(savedSystemName || '');
  const [currency, setCurrency] = useState({ ...defaultCurrencySettings, ...(currencySettings || {}) });
  const [expenseSettings, setExpenseSettings] = useState({ ...(monthlyExpenseSettings || {}) });

  // Requirement: Only OWNER or superuser allowed
  const canSetup = permissions?.manage_settings;

  if (isAuthenticated && !canSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 dark:bg-gray-900 bg-gray-50">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md text-center border border-red-500/20">
          <i className="fas fa-exclamation-triangle text-5xl text-red-500 mb-4"></i>
          <h2 className="text-2xl font-bold dark:text-white text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Only administrators can access the setup wizard.</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold">Return to App</button>
        </div>
      </div>
    );
  }

  const handleFinish = async () => {
    await saveSettings(devices, cafeItems, shopName, currency);
    await saveMonthlyExpenseSettings(expenseSettings);
    setStep(STEP_DONE);
  };

  const handleGo = () => {
    completeSetup();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-1">
              <i className="fas fa-gamepad text-3xl text-rose-500"></i>
              <h1 className="text-3xl font-extrabold dark:text-white text-gray-800">
                {language === 'ar' ? 'الإعداد ' : 'Initial '}
                <span className="text-rose-500">{language === 'ar' ? 'الأولي' : 'Setup'}</span>
              </h1>
            </div>
            <p className="text-sm dark:text-gray-500 text-gray-400 font-medium">Initial Setup — takes less than a minute</p>
          </div>

          {/* Card */}
          <div className="rounded-3xl shadow-2xl p-8 dark:bg-gray-800/90 bg-white/95 border dark:border-gray-700 border-gray-200">
            <StepIndicator current={step} />

            {step === STEP_DEVICE && (
              <DeviceStep
                devices={devices}
                setDevices={setDevices}
                shopName={shopName}
                setShopName={setShopName}
                onNext={() => setStep(STEP_SYSTEM)}
                language={language}
              />
            )}
            {step === STEP_SYSTEM && (
              <SystemStep
                currency={currency}
                setCurrency={setCurrency}
                expenseSettings={expenseSettings}
                setExpenseSettings={setExpenseSettings}
                onNext={() => setStep(STEP_CAFE)}
                onBack={() => setStep(STEP_DEVICE)}
              />
            )}
            {step === STEP_CAFE && (
              <CafeStep
                cafeItems={cafeItems}
                setCafeItems={setCafeItems}
                onNext={handleFinish}
                onBack={() => setStep(STEP_SYSTEM)}
              />
            )}
            {step === STEP_DONE && (
              <DoneStep
                devicesCount={devices.length}
                cafeCount={cafeItems.length}
                onGo={handleGo}
              />
            )}
          </div>
        </div>
      </div>

      <footer className="py-6 text-center opacity-60">
        <p className="text-sm dark:text-gray-400 text-gray-500">
          &copy; {new Date().getFullYear()} GameHub Pro &nbsp;|&nbsp;
          <span className="text-indigo-500 font-semibold">Designed by Siraj Masoud</span>
        </p>
      </footer>
    </div>
  );
};

export default SetupPage;
