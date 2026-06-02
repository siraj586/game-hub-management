import { useApp } from '../../context/AppContext';
import { hasPermission } from '../../utils/permissions';

const NAV_ITEMS = [
  { id: 'sessions', icon: 'fa-gamepad', labelKey: 'nav_sessions' },
  { id: 'sales', icon: 'fa-shopping-cart', labelKey: 'nav_sales', anyPerm: ['can_create_standalone_sale', 'can_manage_inventory', 'can_update_stock'] },
  { id: 'analytics', icon: 'fa-chart-pie', labelKey: 'nav_analytics', anyPerm: ['can_view_shift_report'], flag: 'view_analytics' },
  { id: 'settings', icon: 'fa-cog', labelKey: 'nav_settings', admin: true },
];

const AppLayout = ({
  children,
  currentPage,
  onNavigate,
  onOpenReport,
  canOpenAdminPanel,
  canViewReport,
}) => {
  const {
    systemName,
    currentUser,
    language,
    toggleLanguage,
    darkMode,
    toggleDarkMode,
    logout,
    permissions,
    t,
  } = useApp();

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.admin && !canOpenAdminPanel) return false;
    if (item.perm && !hasPermission(permissions, item.perm)) return false;
    if (item.anyPerm && !item.anyPerm.some((p) => hasPermission(permissions, p)) && !permissions?.[item.flag]) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col dark:bg-gray-950 bg-gray-50">
      <header className="sticky top-0 z-40 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900/95 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate('sessions')}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <i className="fas fa-gamepad text-2xl text-rose-500" />
            <h1 className="text-xl font-extrabold dark:text-white text-gray-800">{systemName}</h1>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg dark:bg-gray-800 bg-gray-100">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white text-xs font-bold">
                  {currentUser.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold dark:text-gray-300 text-gray-700">{currentUser.username}</span>
              </div>
            )}
            {canViewReport && (
              <button
                type="button"
                onClick={onOpenReport}
                className="p-2 rounded-lg text-emerald-600 dark:bg-gray-800 bg-gray-100 hover:bg-emerald-500/10"
                title={t('daily_report')}
              >
                <i className="fas fa-file-invoice" />
              </button>
            )}
            <button type="button" onClick={toggleLanguage} className="p-2 rounded-lg text-blue-500 dark:bg-gray-800 bg-gray-100 text-sm font-bold">
              {language === 'ar' ? 'EN' : 'ع'}
            </button>
            <button type="button" onClick={toggleDarkMode} className="p-2 rounded-lg dark:bg-gray-800 bg-gray-100 dark:text-yellow-300 text-gray-600">
              <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-lg text-red-500 dark:bg-gray-800 bg-gray-100 hover:bg-red-500/10"
              title={t('logout')}
            >
              <i className="fas fa-sign-out-alt" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t dark:border-gray-800 border-gray-200 dark:bg-gray-900/98 bg-white/98 backdrop-blur-md safe-area-pb">
        <div className="max-w-7xl mx-auto flex justify-around px-2 py-2">
          {visibleNav.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition min-w-[72px] ${
                  active
                    ? 'text-rose-500 bg-rose-500/10'
                    : 'dark:text-gray-500 text-gray-400 hover:dark:text-gray-300'
                }`}
              >
                <i className={`fas ${item.icon} text-lg`} />
                <span className="text-[10px] font-bold uppercase tracking-wide">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
