/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { hasAnyPermission, isOwnerUser } from '../utils/permissions';
import { defaultCurrencySettings } from '../utils/currency';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
const UNAUTHORIZED_MESSAGE = 'ليس لديك صلاحية لتنفيذ هذه العملية';

// Setup Axios
axios.defaults.baseURL = 'http://127.0.0.1:8000/api';

const normalizeSession = (session) => ({
  ...session,
  startTime: session.startTime || session.start_time || null,
  endTime: session.endTime || session.end_time || null,
  stationId: session.stationId || session.station_id || session.resource_code || session.resourceId || null,
  resourceId: session.resourceId || session.resource_id || session.stationId || session.station_id || null,
  sessionType: session.sessionType || session.session_type || null,
  deviceType: session.deviceType || session.device_type || null,
  pricePerHour: session.pricePerHour ?? session.price_per_hour ?? 0,
  fixedPrice: session.fixedPrice ?? session.fixed_price ?? 0,
  totalCost: session.totalCost ?? session.total_cost ?? 0,
  ordersCost: session.ordersCost ?? session.orders_cost ?? 0,
  durationMinutes: session.durationMinutes ?? session.duration_minutes ?? 0,
  liveCost: session.liveCost ?? session.live_cost ?? session.totalCost ?? session.total_cost ?? 0,
  elapsedTime: session.elapsedTime ?? session.elapsed_time ?? session.durationMinutes ?? session.duration_minutes ?? 0,
  effectiveRate: session.effectiveRate ?? session.effective_rate ?? session.pricePerHour ?? session.price_per_hour ?? 0,
  finalTotal: session.finalTotal ?? session.final_total ?? session.totalCost ?? session.total_cost ?? 0,
  pausedDuration: session.pausedDuration ?? session.paused_duration ?? 0,
  paymentMethod: session.paymentMethod ?? session.payment_method ?? 'CASH',
  plannedEndTime: session.plannedEndTime || session.planned_end_time || null,
  isPaused: session.isPaused ?? session.is_paused ?? false,
  lastPauseTime: session.lastPauseTime || session.last_pause_time || null,
});

const normalizeCafeItem = (item, currencySettings = defaultCurrencySettings) => ({
  id: item.id,
  name: item.name,
  category: item.category_name || item.category_code || item.category || '',
  price: parseFloat(item.sale_price ?? item.price ?? 0),
  cost_price: parseFloat(item.cost_price) || 0,
  local_price: item.local_sale_price !== null && item.local_sale_price !== undefined ? parseFloat(item.local_sale_price) : null,
  local_cost_price: item.local_cost_price !== null && item.local_cost_price !== undefined ? parseFloat(item.local_cost_price) : null,
  local_currency_code: currencySettings.local_currency_code || '',
  original_price_currency: item.original_price_currency || 'USD',
  original_price_amount: item.original_price_amount,
  original_cost_currency: item.original_cost_currency || 'USD',
  original_cost_amount: item.original_cost_amount,
  stock: item.quantity_in_stock ?? item.stock ?? 0,
  minStock: item.minimum_stock_level ?? item.minStock ?? 0,
  lowStock: item.is_low_stock ?? item.lowStock ?? ((item.quantity_in_stock ?? item.stock ?? 0) <= (item.minimum_stock_level ?? item.minStock ?? 0)),
  isActive: item.is_active ?? item.isActive ?? true,
});

const normalizeResourceUnit = (unit) => ({
  id: unit.id,
  code: unit.code,
  displayName: unit.display_name || unit.code,
  resourceType: unit.resource_type,
  status: unit.status || 'ACTIVE',
  isStopped: unit.is_stopped ?? unit.status === 'STOPPED',
  statusLabel: unit.status_label || (unit.status === 'STOPPED' ? 'Stopped' : 'Working'),
});

const setupStorageKey = (userId) => `gamehub_setup_complete_${userId}`;
const readSetupComplete = (userId) =>
  userId ? localStorage.getItem(setupStorageKey(userId)) === 'true' : false;

const rememberRecentUser = (username) => {
  if (!username) return;
  const key = 'gamehub_recent_users';
  const list = JSON.parse(localStorage.getItem(key) || '[]').filter(
    (u) => u.toLowerCase() !== username.toLowerCase()
  );
  list.unshift(username);
  localStorage.setItem(key, JSON.stringify(list.slice(0, 5)));
};

