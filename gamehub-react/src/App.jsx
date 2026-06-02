import { useState, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { hasPermission } from './utils/permissions';

import LoginPage from './components/LoginPage';
import SetupPage from './components/SetupPage';
import AppLayout from './components/layout/AppLayout';
import SessionsPage from './pages/SessionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import StandaloneSalesPage from './pages/StandaloneSalesPage';
import SettingsPage from './pages/SettingsPage';
import DailyReportModal from './components/DailyReportModal';

function MainApp() {
  const {
    permissions,
    checkAutoEnd,
    resetSetup,
    devices,
  } = useApp();

  const [currentPage, setCurrentPage] = useState('sessions');
  const [reportOpen, setReportOpen] = useState(false);

  const canViewReport = hasPermission(permissions, 'can_view_shift_report') || permissions?.view_analytics;
  const canOpenAdminPanel =
    permissions?.manage_settings || permissions?.manage_users || permissions?.view_audit_logs;
  const canSales = hasPermission(permissions, 'can_create_standalone_sale');
  const canInventory =
    hasPermission(permissions, 'can_manage_inventory') || hasPermission(permissions, 'can_update_stock');
  const canSalesArea = canSales || canInventory;
  const canAnalytics =
    hasPermission(permissions, 'can_view_shift_report') || permissions?.view_analytics;

  useEffect(() => {
    checkAutoEnd();
    const interval = setInterval(() => checkAutoEnd(), 5000);
    return () => clearInterval(interval);
  }, [checkAutoEnd]);

  const activePage =
    (currentPage === 'sales' && !canSalesArea) ||
    (currentPage === 'analytics' && !canAnalytics) ||
    (currentPage === 'settings' && !canOpenAdminPanel)
      ? 'sessions'
      : currentPage;

  const renderPage = () => {
    switch (activePage) {
      case 'analytics':
        return <AnalyticsPage onOpenReport={() => setReportOpen(true)} />;
      case 'sales':
        return <StandaloneSalesPage />;
      case 'settings':
        return <SettingsPage />;
      case 'sessions':
      default:
        return (
          <SessionsPage
            onOpenSettings={() => setCurrentPage('settings')}
            resetSetup={resetSetup}
          />
        );
    }
  };

  return (
    <AppLayout
      currentPage={activePage}
      onNavigate={setCurrentPage}
      onOpenReport={() => setReportOpen(true)}
      canOpenAdminPanel={canOpenAdminPanel}
      canViewReport={canViewReport}
    >
      {renderPage()}

      <footer className="py-6 text-center opacity-60 text-xs dark:text-gray-500 text-gray-400">
        &copy; {new Date().getFullYear()} GameHub Pro
        {devices.length > 0 && (
          <span className="mx-2 text-rose-500/80 font-mono">AUTO-END</span>
        )}
      </footer>

      <DailyReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
    </AppLayout>
  );
}

function App() {
  const { isAuthenticated, hasCompletedSetup, permissions } = useApp();

  if (!isAuthenticated) return <LoginPage />;

  const needsDeviceSetup = permissions?.manage_settings && !hasCompletedSetup;
  if (needsDeviceSetup) return <SetupPage />;

  return <MainApp />;
}

export default App;
