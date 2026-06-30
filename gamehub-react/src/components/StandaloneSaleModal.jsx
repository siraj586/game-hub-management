import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';

const StandaloneSaleModal = ({ isOpen, onClose }) => {
  const { cafeItems, makeDirectSale, permissions, currencySettings } = useApp();
  const [cart, setCart] = useState([]);
  const canCreateSale = hasPermission(permissions, 'can_create_standalone_sale');
  const activeItems = cafeItems.filter(item => item.isActive !== false);

  const dualCurrencyEnabled = currencySettings?.local_currency_enabled;
  const localCurrencyCode = currencySettings?.local_currency_code || 'LOCAL';
  const localRate = Number(currencySettings?.local_units_per_usd || 1);
  // Phase 3: null until cashier explicitly picks when dual-currency is active
  const [paymentCurrency, setPaymentCurrency] = useState(dualCurrencyEnabled ? null : 'USD');
  const currencyChosen = !!paymentCurrency;

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing && existing.quantity >= item.stock) return prev;
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const totalCents = cart.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * item.quantity, 0);
  const total = totalCents / 100;
  const localTotal = Math.round(totalCents * localRate / 100);

  const handleCheckout = async () => {
    if (cart.length === 0 || !canCreateSale || !currencyChosen) return;
    const result = await makeDirectSale(cart, paymentCurrency);
    if (result.success) {
      setCart([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh]">
        {/* Inventory Selection */}
        <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black dark:text-white text-gray-800">Quick Sell</h2>
            <button onClick={onClose} className="md:hidden text-gray-400"><i className="fas fa-times"></i></button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {activeItems.map(item => {
              const inCart = cart.find(cartItem => cartItem.id === item.id)?.quantity || 0;
              const unavailable = item.stock <= 0 || inCart >= item.stock || !canCreateSale;
              return (
                <button 
                  key={item.id}
                  disabled={unavailable}
                  onClick={() => addToCart(item)}
                  className={`flex flex-col p-4 rounded-xl border transition text-left group
                    ${unavailable ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:border-indigo-500 hover:shadow-lg active:scale-95 bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700'}
                  `}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition">
                      <i className="fas fa-cookie-bite"></i>
                    </div>
                    <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">Stock: {item.stock - inCart}</span>
                  </div>
                  <span className="font-bold text-sm dark:text-white text-gray-800 truncate mb-1">{item.name}</span>
                  <span className="text-indigo-500 font-black text-lg">${item.price.toFixed(2)} USD</span>
                  {item.local_price !== null && item.local_price !== undefined && (
                    <span className="text-[10px] text-gray-500">{item.local_price.toFixed(2)} {item.local_currency_code}</span>
                  )}
                  {item.lowStock && <span className="text-[10px] font-black text-red-500 mt-1">Low stock</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart / Checkout */}
        <div className="w-full md:w-80 bg-gray-50 dark:bg-gray-900/50 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-500 uppercase text-xs tracking-widest">Cart Summary</h3>
            <button onClick={onClose} className="hidden md:block text-gray-400 hover:text-red-500"><i className="fas fa-times"></i></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <i className="fas fa-shopping-basket text-4xl mb-2"></i>
                <p className="text-sm">Ready to serve!</p>
              </div>
            )}
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm animate-fade-in-up">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate dark:text-white">{item.name}</p>
                  <p className="text-[10px] text-gray-500">{item.quantity} x ${item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                   <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><i className="fas fa-minus-circle"></i></button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            {dualCurrencyEnabled && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold dark:text-gray-400 text-gray-500 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentCurrency ?? ''}
                  onChange={e => setPaymentCurrency(e.target.value || null)}
                  className={`w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition dark:bg-gray-700 bg-gray-50 dark:border-gray-600 border-gray-300 dark:text-white text-sm font-bold ${!currencyChosen ? 'border-red-400 dark:border-red-500' : ''}`}
                >
                  <option value="">— select payment currency —</option>
                  <option value="USD">Pay in USD (${total.toFixed(2)})</option>
                  <option value={localCurrencyCode}>Pay in {localCurrencyCode} ({localTotal.toLocaleString()})</option>
                </select>
                {!currencyChosen && (
                  <p className="text-red-500 text-[10px] mt-1 font-bold">Select a payment currency to continue.</p>
                )}
              </div>
            )}
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500 font-bold uppercase text-[10px]">Total Amount</span>
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">${total.toFixed(2)}</span>
            </div>
            <button
              disabled={cart.length === 0 || !canCreateSale || !currencyChosen}
              onClick={handleCheckout}
              title={!currencyChosen ? 'Select a payment currency first' : undefined}
              className={`w-full py-4 rounded-2xl font-black text-lg transition shadow-xl flex items-center justify-center gap-3
                ${cart.length === 0 || !canCreateSale || !currencyChosen ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white active:scale-95'}
              `}
            >
              <i className="fas fa-receipt"></i> COMPLETE SALE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandaloneSaleModal;