/** Wipe browser-side session data (tokens, setup flags, cached names). */
export const clearLocalAppData = ({ keepPreferences = true } = {}) => {
  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith('gamehub_') && key !== 'gamehub_setup_complete') return;
    if (keepPreferences && key === 'gamehub_language') return;
    localStorage.removeItem(key);
  });
  localStorage.removeItem('gamehub_setup_complete');
  delete axios.defaults.headers.common['Authorization'];
};

const apiErrorMessage = (error, fallback = 'Something went wrong') => {
  if (error?.response?.status === 403) return UNAUTHORIZED_MESSAGE;
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  return JSON.stringify(data);
};

const getListResults = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const fetchList = async (url, config = {}) => {
  const response = await axios.get(url, config);
  return getListResults(response.data);
};

const translations = {
  en: {
    income_today: "Income Today",
    net_profit: "Net Profit",
    live_gamers: "Live Gamers",
    stations_active: "Stations Active",
    start_session: "START SESSION",
    live_session_monitor: "LIVE SESSION MONITOR",
    settings: "Settings",
    daily_report: "Daily Report",
    logout: "Logout",
    cafe_panel_title: "CAFE & EXTRAS",
    add: "Add",
    stock: "Stock",
    session_history: "SESSION HISTORY",
    today: "Today",
    all_time: "All Time",
    customer: "Customer",
    type: "Type",
    time: "Time",
    duration: "Duration",
    total: "Total",
    actions: "Actions",
    pause: "Pause",
    resume: "Resume",
    end_pay: "End & Pay",
    after_inventory: "After inventory costs",
    after_monthly_expenses: "After inventory and monthly expenses",
    monthly_expenses: "Monthly Expenses",
    deducted_from_profit: "Deducted from monthly profit",
    currently_active: "Currently active",
    total_capacity: "Total capacity",
    no_active: "No active gaming sessions. Start a new session!",
    customer_name: "Customer Name",
    device_type: "Device Type",
    station: "Station",
    prepaid: "Prepaid",
    postpaid: "Postpaid",
    price_hr: "Price/Hr ($)",
    hrs: "Hrs",
    fixed_cost: "Fixed Cost ($)",
    play_cost: "Play Cost",
    cafe_orders: "Cafe Orders",
    search: "Search sessions...",
    receipt: "Receipt",
    no_devices_configured: "No gaming devices configured.",
    add_devices_settings: "Add some in Settings to start a session.",
    select_device_station: "Please select a device type and station.",
    price_must_be_positive: "Price must be >= 0",
    duration_must_be_positive: "Duration must be > 0",
    is_already_occupied: "is already occupied!",
    leave_blank_auto_number: "Leave blank for auto-numbering",
    price_edit_settings_only: "Price can only be edited from Settings",
    price_per_game: "Price Per Game ($)",
    strategy: "Strategy",
    quick_sell: "Quick Sell",
    add_order_to_session: "Add order to session:",
    select_active_session: "-- Select Active Session --",
    no_cafe_items: "No cafe items configured. Add them from Sales > Inventory.",
    nav_inventory: "Inventory",
    inventory_subtitle: "Manage cafe items, prices, stock, and low-stock alerts",
    item_name: "Item name",
    sale_price: "Sale price",
    cost_price: "Cost price",
    min_stock: "Min stock",
    add_item: "Add item",
    save_inventory: "Save inventory",
    low_stock: "Low stock",
    inactive: "Inactive",
    paused: "PAUSED",
    open_time: "OPEN TIME",
    est_total: "Est. Total",
    end_session: "End Session",
    view_only: "View Only",
    recent_activity: "Recent Activity",
    total_sessions: "total sessions",
    no_completed_sessions: "No completed sessions yet",
    start_end: "Start/End",
    earnings: "Earnings",
    action: "Action",
    s_id: "S-ID",
    nav_sessions: "Sessions",
    nav_sales: "POS Sale",
    nav_analytics: "Analytics",
    nav_settings: "Settings",
    add_buffet_to_session: "Add buffet item",
    buffet: "Buffet",
    tap_session_for_buffet: "Tap the buffet button on a session to add items",
    analytics_subtitle: "Revenue and occupancy overview",
    analytics_period: "Analytics Period",
    yesterday: "Yesterday",
    this_week: "This Week",
    this_month: "This Month",
    custom_range: "Custom Range",
    date_from: "From Date",
    date_to: "To Date",
    sales_page_subtitle: "Sell cafe items and manage simple stock in one place",
    cart: "Cart",
    cart_empty: "Cart is empty",
    complete_sale: "Complete sale",
    close: "Close",
    most_used_stations: "Most used stations",
    sessions_count: "sessions",
    currency_calculator: "Currency Calculator",
    exchange_rate: "Exchange Rate",
    converted_amount: "Converted Amount",
    amount: "Amount",
    from_currency: "From",
    to_currency: "To",
    configured_rate: "Configured rate",
    analytics_money_hint: "Money values are shown in USD and the selected local currency.",
    local_currency_disabled: "Enable SYP or LBP here to show dual-currency analytics.",
    system_not_configured: "System Not Configured",
    configure_devices_hint: "Add gaming devices in settings to start sessions.",
    quick_config: "Quick Configuration",
    rerun_setup: "Re-run Setup Wizard",
    active: "active",
  },
  ar: {
    income_today: "إيرادات اليوم",
    net_profit: "صافي الربح",
    live_gamers: "اللاعبين الحاليين",
    stations_active: "الأجهزة النشطة",
    start_session: "بدء جلسة جديدة",
    live_session_monitor: "مراقبة الجلسات الحالية",
    settings: "الإعدادات",
    daily_report: "التقرير اليومي",
    logout: "تسجيل الخروج",
    cafe_panel_title: "الكافيه والإضافات",
    add: "إضافة",
    stock: "المخزون",
    session_history: "سجل الجلسات",
    today: "اليوم",
    all_time: "كل الوقت",
    customer: "الزبون",
    type: "النوع",
    time: "الوقت",
    duration: "المدة",
    total: "الإجمالي",
    actions: "إجراءات",
    pause: "إيقاف",
    resume: "استئناف",
    end_pay: "إنهاء ودفع",
    after_inventory: "بعد خصم تكاليف المخزون",
    currently_active: "نشط حالياً",
    total_capacity: "السعة الإجمالية",
    no_active: "لا يوجد جلسات نشطة. ابدأ جلسة جديدة!",
    customer_name: "اسم الزبون",
    device_type: "نوع الجهاز",
    station: "الجهاز",
    prepaid: "مسبق الدفع",
    postpaid: "مفتوح (آجل)",
    price_hr: "السعر/ساعة ($)",
    hrs: "الساعات",
    fixed_cost: "سعر ثابت ($)",
    play_cost: "تكلفة اللعب",
    cafe_orders: "طلبات الكافيه",
    search: "ابحث عن جلسة...",
    receipt: "إيصال",
    no_devices_configured: "لا يوجد أجهزة معرّفة.",
    add_devices_settings: "أضف أجهزة من الإعدادات للبدء.",
    select_device_station: "الرجاء اختيار نوع الجهاز والجهاز.",
    price_must_be_positive: "يجب أن يكون السعر أكبر من أو يساوي الصفر",
    duration_must_be_positive: "يجب أن تكون المدة أكبر من الصفر",
    is_already_occupied: "مشغول حالياً!",
    leave_blank_auto_number: "اتركه فارغاً لترقيم تلقائي (زبون #رقم)",
    price_edit_settings_only: "سعر السيشن لايعدل الا من الاعدادات",
    price_per_game: "السعر لكل لعبة ($)",
    strategy: "نظام التسعير",
    quick_sell: "بيع سريع",
    add_order_to_session: "أضف طلب للجلسة:",
    select_active_session: "-- اختر جلسة نشطة --",
    no_cafe_items: "لا يوجد عناصر كافيه. أضفها من البيع > المخزون.",
    nav_inventory: "المخزون",
    inventory_subtitle: "إدارة منتجات الكافيه والأسعار والمخزون والتنبيهات",
    item_name: "اسم المنتج",
    sale_price: "سعر البيع",
    cost_price: "التكلفة",
    min_stock: "الحد الأدنى",
    add_item: "إضافة صنف",
    save_inventory: "حفظ المخزون",
    low_stock: "مخزون منخفض",
    inactive: "غير نشط",
    paused: "مؤقت",
    open_time: "وقت مفتوح",
    est_total: "المجموع المقدر",
    end_session: "إنهاء الجلسة",
    view_only: "عرض فقط",
    recent_activity: "النشاط الأخير",
    total_sessions: "إجمالي الجلسات",
    no_completed_sessions: "لا يوجد جلسات مكتملة بعد",
    start_end: "البداية/النهاية",
    earnings: "الأرباح",
    action: "إجراء",
    s_id: "الرقم",
    nav_sessions: "الجلسات",
    nav_sales: "بيع مباشر",
    nav_analytics: "الإحصائيات",
    nav_settings: "الإعدادات",
    add_buffet_to_session: "إضافة من البوفيه",
    buffet: "بوفيه",
    tap_session_for_buffet: "اضغط زر البوفيه على الجلسة لإضافة عناصر",
    analytics_subtitle: "ملخص الإيرادات والإشغال",
    analytics_period: "فترة الإحصائيات",
    yesterday: "أمس",
    this_week: "هذا الأسبوع",
    this_month: "هذا الشهر",
    custom_range: "فترة مخصصة",
    date_from: "من تاريخ",
    date_to: "إلى تاريخ",
    sales_page_subtitle: "بيع منتجات الكافيه وإدارة المخزون البسيط من نفس المكان",
    cart: "السلة",
    cart_empty: "السلة فارغة",
    complete_sale: "إتمام البيع",
    close: "إغلاق",
    most_used_stations: "أكثر المحطات استخداماً",
    sessions_count: "جلسة",
    currency_calculator: "حاسبة العملات",
    exchange_rate: "سعر الصرف",
    converted_amount: "القيمة المحولة",
    amount: "المبلغ",
    from_currency: "من",
    to_currency: "إلى",
    configured_rate: "السعر المعتمد",
    analytics_money_hint: "تظهر القيم المالية بالدولار وبالعملة المحلية المختارة.",
    local_currency_disabled: "فعّل الليرة السورية أو اللبنانية هنا لعرض الإحصائيات بالعملتين.",
    system_not_configured: "النظام غير مُعدّ",
    configure_devices_hint: "أضف الأجهزة من الإعدادات لبدء الجلسات.",
    quick_config: "إعداد سريع",
    rerun_setup: "إعادة معالج الإعداد",
    active: "نشط",
  }
};

