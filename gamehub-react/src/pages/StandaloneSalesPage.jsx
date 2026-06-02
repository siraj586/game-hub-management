import { useState } from 'react';
import { useApp } from '../context/AppContext';
import BuffetItemGrid from '../components/BuffetItemGrid';
import InventoryManager from '../components/InventoryManager';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

const StandaloneSalesPage = () => {
  const { cafeItems, makeDirectSale, permissions, systemName, currentUser, t } = useApp();
  const [cart, setCart] = useState([]);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [salesMode, setSalesMode] = useState('sell');
  const canCreateSale = hasPermission(permissions, 'can_create_standalone_sale');
  const canManageInventory = hasAnyPermission(permissions, ['can_manage_inventory', 'can_update_stock']);
  const activeMode = salesMode === 'inventory' && canManageInventory
    ? 'inventory'
    : canCreateSale
      ? 'sell'
      : canManageInventory
        ? 'inventory'
        : 'sell';
  const activeItems = cafeItems.filter(item => item.isActive !== false);

  const addToCart = (item) => {
    if (!canCreateSale) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing && existing.quantity >= item.stock) return prev;
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const adjustQty = (id, delta) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const stock = activeItems.find((c) => c.id === id)?.stock ?? 0;
      const next = item.quantity + delta;
      if (next <= 0) return prev.filter((i) => i.id !== id);
      if (next > stock) return prev;
      return prev.map((i) => (i.id === id ? { ...i, quantity: next } : i));
    });
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !canCreateSale) return;
    const result = await makeDirectSale(cart);
    if (result.success) {
      setLastReceipt({
        ...result.data,
        items: cart,
        cashier: result.data?.username || currentUser?.username || '',
        receiptDate: result.data?.timestamp || new Date().toISOString(),
      });
      setCart([]);
    }
  };

  const getInCart = (id) => cart.find((c) => c.id === id)?.quantity || 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black dark:text-white text-gray-800 flex items-center gap-2">
          <i className="fas fa-shopping-cart text-indigo-500" />
          {t('nav_sales')}
        </h2>
        <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">{t('sales_page_subtitle')}</p>
      </div>

      {canManageInventory && (
        <div className="inline-flex rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-1 shadow-sm">
          {canCreateSale && (
            <button
              type="button"
              onClick={() => setSalesMode('sell')}
              className={`px-4 py-2 rounded-lg text-sm font-black transition ${
                activeMode === 'sell'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-500 hover:text-indigo-500'
              }`}
            >
              <i className="fas fa-cash-register mr-2" />
              {t('nav_sales')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSalesMode('inventory')}
            className={`px-4 py-2 rounded-lg text-sm font-black transition ${
              activeMode === 'inventory'
                ? 'bg-amber-500 text-white'
                : 'text-gray-500 hover:text-amber-500'
            }`}
          >
            <i className="fas fa-boxes-stacked mr-2" />
            {t('nav_inventory')}
          </button>
        </div>
      )}

      {activeMode === 'inventory' ? (
        <InventoryManager embedded />
      ) : (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">{t('cafe_panel_title')}</h3>
          {!canCreateSale ? (
            <p className="text-center text-gray-500 py-8">{t('view_only')}</p>
          ) : (
            <BuffetItemGrid
              items={activeItems}
              onItemClick={addToCart}
              stockLabel={t('stock')}
              getItemDisabled={(item) => {
                const inCart = getInCart(item.id);
                return item.stock <= 0 || inCart >= item.stock;
              }}
            />
          )}
        </div>

        <div className="rounded-2xl p-5 dark:bg-gray-900/50 bg-gray-50 border dark:border-gray-700 border-gray-200 shadow-lg flex flex-col min-h-[320px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">{t('cart')}</h3>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-40 text-center py-8">
                <i className="fas fa-shopping-basket text-4xl mb-2" />
                <p className="text-sm">{t('cart_empty')}</p>
              </div>
            )}
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate dark:text-white">{item.name}</p>
                  <p className="text-[10px] text-gray-500">${item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustQty(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <i className="fas fa-minus text-xs" />
                  </button>
                  <span className="font-mono font-bold w-6 text-center dark:text-white">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => adjustQty(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-indigo-500 text-white"
                  >
                    <i className="fas fa-plus text-xs" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t dark:border-gray-700 border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold uppercase text-gray-500">{t('total')}</span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || !canCreateSale}
              onClick={handleCheckout}
              className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition
                ${cart.length === 0 || !canCreateSale
                  ? 'opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-700'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg active:scale-95'
                }`}
            >
              <i className="fas fa-receipt" />
              {t('complete_sale')}
            </button>
          </div>
        </div>
      </div>

      {lastReceipt && (
        <div className="rounded-2xl p-5 dark:bg-gray-800/80 bg-white border dark:border-gray-700 border-gray-200 shadow-lg max-w-md">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">{t('receipt')}</h3>
          <div className="text-sm space-y-2 dark:text-gray-200 text-gray-700">
            <div className="flex justify-between"><span>Center</span><span className="font-bold">{systemName}</span></div>
            <div className="flex justify-between"><span>Date</span><span>{new Date(lastReceipt.receiptDate).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Cashier</span><span>{lastReceipt.cashier || '-'}</span></div>
            <div className="flex justify-between"><span>Payment</span><span>Cash</span></div>
            <div className="border-t dark:border-gray-700 border-gray-200 pt-2">
              {lastReceipt.items.map(item => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span>{item.quantity}x {item.name}</span>
                  <span>${(item.price * item.quantity).toFixed(2)} USD</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2 border-t dark:border-gray-700 border-gray-200 font-black">
              <span>Total</span>
              <span>${Number(lastReceipt.total_price || total).toFixed(2)} USD</span>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default StandaloneSalesPage;
