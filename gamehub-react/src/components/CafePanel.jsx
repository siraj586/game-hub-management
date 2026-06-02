import { useState } from 'react';
import { useApp } from '../context/AppContext';
import StandaloneSaleModal from './StandaloneSaleModal';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

const CafePanel = () => {
  const { sessions, cafeItems, addOrderToSession, permissions, t } = useApp();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isQuickSellOpen, setIsQuickSellOpen] = useState(false);

  const canAddSessionOrder = hasPermission(permissions, 'can_add_session_order');
  const canCreateStandaloneSale = hasPermission(permissions, 'can_create_standalone_sale');
  const canViewCafe = hasAnyPermission(permissions, [
    'can_add_session_order',
    'can_create_standalone_sale',
    'can_manage_inventory',
    'can_update_stock',
  ]);

  const activeSessions = sessions.filter(s => !s.endTime);
  const activeCafeItems = cafeItems.filter(item => item.isActive !== false);
  const lowStockItems = activeCafeItems.filter(item => item.lowStock);

  const handleItemClick = (item) => {
    if (!canAddSessionOrder) return;
    if (!selectedSessionId) {
      alert("Please select an active session first to add this order.");
      return;
    }
    // API expects: sessionId, inventoryItemId, itemName, itemPrice, quantity
    addOrderToSession(parseFloat(selectedSessionId), item.id, item.name, item.price);
  };

  return (
    <div className="mt-6 rounded-2xl shadow-xl p-5 dark:bg-gray-800/80 bg-white/90 border dark:border-gray-700 border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white text-gray-800">
          <i className="fas fa-coffee text-amber-500"></i> {t('cafe_panel_title')}
        </h3>
        {canCreateStandaloneSale && (
          <button 
            onClick={() => setIsQuickSellOpen(true)}
            className="text-[11px] px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg font-bold hover:bg-amber-500 hover:text-white transition"
          >
            <i className="fas fa-shopping-cart mr-1"></i> {t('quick_sell')}
          </button>
        )}
      </div>

      <StandaloneSaleModal isOpen={isQuickSellOpen} onClose={() => setIsQuickSellOpen(false)} />

      {lowStockItems.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          <i className="fas fa-triangle-exclamation mr-2"></i>
          Low stock: {lowStockItems.map(item => item.name).join(', ')}
        </div>
      )}

      {canAddSessionOrder && (
        <div className="mt-4">
          <label className="block text-sm font-medium dark:text-gray-300 text-gray-700">{t('add_order_to_session')}</label>
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border focus:ring-amber-500 dark:bg-gray-700 bg-white dark:border-gray-600 border-gray-300 dark:text-white"
          >
            <option value="">{t('select_active_session')}</option>
            {activeSessions.map(s => (
              <option key={s.id} value={s.id}>{s.stationId} - {s.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {!canViewCafe ? (
          <div className="col-span-2 text-center text-sm text-gray-500 py-4">
            {t('view_only')}
          </div>
        ) : activeCafeItems.length === 0 ? (
          <div className="col-span-2 text-center text-sm text-gray-500 py-4">
            {t('no_cafe_items')}
          </div>
        ) : (
          activeCafeItems.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={item.stock < 1 || !canAddSessionOrder}
              onClick={() => handleItemClick(item)}
              className={`py-2 px-2 rounded-xl flex flex-col items-center justify-center border transition text-sm font-bold dark:text-white text-gray-800
                ${(item.stock < 1 || !canAddSessionOrder) ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700' : 'bg-gradient-to-r dark:from-gray-700 dark:to-gray-600 from-gray-100 to-gray-200 border-gray-300 dark:border-gray-500 hover:shadow-md active:scale-95'}
              `}
            >
              <span>{item.name} (${item.price.toFixed(2)} USD)</span>
              {item.local_price !== null && item.local_price !== undefined && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {item.local_price.toFixed(2)} {item.local_currency_code}
                </span>
              )}
              <span className={`text-[10px] font-mono mt-0.5 ${item.stock < 1 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {item.stock} {t('stock')}
              </span>
              {item.lowStock && <span className="text-[10px] font-black text-red-500">Low stock</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default CafePanel;