export const AppProvider = ({ children }) => {
  const [sessions, setSessions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [cafeItems, setCafeItems] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [features, setFeatures] = useState({});
  const [currencySettings, setCurrencySettings] = useState(defaultCurrencySettings);
  const [monthlyExpenseSettings, setMonthlyExpenseSettings] = useState({});
  const [monthlyExpenses, setMonthlyExpenses] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    const s = localStorage.getItem('darkMode');
    return s !== null ? JSON.parse(s) : true;
  });
  const [systemName, setSystemName] = useState(() => localStorage.getItem('gamehub_system_name') || 'GameHub Pro');
  const [language, setLanguage] = useState(() => localStorage.getItem('gamehub_language') || 'en');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState({
    loading: true,
    needs_setup: false,
    shop_name: '',
  });

  const applyAuthSession = async (authPayload) => {
    const token = authPayload.token;
    localStorage.setItem('gamehub_token', token);
    axios.defaults.headers.common['Authorization'] = `Token ${token}`;
    const userId = authPayload.user_id;
    setIsAuthenticated(true);
    setCurrentUser({
      id: userId,
      username: authPayload.username,
      role: authPayload.role,
      is_superuser: authPayload.is_superuser,
    });
    if (authPayload.shop_name) {
      setSystemName(authPayload.shop_name);
      localStorage.setItem('gamehub_system_name', authPayload.shop_name);
    }
    setHasCompletedSetup(readSetupComplete(userId));
    rememberRecentUser(authPayload.username);
    await fetchData();
  };

  const fetchBootstrapStatus = async () => {
    try {
      const res = await axios.get('/auth/bootstrap/status/');
      if (res.data.needs_setup) {
        clearLocalAppData({ keepPreferences: true });
        setIsAuthenticated(false);
        setHasCompletedSetup(false);
        setCurrentUser(null);
        setPermissions({});
      }
      setBootstrapStatus({
        loading: false,
        needs_setup: res.data.needs_setup,
        shop_name: res.data.shop_name || '',
      });
      return res.data;
    } catch {
      setBootstrapStatus({ loading: false, needs_setup: false, shop_name: '' });
      return { needs_setup: false };
    }
  };

  const fetchData = async () => {
    try {
      const fetchCurrentUserProfile = async () => {
        try {
          const res = await axios.get('/auth/me/');
          const profilePermissions = res.data.permissions || {};
          setCurrentUser({
            id: res.data.id,
            username: res.data.username,
            email: res.data.email,
            role: res.data.role,
            is_superuser: res.data.is_superuser,
          });
          if (res.data.shop_name) {
            setSystemName(res.data.shop_name);
            localStorage.setItem('gamehub_system_name', res.data.shop_name);
          }
          setHasCompletedSetup(readSetupComplete(res.data.id));
          setPermissions(profilePermissions);
          setFeatures(res.data.features || {});
          return profilePermissions;
        } catch (e) {
          console.error("Failed to fetch current user profile", e);
          return {};
        }
      };

      const profilePermissions = await fetchCurrentUserProfile();
      let fetchedCurrencySettings = defaultCurrencySettings;
      try {
        const currencyRes = await axios.get('/currency-settings/');
        fetchedCurrencySettings = currencyRes.data || defaultCurrencySettings;
        setCurrencySettings(fetchedCurrencySettings);
      } catch {
        setCurrencySettings(defaultCurrencySettings);
      }
      if (profilePermissions.manage_settings) {
        try {
          const expenseSettingsRes = await axios.get('/monthly-expense-settings/');
          setMonthlyExpenseSettings(expenseSettingsRes.data || {});
        } catch {
          setMonthlyExpenseSettings({});
        }
        try {
          const expenseList = await fetchList('/monthly-expenses/', { params: { page_size: 100 } });
          setMonthlyExpenses(expenseList);
        } catch {
          setMonthlyExpenses([]);
        }
      } else {
        setMonthlyExpenseSettings({});
        setMonthlyExpenses([]);
      }
      const canFetchInventory = hasAnyPermission(profilePermissions, [
        'can_add_session_order',
        'can_create_standalone_sale',
        'can_manage_inventory',
        'can_update_stock',
      ]);

      const [typeRes, unitRes, sessionsList] = await Promise.all([
        axios.get('/resource-types/'),
        fetchList('/resource-units/').catch(() => []),
        fetchList('/sessions/', { params: { page_size: 100 } }).catch(() => []),
      ]);

      const types = typeRes.data;
      const units = unitRes;

      const mappedDevices = types.map(t => {
        const typeUnits = units.filter(u => u.resource_type === t.id);
        return {
          id: t.code,
          name: t.name,
          prefix: t.prefix,
          count: typeUnits.length,
          stations: typeUnits.map(normalizeResourceUnit),
          pricing_strategy: t.pricing_strategy,
          base_price: parseFloat(t.base_price) || 0
        };
      });
      setDevices(mappedDevices);

      try {
        const usersList = await fetchList('/users/');
        setUsers(usersList);
      } catch {
        setUsers([]);
      }

      try {
        const logsList = await fetchList('/audit-logs/', { params: { page_size: 100 } });
        setAuditLogs(logsList);
      } catch {
        setAuditLogs([]);
      }

      if (canFetchInventory) {
        try {
          const itemParams = profilePermissions.manage_settings ? { include_inactive: 'true' } : {};
          const itemsList = await fetchList('/inventory-items/', { params: itemParams });
          setCafeItems(itemsList.map(item => normalizeCafeItem(item, fetchedCurrencySettings)));
        } catch {
          setCafeItems([]);
        }
      } else {
        setCafeItems([]);
      }
      setSessions(sessionsList.map(normalizeSession));
    } catch (e) {
      console.error("Failed to fetch data", e);
      if (e.response?.status === 401) logout();
    }
  };

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);
  
  useEffect(() => {
    localStorage.setItem('gamehub_language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'ar' : 'en');

  const login = async (username, password) => {
    try {
      const res = await axios.post('/auth/login/', { username, password });
      await applyAuthSession(res.data);
      return { success: true };
    } catch (e) {
      console.error("Login failed", e);
      return {
        success: false,
        message: apiErrorMessage(e, 'بيانات الدخول غير صحيحة'),
      };
    }
  };

  const bootstrapOwner = async ({ username, password, email, shop_name }) => {
    try {
      const res = await axios.post('/auth/bootstrap/register/', {
        username,
        password,
        email,
        shop_name,
      });
      await applyAuthSession(res.data);
      setBootstrapStatus({ loading: false, needs_setup: false, shop_name: res.data.shop_name || shop_name });
      return { success: true };
    } catch (e) {
      return {
        success: false,
        message: apiErrorMessage(e, 'تعذّر إنشاء حساب المالك'),
      };
    }
  };

  const makeDirectSale = async (items) => {
    try {
      // items: [{ id, quantity }]
      const response = await axios.post('/sales/', { items });
      await fetchData();
      return { success: true, data: response.data };
    } catch (e) {
      alert(apiErrorMessage(e, 'Error processing sale'));
      return { success: false };
    }
  };

  const closeDayReport = async (date = null) => {
    try {
      const payload = date ? { date } : {};
      const res = await axios.post('/daily-reports/close_day/', payload);
      await fetchData(); // refresh analytics + inventory stock
      return { success: true, data: res.data };
    } catch (e) {
      const msg = apiErrorMessage(e, 'Unknown error');
      return { success: false, error: msg };
    }
  };

  const addUser = async (userData) => {
    try {
      await axios.post('/users/', userData);
      await fetchData();
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error adding user'));
      return false;
    }
  };

  const updateUser = async (id, userData) => {
    try {
      await axios.patch(`/users/${id}/`, userData);
      await fetchData();
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error updating user'));
      return false;
    }
  };

  const deleteUser = async (id) => {
    if (window.confirm("Delete user?")) {
      try {
        await axios.delete(`/users/${id}/`);
        await fetchData();
      } catch (e) { alert(apiErrorMessage(e, 'Error deleting user')); }
    }
  };

  const clearAuditLogs = async () => {
    if (window.confirm("Clear all logs permanently?")) {
      try {
        await axios.post('/audit-logs/clear_logs/');
        setAuditLogs([]);
      } catch (e) { alert(apiErrorMessage(e, 'Error clearing logs')); }
    }
  };

  const logout = async () => {
    clearLocalAppData({ keepPreferences: true });
    setIsAuthenticated(false);
    setHasCompletedSetup(false);
    setSessions([]);
    setDevices([]);
    setCafeItems([]);
    setAnalytics(null);
    setUsers([]);
    setAuditLogs([]);
    setCurrentUser(null);
    setPermissions({});
    setFeatures({});
    setCurrencySettings(defaultCurrencySettings);
    setMonthlyExpenseSettings({});
    setMonthlyExpenses([]);
    await fetchBootstrapStatus();
  };

  // Initialize bootstrap status, then restore session only if system is already set up
  useEffect(() => {
    const init = async () => {
      const status = await fetchBootstrapStatus();
      if (status.needs_setup) return;
      const token = localStorage.getItem('gamehub_token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`;
        setIsAuthenticated(true);
        await fetchData();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSetup = () => {
    if (currentUser?.id) {
      localStorage.removeItem(setupStorageKey(currentUser.id));
    }
    setHasCompletedSetup(false);
  };

  const completeSetup = () => {
    if (currentUser?.id) {
      localStorage.setItem(setupStorageKey(currentUser.id), 'true');
    }
    setHasCompletedSetup(true);
  };

  const isStationActive = useCallback((stationId) => {
    return sessions.some(s => !s.endTime && s.stationId === stationId);
  }, [sessions]);

  const addSession = async (sessionData) => {
    try {
      // sessionData from UI: { name, sessionType, durationHours, stationId, deviceType, pricePerHour, fixedPrice }
      const res = await axios.post('/sessions/', sessionData);
      setSessions(prev => [normalizeSession(res.data), ...prev]);
    } catch (e) {
      alert(apiErrorMessage(e, 'Error starting session'));
    }
  };

  const endSession = async (sessionId, discount = 0) => {
    try {
      const res = await axios.post(`/sessions/${sessionId}/end/`, { discount });
      // Update local state smoothly
      setSessions(prev => prev.map(s => s.id === sessionId ? normalizeSession(res.data) : s));
    } catch (e) {
      alert(apiErrorMessage(e, 'Error ending session'));
    }
  };

  const deleteSession = async (sessionId) => {
    if (window.confirm("Delete this session permanently?")) {
      try {
        await axios.delete(`/sessions/${sessionId}/`);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } catch (e) {
        alert(apiErrorMessage(e, 'Error deleting session'));
      }
    }
  };

  const togglePauseSession = async (session) => {
    try {
      const action = session.isPaused ? 'resume' : 'pause';
      const res = await axios.post(`/sessions/${session.id}/${action}/`);
      setSessions(prev => prev.map(s => s.id === session.id ? normalizeSession(res.data) : s));
    } catch (e) {
      alert(apiErrorMessage(e, 'Error pausing/resuming session'));
    }
  };

  const addOrderToSession = async (sessionId, inventoryItemId, name, price, quantity = 1) => {
    try {
      const res = await axios.post(`/sessions/${sessionId}/add_order/`, {
        inventoryItemId,
        name,
        price,
        quantity,
      });
      setSessions(prev => prev.map(s => s.id === sessionId ? normalizeSession(res.data) : s));
      // Refresh inventory items to reflect stock change
      const itemList = await fetchList('/inventory-items/');
      const mappedCafe = itemList.map(item => normalizeCafeItem(item, currencySettings));
      setCafeItems(mappedCafe);
    } catch (e) {
      alert(apiErrorMessage(e, 'Error adding order'));
    }
  };

  const removeOrderFromSession = async (sessionId, orderId) => {
    try {
      const res = await axios.post(`/sessions/${sessionId}/remove_order/`, { orderId });
      setSessions(prev => prev.map(s => s.id === sessionId ? normalizeSession(res.data) : s));
      // Refresh inventory items to reflect stock change
      const itemList = await fetchList('/inventory-items/');
      const mappedCafe = itemList.map(item => normalizeCafeItem(item, currencySettings));
      setCafeItems(mappedCafe);
    } catch (e) {
      alert(apiErrorMessage(e, 'Error removing order'));
    }
  };


  const checkAutoEnd = useCallback(async () => {
    try {
      if (isAuthenticated) {
        const sessionsList = await fetchList('/sessions/', { params: { page_size: 100 } });
        setSessions(sessionsList.map(normalizeSession));
        try {
          const anRes = await axios.get('/analytics/', { params: { period: 'today' } });
          setAnalytics(anRes.data);
        } catch {
          setAnalytics(null);
        }
      }
    } catch {
      setSessions([]);
    }
  }, [isAuthenticated]);

  const saveSettings = async (newDevices, newCafeItems, newSystemName, newCurrencySettings = null) => {
    try {
      const centerName = newSystemName || systemName || 'Game Center';
      if (newCurrencySettings) {
        const currencyRes = await axios.patch('/currency-settings/', newCurrencySettings);
        setCurrencySettings(currencyRes.data || defaultCurrencySettings);
      }
      
      const resource_types = newDevices.map(d => ({
        code: d.id,
        name: d.name,
        prefix: d.prefix,
        pricing_strategy: d.pricing_strategy || 'HOURLY',
        base_price: d.base_price || 0,
      }));

      const resource_units = [];
      newDevices.forEach(d => {
        const existingStations = d.stations || [];
        for (let i = 1; i <= d.count; i++) {
          const code = `${d.prefix}${i.toString().padStart(2, '0')}`;
          const existingStation = existingStations.find(station => station.code === code);
          resource_units.push({
            code,
            resource_type_code: d.id,
            display_name: existingStation?.displayName || `${d.name} ${i}`,
            status: existingStation?.status || 'ACTIVE',
          });
        }
      });

      const inventory_categories = [{ name: 'Cafe', code: 'CAFE' }];
      const inventory_items = newCafeItems.map((c) => ({
        name: c.name,
        sale_price: c.price,
        sale_price_currency: c.price_currency || 'USD',
        cost_price: c.cost_price || 0,
        cost_price_currency: c.cost_currency || 'USD',
        category_code: 'CAFE',
        quantity_in_stock: c.stock !== undefined ? c.stock : 0,
        minimum_stock_level: c.minStock !== undefined ? c.minStock : 0,
        is_active: c.isActive !== false,
      }));

      await axios.post('/setup/bulk/', {
        resource_types,
        resource_units,
        inventory_categories,
        inventory_items,
        feature_flags: [
          { key: 'shop_name', enabled: true, config: { name: centerName } },
        ],
      });
      setSystemName(centerName);
      localStorage.setItem('gamehub_system_name', centerName);
      await fetchData();
    } catch (e) {
      alert(apiErrorMessage(e, 'Error saving settings'));
    }
  };

  const saveInventoryItems = async (items) => {
    try {
      const categories = await fetchList('/inventory-categories/');
      let cafeCategory = categories.find((category) => category.code === 'CAFE');
      const canEditPricing = isOwnerUser(currentUser);
      if (!cafeCategory && canEditPricing) {
        const categoryRes = await axios.post('/inventory-categories/', { name: 'Cafe', code: 'CAFE' });
        cafeCategory = categoryRes.data;
      }

      const savedItems = [];
      for (const item of items) {
        if (!canEditPricing && !item.id) continue;
        const payload = canEditPricing
          ? {
              name: item.name,
              sale_price: item.price,
              sale_price_currency: item.price_currency || item.original_price_currency || 'USD',
              cost_price: item.cost_price || 0,
              cost_price_currency: item.cost_currency || item.original_cost_currency || 'USD',
              quantity_in_stock: item.stock ?? 0,
              minimum_stock_level: item.minStock ?? 0,
              is_active: item.isActive !== false,
              category: cafeCategory.id,
            }
          : { quantity_in_stock: item.stock ?? 0 };

        const response = item.id
          ? await axios.patch(`/inventory-items/${item.id}/`, payload)
          : await axios.post('/inventory-items/', payload);
        savedItems.push(response.data);
      }

      setCafeItems(savedItems.map(item => normalizeCafeItem(item, currencySettings)));
      await fetchData();
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error saving inventory'));
      return false;
    }
  };

  const saveMonthlyExpenseSettings = async (settings) => {
    try {
      const res = await axios.patch('/monthly-expense-settings/', settings);
      setMonthlyExpenseSettings(res.data || {});
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error saving monthly expense settings'));
      return false;
    }
  };

  const saveMonthlyExpense = async (expense) => {
    try {
      const res = await axios.post('/monthly-expenses/', expense);
      setMonthlyExpenses(prev => {
        const next = prev.filter(item => item.month !== res.data.month);
        return [res.data, ...next];
      });
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error saving monthly expenses'));
      return false;
    }
  };

  const saveCurrencySettings = async (settings) => {
    try {
      const currencyRes = await axios.patch('/currency-settings/', settings);
      setCurrencySettings(currencyRes.data || defaultCurrencySettings);
      await fetchData();
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error saving currency settings'));
      return false;
    }
  };

  const correctSession = async (sessionId, correction) => {
    try {
      const res = await axios.post(`/sessions/${sessionId}/correct/`, correction);
      setSessions(prev => prev.map(s => s.id === sessionId ? normalizeSession(res.data) : s));
      const itemList = await fetchList('/inventory-items/', { params: { include_inactive: 'true' } });
      setCafeItems(itemList.map(item => normalizeCafeItem(item, currencySettings)));
      await checkAutoEnd();
      return true;
    } catch (e) {
      alert(apiErrorMessage(e, 'Error correcting session'));
      return false;
    }
  };

  const exportDailyReport = () => {
    const todayStr = new Date().toDateString();
    const todaysCompleted = sessions.filter(s => s.endTime && new Date(s.endTime).toDateString() === todayStr);
    if (todaysCompleted.length === 0) { alert("No completed sessions today."); return; }
    const headers = ["Session ID", "Customer", "Station", "Start", "End", "Duration", "Earnings"];
    const rows = todaysCompleted.map(s => [
      s.id, s.name, s.resourceId || s.stationId,
      new Date(s.startTime).toLocaleTimeString(),
      new Date(s.endTime).toLocaleTimeString(),
      `${Math.floor((s.durationMinutes || 0) / 60)}h ${Math.floor((s.durationMinutes || 0) % 60)}m`,
      `$${s.totalCost}`,
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gamehub_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <AppContext.Provider value={{
      sessions, devices, cafeItems, analytics, darkMode, isAuthenticated, hasCompletedSetup,
      bootstrapStatus, users, auditLogs, currentUser, permissions, features, systemName, language,
      currencySettings, monthlyExpenseSettings, monthlyExpenses,
      toggleDarkMode, toggleLanguage, login, logout, bootstrapOwner, fetchBootstrapStatus, completeSetup, resetSetup,
      addSession, endSession, deleteSession, togglePauseSession,
      addOrderToSession, removeOrderFromSession, checkAutoEnd, saveSettings, exportDailyReport,
      saveMonthlyExpenseSettings, saveMonthlyExpense, saveCurrencySettings, correctSession,
      saveInventoryItems, isStationActive, makeDirectSale, closeDayReport, addUser, updateUser, deleteUser, clearAuditLogs, t
    }}>
      {children}
    </AppContext.Provider>
  );
};
