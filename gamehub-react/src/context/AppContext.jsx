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
  userId
    ? localStorage.getItem(setupStorageKey(userId)) === 'true' ||
      localStorage.getItem('gamehub_setup_complete') === 'true'
    : false;

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
    // Preserve per-user setup completion flags so logout doesn't remove
    // the client-side marker (server-side initialization is authoritative).
    if (key.startsWith('gamehub_setup_complete_')) return;
    if (!key.startsWith('gamehub_') && key !== 'gamehub_setup_complete') return;
    if (keepPreferences && key === 'gamehub_language') return;
    localStorage.removeItem(key);
  });
  // keep the legacy single key if present; do not force-remove it here
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

const AppDialog = ({ dialog, onResolve, t }) => {
  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onResolve(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onResolve]);

  if (!dialog) return null;

  const isDanger = dialog.variant === 'danger';
  const iconClass = isDanger
    ? 'fa-triangle-exclamation text-red-500 bg-red-500/10'
    : 'fa-circle-info text-indigo-500 bg-indigo-500/10';
  const confirmClass = isDanger
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500/40'
    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/40';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden animate-fade-in-up"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${iconClass}`}>
              <i className={`fas ${isDanger ? 'fa-triangle-exclamation' : 'fa-circle-info'} text-xl`} />
            </span>
            <div className="min-w-0">
              <h2 id="app-dialog-title" className="text-lg font-black dark:text-white text-gray-900">
                {dialog.title}
              </h2>
              <p className="mt-2 text-sm leading-6 dark:text-gray-300 text-gray-600 whitespace-pre-line">
                {dialog.message}
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 sm:px-6 py-4 bg-gray-50 dark:bg-gray-950/70 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {dialog.type === 'confirm' && (
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold dark:text-gray-200 text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              {dialog.cancelText || t('dialog_cancel')}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => onResolve(true)}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-sm font-black transition focus:outline-none focus:ring-4 ${confirmClass}`}
          >
            {dialog.confirmText || t('dialog_ok')}
          </button>
        </div>
      </div>
    </div>
  );
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
    sales_capital: "Sales Capital",
    standalone_sales_cost: "Standalone sales inventory cost",
    sales: "Sales",
    sessions: "Sessions",
    revenue: "Revenue",
    capital: "Capital",
    profit: "Profit",
    date: "Date",
    daily_reference: "Daily Reference",
    daily_reference_hint: "Click any day to review exact sessions and sales.",
    selected_day_details: "Selected Day Details",
    session_details: "Session Details",
    sales_details: "Sales Details",
    products: "Products",
    user: "User",
    no_data_available: "No data available.",
    no_sales_for_day: "No sales for this day.",
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
    delete_item: "Delete item",
    save_inventory: "Save inventory",
    low_stock: "Low stock",
    inactive: "Inactive",
    inventory_search_placeholder: "Search items...",
    inventory_status: "Status",
    inventory_value: "Value",
    inventory_all: "All",
    item_details: "Item Details",
    activate_item: "Activate",
    deactivate_item: "Deactivate",
    select_item_to_edit: "Select an item to edit.",
    no_inventory_matches: "No inventory items match this filter.",
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
    swap_currencies: "Swap currencies",
    exchange_rate_instruction: "Set the local currency value used by analytics and POS previews.",
    local_currency_disabled: "Enable SYP or LBP here to show dual-currency analytics.",
    system_not_configured: "System Not Configured",
    configure_devices_hint: "Add gaming devices in settings to start sessions.",
    quick_config: "Quick Configuration",
    rerun_setup: "Re-run Setup Wizard",
    active: "active",
    daily_report_title: "Daily Report",
    daily_report_subtitle: "Inventory harvest and profit summary for",
    closed_success: "Day closed successfully!",
    revenue_sessions: "Session Revenue",
    revenue_sales: "Sales Revenue",
    total_revenue: "Total Revenue",
    inventory_cost: "Inventory Cost",
    net_profit_label: "Net Profit",
    active_sessions_warning: "Warning: There were {count} active sessions when the day was closed",
    live_revenue: "Total Revenue (Live)",
    play_time: "Play Time:",
    cafe_sales: "Cafe Sales:",
    live_net_profit: "Net Profit (Live)",
    after_inventory_costs: "After deducting inventory costs",
    operational_cost: "Operational Cost:",
    inventory_harvest: "INVENTORY HARVEST (Current Level)",
    product: "Product",
    sale_price_col: "Sale Price",
    current_stock: "Current Stock",
    print: "Print",
    harvest_day: "Harvest Day",
    harvesting: "Harvesting...",
    confirm_close_day: "Do you want to harvest the day and close the daily report? All current figures will be recorded.",
    dialog_ok: "OK",
    dialog_cancel: "Cancel",
    dialog_notice: "Notice",
    dialog_error: "Action failed",
    dialog_confirm_title: "Confirm action",
    dialog_delete: "Delete",
    dialog_clear: "Clear",
    dialog_reset: "Reset",
    dialog_remove: "Remove",
    correct_session: "Correct session",
    dialog_end: "End Session",
    clear_all_activity: "Clear All",
    confirm_clear_activity: "Clear all recent activity? This will permanently remove these records.",
    activity_cleared_success: "Recent activity cleared.",
    error_clearing_activity: "Error clearing recent activity",
    confirm_delete_user: "Delete user?",
    confirm_clear_logs: "Clear all logs permanently?",
    confirm_delete_session: "Delete this session permanently?",
    confirm_finalize_session: "Are you sure you want to end this session? This will finalize all costs.",
    confirm_end_session_now: "End this session now?",
    confirm_remove_order: "Permanently remove {item} order and restore stock?",
    confirm_delete_inventory_item: "Delete {item} permanently? Previous sales history will keep the item name, but this product will be removed from inventory.",
    receipt_image_error: "Could not generate receipt image.",
    no_completed_today: "No completed sessions today.",
    select_active_session_first: "Please select an active session first to add this order.",
    correction_reason_required: "Correction reason is required.",
    correction_customer_required: "Customer name is required.",
    correction_station_required: "Station code is required.",
    correction_times_required: "Start and end times are required.",
    correction_time_order_invalid: "Start time must be before end time.",
    correction_discount_invalid: "Discount must be zero or greater.",
    correction_quantity_invalid: "Order quantities must be whole numbers greater than zero.",
    inventory_item_name_required: "Every item needs a name.",
    settings_subtitle: "Manage center setup, staff, permissions, expenses, and devices.",
    system_settings: "System Settings",
    system_settings_subtitle: "Configure the center, POS money rules, monthly costs, and device availability.",
    tab_system_pos: "System & POS",
    tab_manage_staff: "Manage Staff",
    tab_audit_logs: "Audit Logs",
    settings_empty_devices_title: "Start by adding the game center devices.",
    settings_empty_devices_hint: "Add PC, PlayStation, or other station types here. Cafe inventory is managed from the POS Sale page.",
    device_types: "Device Types",
    configured_play_categories: "Configured play categories",
    stations: "Stations",
    stopped_count: "{count} stopped",
    tracked_cost_types: "Tracked cost types",
    monthly_expenses_hint: "Enable the cost types you actually track, then enter values at month end.",
    active_count: "{count} active",
    expense_electricity: "Electricity",
    expense_internet: "Internet",
    expense_rent: "Rent",
    expense_salaries: "Salaries",
    expense_maintenance: "Maintenance",
    expense_other: "Other",
    month: "Month",
    notes: "Notes",
    gaming_devices: "Gaming Devices",
    gaming_devices_hint: "Define station groups, pricing, and simple active/stopped availability.",
    add_device: "Add Device",
    new_device: "New Device",
    device_type_fallback: "Device Type",
    remove_device_type: "Remove device type",
    display_name: "Display Name",
    prefix: "Prefix",
    count: "Count",
    base_price: "Base Price",
    pricing_strategy: "Pricing Strategy",
    hourly_rate: "Hourly Rate",
    fixed_price: "Fixed Price",
    per_game: "Per Game",
    station_status: "Station Status",
    stopped: "Stopped",
    working: "Working",
    save_changes: "Save Changes",
    rerun_setup_confirm: "This will take you back to the Setup Wizard. Continue?",
    settings_devices_required: "All fields must be filled out for devices.",
    settings_duplicate_device: "Device ID \"{id}\" is duplicated.",
    staff_accounts_permissions: "Staff Accounts & Permissions",
    add_staff_user: "Add Staff User",
    cancel: "Cancel",
    username: "Username",
    password: "Password",
    create_staff_user: "Create Staff User",
    saving: "Saving...",
    save_permissions: "Save Permissions",
    owner_full_access: "Owner accounts always have full access.",
    role_owner: "Owner",
    role_staff: "Staff",
    perm_group_sessions: "Sessions",
    perm_group_orders_pos: "Orders & POS",
    perm_group_reports_inventory: "Reports & Inventory",
    perm_can_start_session: "Start sessions",
    perm_can_pause_session: "Pause sessions",
    perm_can_resume_session: "Resume sessions",
    perm_can_end_session: "End sessions",
    perm_can_add_session_order: "Add session orders",
    perm_can_remove_session_order: "Remove session orders",
    perm_can_create_standalone_sale: "Create standalone sales",
    perm_can_apply_discount: "Apply discounts",
    perm_can_view_shift_report: "View shift reports",
    perm_can_close_shift: "Close shifts",
    perm_can_manage_inventory: "Manage inventory",
    perm_can_update_stock: "Update stock",
    perm_can_view_audit_logs: "View audit logs",
    system_activity_logs: "System Activity Logs",
    clear_all_logs: "Clear All Logs",
    log_time: "Time",
    log_user: "User",
    log_resource: "Resource",
    log_changes: "Changes",
    no_activity_logs: "No activity logs found.",
    audit_logs_hint: "Logs generated automatically whenever pricing or critical settings are updated. Only Owner can clear these logs.",
    setup_step_devices: "Devices",
    setup_step_settings: "Settings",
    setup_step_services: "Services",
    setup_step_done: "Done",
    setup_device_title: "What is your shop name and what devices do you have?",
    setup_device_subtitle: "Enter your shop name to appear in the system and receipts, then add all your gaming stations.",
    shop_hall_name: "Shop / Hall Name",
    short_id: "Short ID",
    station_prefix: "Station Prefix",
    next_services: "Next: Services",
    setup_shop_required: "Please enter your shop name.",
    setup_device_required: "Add at least one device to continue.",
    setup_fill_device_fields: "Fill all device fields.",
    setup_duplicate_id: "Duplicate ID: \"{id}\"",
    core_settings: "Core Settings",
    core_settings_subtitle: "Set currency and optional monthly expense categories. You can edit these later.",
    enable_local_currency: "Enable local currency beside USD",
    currency: "Currency",
    currency_name: "Currency Name",
    local_units_per_usd: "Local Units Per 1 USD",
    monthly_expense_categories: "Monthly Expense Categories",
    local_currency_required: "Local currency code and name are required.",
    exchange_rate_required: "Exchange rate must be greater than 0.",
    back: "Back",
    cafe_services: "Cafe & Services",
    cafe_services_subtitle: "Add drinks, snacks, or any extras you sell. You can skip this if you don't have a cafe.",
    sale_price_short: "Sale $",
    cost_price_short: "Cost $",
    stock_quantity: "Stock Quantity",
    minimum_stock: "Minimum Stock",
    no_items_yet: "No items yet. Add some or skip to continue.",
    finish_setup: "Finish Setup",
    setup_item_name_required: "All items need a name.",
    setup_price_nonnegative: "Prices must be 0 or more.",
    setup_stock_nonnegative: "Stock values must be 0 or more.",
    setup_done_title: "You're all set!",
    setup_done_summary: "Your hall is configured with {devices} device types and {items} cafe items. You can always change these from Settings.",
    go_dashboard: "Go to Dashboard",
    access_denied: "Access Denied",
    setup_admin_only: "Only administrators can access the setup wizard.",
    return_to_app: "Return to App",
    initial_setup: "Initial Setup",
    initial_setup_subtitle: "Initial Setup - takes less than a minute",
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
    delete_item: "حذف الصنف",
    save_inventory: "حفظ المخزون",
    low_stock: "مخزون منخفض",
    inactive: "غير نشط",
    inventory_search_placeholder: "ابحث عن منتج...",
    inventory_status: "الحالة",
    inventory_value: "القيمة",
    inventory_all: "الكل",
    item_details: "تفاصيل الصنف",
    activate_item: "تفعيل",
    deactivate_item: "إيقاف",
    select_item_to_edit: "اختر صنفًا لتعديله.",
    no_inventory_matches: "لا توجد عناصر تطابق هذا الفلتر.",
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
    swap_currencies: "قلب العملات",
    exchange_rate_instruction: "عيّن قيمة العملة المحلية المستخدمة في الإحصائيات ومعاينات نقاط البيع.",
    local_currency_disabled: "فعّل الليرة السورية أو اللبنانية هنا لعرض الإحصائيات بالعملتين.",
    system_not_configured: "النظام غير مُعدّ",
    configure_devices_hint: "أضف الأجهزة من الإعدادات لبدء الجلسات.",
    quick_config: "إعداد سريع",
    rerun_setup: "إعادة معالج الإعداد",
    active: "نشط",
    daily_report_title: "التقرير اليومي",
    daily_report_subtitle: "حصاد المخزون وملخص الأرباح ليوم",
    closed_success: "تم إغلاق اليوم بنجاح!",
    revenue_sessions: "إيرادات الجلسات",
    revenue_sales: "إيرادات المبيعات",
    total_revenue: "إجمالي الإيرادات",
    inventory_cost: "تكلفة المخزون",
    net_profit_label: "صافي الربح",
    active_sessions_warning: "تنبيه: كان هناك {count} جلسة نشطة عند إغلاق اليوم",
    live_revenue: "إجمالي الإيرادات (لحظي)",
    play_time: "وقت اللعب:",
    cafe_sales: "مبيعات الكافيه:",
    live_net_profit: "صافي الربح (لحظي)",
    after_inventory_costs: "بعد خصم تكاليف المخزون",
    operational_cost: "التكلفة التشغيلية:",
    inventory_harvest: "حصاد المخزون (المستوى الحالي)",
    product: "المنتج",
    sale_price_col: "سعر البيع",
    current_stock: "المخزون الحالي",
    print: "طباعة",
    harvest_day: "حصاد اليوم",
    harvesting: "جاري الحصاد...",
    confirm_close_day: "هل تريد حصاد اليوم وإغلاق التقرير اليومي؟ سيتم تسجيل جميع الأرقام الحالية.",
    dialog_ok: "حسنًا",
    dialog_cancel: "إلغاء",
    dialog_notice: "تنبيه",
    dialog_error: "تعذر تنفيذ العملية",
    dialog_confirm_title: "تأكيد العملية",
    dialog_delete: "حذف",
    dialog_clear: "مسح",
    dialog_reset: "إعادة ضبط",
    dialog_remove: "إزالة",
    correct_session: "تصحيح الجلسة",
    dialog_end: "إنهاء الجلسة",
    clear_all_activity: "مسح الكل",
    confirm_clear_activity: "هل تريد مسح كل النشاط الأخير؟ سيؤدي ذلك إلى إزالة هذه السجلات نهائيًا.",
    activity_cleared_success: "تم مسح النشاط الأخير.",
    error_clearing_activity: "حدث خطأ أثناء المسح",
    confirm_delete_user: "هل تريد حذف المستخدم؟",
    confirm_clear_logs: "هل تريد مسح كل السجلات نهائيًا؟",
    confirm_delete_session: "هل تريد حذف هذه الجلسة نهائيًا؟",
    confirm_finalize_session: "هل أنت متأكد من إنهاء هذه الجلسة؟ سيتم تثبيت كل التكاليف.",
    confirm_end_session_now: "هل تريد إنهاء هذه الجلسة الآن؟",
    confirm_remove_order: "هل تريد إزالة طلب {item} نهائيًا وإرجاع الكمية إلى المخزون؟",
    confirm_delete_inventory_item: "هل تريد حذف {item} نهائيًا؟ سيبقى اسم الصنف في المبيعات السابقة، لكن ستتم إزالته من المخزون.",
    receipt_image_error: "تعذر إنشاء صورة الإيصال.",
    no_completed_today: "لا توجد جلسات مكتملة اليوم.",
    select_active_session_first: "يرجى اختيار جلسة نشطة أولًا لإضافة هذا الطلب.",
    correction_reason_required: "سبب التصحيح مطلوب.",
    inventory_item_name_required: "كل عنصر يحتاج اسمًا.",
    settings_subtitle: "إدارة إعدادات الصالة والموظفين والصلاحيات والمصاريف والأجهزة.",
    system_settings: "إعدادات النظام",
    system_settings_subtitle: "ضبط الصالة وقواعد البيع والمصاريف الشهرية وتوفر الأجهزة.",
    tab_system_pos: "النظام والبيع",
    tab_manage_staff: "إدارة الموظفين",
    tab_audit_logs: "سجل النشاطات",
    settings_empty_devices_title: "ابدأ بإضافة أجهزة مركز الألعاب.",
    settings_empty_devices_hint: "أضف أجهزة الكمبيوتر أو البلايستيشن أو أي نوع محطات آخر هنا. تتم إدارة مخزون الكافيه من صفحة البيع.",
    device_types: "أنواع الأجهزة",
    configured_play_categories: "فئات اللعب المعرّفة",
    stations: "المحطات",
    stopped_count: "{count} متوقفة",
    tracked_cost_types: "أنواع التكاليف المتابعة",
    monthly_expenses_hint: "فعّل أنواع التكاليف التي تتابعها فعليًا، ثم أدخل قيمها عند نهاية الشهر.",
    active_count: "{count} مفعّل",
    expense_electricity: "الكهرباء",
    expense_internet: "الإنترنت",
    expense_rent: "الإيجار",
    expense_salaries: "الرواتب",
    expense_maintenance: "الصيانة",
    expense_other: "أخرى",
    month: "الشهر",
    notes: "ملاحظات",
    gaming_devices: "أجهزة الألعاب",
    gaming_devices_hint: "عرّف مجموعات المحطات والتسعير وحالة التوفر بشكل بسيط.",
    add_device: "إضافة جهاز",
    new_device: "جهاز جديد",
    device_type_fallback: "نوع الجهاز",
    remove_device_type: "حذف نوع الجهاز",
    display_name: "الاسم الظاهر",
    prefix: "البادئة",
    count: "العدد",
    base_price: "السعر الأساسي",
    pricing_strategy: "نظام التسعير",
    hourly_rate: "سعر بالساعة",
    fixed_price: "سعر ثابت",
    per_game: "لكل لعبة",
    station_status: "حالة المحطة",
    stopped: "متوقف",
    working: "يعمل",
    save_changes: "حفظ التغييرات",
    rerun_setup_confirm: "سيتم نقلك إلى معالج الإعداد من جديد. هل تريد المتابعة؟",
    settings_devices_required: "يجب تعبئة جميع حقول الأجهزة.",
    settings_duplicate_device: "معرّف الجهاز \"{id}\" مكرر.",
    staff_accounts_permissions: "حسابات الموظفين والصلاحيات",
    add_staff_user: "إضافة موظف",
    cancel: "إلغاء",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    create_staff_user: "إنشاء حساب موظف",
    saving: "جار الحفظ...",
    save_permissions: "حفظ الصلاحيات",
    owner_full_access: "حسابات المالك لديها صلاحية كاملة دائمًا.",
    role_owner: "مالك",
    role_staff: "موظف",
    perm_group_sessions: "الجلسات",
    perm_group_orders_pos: "الطلبات والبيع",
    perm_group_reports_inventory: "التقارير والمخزون",
    perm_can_start_session: "بدء الجلسات",
    perm_can_pause_session: "إيقاف الجلسات مؤقتًا",
    perm_can_resume_session: "استئناف الجلسات",
    perm_can_end_session: "إنهاء الجلسات",
    perm_can_add_session_order: "إضافة طلبات للجلسة",
    perm_can_remove_session_order: "حذف طلبات من الجلسة",
    perm_can_create_standalone_sale: "إنشاء بيع مباشر",
    perm_can_apply_discount: "تطبيق الخصومات",
    perm_can_view_shift_report: "عرض تقارير الوردية",
    perm_can_close_shift: "إغلاق الورديات",
    perm_can_manage_inventory: "إدارة المخزون",
    perm_can_update_stock: "تحديث الكمية",
    perm_can_view_audit_logs: "عرض سجل النشاطات",
    system_activity_logs: "سجل نشاطات النظام",
    clear_all_logs: "مسح كل السجلات",
    log_time: "الوقت",
    log_user: "المستخدم",
    log_resource: "المورد",
    log_changes: "التغييرات",
    no_activity_logs: "لا توجد سجلات نشاط.",
    audit_logs_hint: "يتم إنشاء السجلات تلقائيًا عند تحديث التسعير أو الإعدادات الحساسة. يمكن للمالك فقط مسح هذه السجلات.",
    setup_step_devices: "الأجهزة",
    setup_step_settings: "الإعدادات",
    setup_step_services: "الخدمات",
    setup_step_done: "تم",
    setup_device_title: "ما هو اسم محلك وما هي الأجهزة المتوفرة؟",
    setup_device_subtitle: "أدخل اسم المحل ليظهر في النظام والفواتير، ثم أضف كل أجهزة اللعب.",
    shop_hall_name: "اسم المحل / الصالة",
    short_id: "المعرّف المختصر",
    station_prefix: "بادئة المحطة",
    next_services: "التالي: الخدمات",
    setup_shop_required: "يرجى إدخال اسم المحل.",
    setup_device_required: "أضف جهازًا واحدًا على الأقل للمتابعة.",
    setup_fill_device_fields: "يرجى تعبئة جميع حقول الجهاز.",
    setup_duplicate_id: "المعرّف مكرر: \"{id}\"",
    core_settings: "الإعدادات الأساسية",
    core_settings_subtitle: "اضبط العملة وفئات المصاريف الشهرية الاختيارية. يمكنك تعديلها لاحقًا.",
    enable_local_currency: "تفعيل عملة محلية بجانب الدولار",
    currency: "العملة",
    currency_name: "اسم العملة",
    local_units_per_usd: "عدد وحدات العملة المحلية لكل 1 دولار",
    monthly_expense_categories: "فئات المصاريف الشهرية",
    local_currency_required: "رمز العملة المحلية واسمها مطلوبان.",
    exchange_rate_required: "يجب أن يكون سعر الصرف أكبر من 0.",
    back: "رجوع",
    cafe_services: "الكافيه والخدمات",
    cafe_services_subtitle: "أضف المشروبات أو الوجبات أو أي إضافات تبيعها. يمكنك تخطي هذه الخطوة إذا لم يكن لديك كافيه.",
    sale_price_short: "سعر البيع",
    cost_price_short: "التكلفة",
    stock_quantity: "كمية المخزون",
    minimum_stock: "الحد الأدنى للمخزون",
    no_items_yet: "لا توجد عناصر بعد. أضف عناصر أو تخطَّ للمتابعة.",
    finish_setup: "إنهاء الإعداد",
    setup_item_name_required: "كل العناصر تحتاج اسمًا.",
    setup_price_nonnegative: "يجب أن تكون الأسعار 0 أو أكثر.",
    setup_stock_nonnegative: "يجب أن تكون قيم المخزون 0 أو أكثر.",
    setup_done_title: "كل شيء جاهز!",
    setup_done_summary: "تم إعداد الصالة مع {devices} أنواع أجهزة و {items} عناصر كافيه. يمكنك تعديل ذلك دائمًا من الإعدادات.",
    go_dashboard: "الانتقال إلى لوحة التحكم",
    access_denied: "تم رفض الوصول",
    setup_admin_only: "يمكن للمسؤولين فقط الوصول إلى معالج الإعداد.",
    return_to_app: "العودة إلى التطبيق",
    initial_setup: "الإعداد الأولي",
    initial_setup_subtitle: "الإعداد الأولي - يستغرق أقل من دقيقة",
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
  const [dialog, setDialog] = useState(null);

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
    // If login succeeded, the system is already set up — no need to re-check bootstrap status.
    // Calling fetchBootstrapStatus() here was causing a re-setup loop on every login.
    setHasCompletedSetup(true);
    localStorage.setItem(setupStorageKey(userId), 'true');
    setBootstrapStatus({ loading: false, needs_setup: false, shop_name: authPayload.shop_name || '' });
    rememberRecentUser(authPayload.username);
    await fetchData();
  };

  const fetchBootstrapStatus = async ({ clearOnSetup = false } = {}) => {
    try {
      const res = await axios.get('/auth/bootstrap/status/');
      if (res.data.needs_setup && clearOnSetup) {
        // Only clear local data when explicitly called during app initialization (not after login)
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

  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  }, [language]);

  const resolveDialog = useCallback((result) => {
    setDialog(current => {
      if (current?.resolve) current.resolve(result);
      return null;
    });
  }, []);

  const showAlert = useCallback((message, options = {}) => (
    new Promise(resolve => {
      setDialog({
        type: 'alert',
        title: options.title || t('dialog_notice'),
        message,
        confirmText: options.confirmText || t('dialog_ok'),
        variant: options.variant || 'info',
        resolve,
      });
    })
  ), [t]);

  const showConfirm = useCallback((options = {}) => (
    new Promise(resolve => {
      setDialog({
        type: 'confirm',
        title: options.title || t('dialog_confirm_title'),
        message: options.message || '',
        confirmText: options.confirmText,
        cancelText: options.cancelText || t('dialog_cancel'),
        variant: options.variant || 'info',
        resolve,
      });
    })
  ), [t]);

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
      await showAlert(apiErrorMessage(e, 'Error processing sale'), { title: t('dialog_error'), variant: 'danger' });
      return { success: false };
    }
  };



  const addUser = async (userData) => {
    try {
      await axios.post('/users/', userData);
      await fetchData();
      return true;
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error adding user'), { title: t('dialog_error'), variant: 'danger' });
      return false;
    }
  };

  const updateUser = async (id, userData) => {
    try {
      await axios.patch(`/users/${id}/`, userData);
      await fetchData();
      return true;
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error updating user'), { title: t('dialog_error'), variant: 'danger' });
      return false;
    }
  };

  const deleteUser = async (id) => {
    const confirmed = await showConfirm({
      title: t('dialog_delete'),
      message: t('confirm_delete_user'),
      confirmText: t('dialog_delete'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await axios.delete(`/users/${id}/`);
      await fetchData();
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error deleting user'), { title: t('dialog_error'), variant: 'danger' });
    }
  };

  const clearAuditLogs = async () => {
    const confirmed = await showConfirm({
      title: t('dialog_clear'),
      message: t('confirm_clear_logs'),
      confirmText: t('dialog_clear'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await axios.post('/audit-logs/clear_logs/');
      setAuditLogs([]);
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error clearing logs'), { title: t('dialog_error'), variant: 'danger' });
    }
  };

  const clearAllActivity = async () => {
    const confirmed = await showConfirm({
      title: t('dialog_clear'),
      message: t('confirm_clear_activity'),
      confirmText: t('dialog_clear'),
      variant: 'danger',
    });
    if (!confirmed) return false;
    try {
      const ended = sessions.filter(s => s.endTime);
      // Attempt to delete ended sessions on the server; ignore individual failures
      await Promise.all(ended.map(s => axios.delete(`/sessions/${s.id}/`).catch(() => null)));
      // Update local state immediately
      setSessions(prev => prev.filter(s => !s.endTime));
      await showAlert(t('activity_cleared_success'));
      return true;
    } catch (e) {
      await showAlert(apiErrorMessage(e, t('error_clearing_activity')),{ title: t('dialog_error'), variant: 'danger' });
      return false;
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
      const status = await fetchBootstrapStatus({ clearOnSetup: true });
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
    localStorage.removeItem('gamehub_setup_complete');
    setHasCompletedSetup(false);
  };

  const completeSetup = () => {
    if (currentUser?.id) {
      localStorage.setItem(setupStorageKey(currentUser.id), 'true');
    }
    localStorage.setItem('gamehub_setup_complete', 'true');
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
      await showAlert(apiErrorMessage(e, 'Error starting session'), { title: t('dialog_error'), variant: 'danger' });
    }
  };

  const endSession = async (sessionId, discount = 0) => {
    try {
      const res = await axios.post(`/sessions/${sessionId}/end/`, { discount });
      // Update local state smoothly
      setSessions(prev => prev.map(s => s.id === sessionId ? normalizeSession(res.data) : s));
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error ending session'), { title: t('dialog_error'), variant: 'danger' });
    }
  };

  const deleteSession = async (sessionId) => {
    const confirmed = await showConfirm({
      title: t('dialog_delete'),
      message: t('confirm_delete_session'),
      confirmText: t('dialog_delete'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await axios.delete(`/sessions/${sessionId}/`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error deleting session'), { title: t('dialog_error'), variant: 'danger' });
    }
  };

  const togglePauseSession = async (session) => {
    try {
      const action = session.isPaused ? 'resume' : 'pause';
      const res = await axios.post(`/sessions/${session.id}/${action}/`);
      setSessions(prev => prev.map(s => s.id === session.id ? normalizeSession(res.data) : s));
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error pausing/resuming session'), { title: t('dialog_error'), variant: 'danger' });
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
      await showAlert(apiErrorMessage(e, 'Error adding order'), { title: t('dialog_error'), variant: 'danger' });
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
      await showAlert(apiErrorMessage(e, 'Error removing order'), { title: t('dialog_error'), variant: 'danger' });
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
      return true;
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error saving settings'), { title: t('dialog_error'), variant: 'danger' });
      return false;
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
              is_active: item.id ? item.isActive !== false : true,
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
      await showAlert(apiErrorMessage(e, 'Error saving inventory'), { title: t('dialog_error'), variant: 'danger' });
      return false;
    }
  };

  const deleteInventoryItem = async (item) => {
    if (!item) return false;
    const itemName = item.name || t('item_name');
    const confirmed = await showConfirm({
      title: t('dialog_delete'),
      message: t('confirm_delete_inventory_item').replace('{item}', itemName),
      confirmText: t('dialog_delete'),
      variant: 'danger',
    });
    if (!confirmed) return false;
    if (!item.id) return true;

    try {
      await axios.delete(`/inventory-items/${item.id}/`);
      setCafeItems(prev => prev.filter(existing => existing.id !== item.id));
      await fetchData();
      return true;
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error deleting inventory item'), { title: t('dialog_error'), variant: 'danger' });
      return false;
    }
  };

  const saveMonthlyExpenseSettings = async (settings) => {
    try {
      const res = await axios.patch('/monthly-expense-settings/', settings);
      setMonthlyExpenseSettings(res.data || {});
      return true;
    } catch (e) {
      await showAlert(apiErrorMessage(e, 'Error saving monthly expense settings'), { title: t('dialog_error'), variant: 'danger' });
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
      await showAlert(apiErrorMessage(e, 'Error saving monthly expenses'), { title: t('dialog_error'), variant: 'danger' });
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
      await showAlert(apiErrorMessage(e, 'Error saving currency settings'), { title: t('dialog_error'), variant: 'danger' });
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
      await showAlert(apiErrorMessage(e, 'Error correcting session'), { title: t('dialog_error'), variant: 'danger' });
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      sessions, devices, cafeItems, analytics, darkMode, isAuthenticated, hasCompletedSetup,
      bootstrapStatus, users, auditLogs, currentUser, permissions, features, systemName, language,
      currencySettings, monthlyExpenseSettings, monthlyExpenses,
      toggleDarkMode, toggleLanguage, login, logout, bootstrapOwner, fetchBootstrapStatus, completeSetup, resetSetup,
      addSession, endSession, deleteSession, togglePauseSession,
      addOrderToSession, removeOrderFromSession, checkAutoEnd, saveSettings,
      saveMonthlyExpenseSettings, saveMonthlyExpense, saveCurrencySettings, correctSession,
      saveInventoryItems, deleteInventoryItem, isStationActive, makeDirectSale, addUser, updateUser, deleteUser, clearAuditLogs,
      clearAllActivity,
      fetchData,
      showAlert, showConfirm, t
    }}>
      {children}
      <AppDialog dialog={dialog} onResolve={resolveDialog} t={t} />
    </AppContext.Provider>
  );
};
