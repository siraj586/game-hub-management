import { useState } from 'react';
import { useApp } from '../context/AppContext';

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const SessionCorrectionModal = ({ session, onClose }) => {
  const { cafeItems, correctSession } = useApp();
  const [startTime, setStartTime] = useState(toLocalInput(session?.startTime));
  const [endTime, setEndTime] = useState(toLocalInput(session?.endTime));
  const [stationId, setStationId] = useState(session?.stationId || '');
  const [discount, setDiscount] = useState(session?.discount || 0);
  const [reason, setReason] = useState('');
  const [orderQuantities, setOrderQuantities] = useState(() =>
    Object.fromEntries((session?.orders || []).map(order => [order.id, order.quantity || 1]))
  );
  const [removeOrderIds, setRemoveOrderIds] = useState([]);
  const [addItemId, setAddItemId] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);

  if (!session) return null;

  const activeItems = cafeItems.filter(item => item.isActive !== false && item.stock > 0);

  const toggleRemoveOrder = (orderId) => {
    setRemoveOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      alert('Correction reason is required.');
      return;
    }

    const updateOrders = (session.orders || [])
      .filter(order => !removeOrderIds.includes(order.id))
      .filter(order => Number(orderQuantities[order.id]) !== Number(order.quantity))
      .map(order => ({ orderId: order.id, quantity: Number(orderQuantities[order.id]) }));

    const addOrders = addItemId
      ? [{ inventoryItemId: Number(addItemId), quantity: Number(addQuantity) || 1 }]
      : [];

    const ok = await correctSession(session.id, {
      startTime,
      endTime,
      stationId,
      discount,
      removeOrderIds,
      updateOrders,
      addOrders,
      reason,
    });
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-500">Owner correction</p>
            <h2 className="text-xl font-black text-gray-800 dark:text-white">{session.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-red-500">
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Start time</span>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">End time</span>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Station code</span>
              <input value={stationId} onChange={e => setStationId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Discount ($)</span>
              <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </label>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Orders</h3>
            {(session.orders || []).length === 0 ? (
              <p className="text-sm text-gray-500">No orders on this session.</p>
            ) : (
              <div className="space-y-2">
                {session.orders.map(order => (
                  <div key={order.id} className="grid grid-cols-[1fr_90px_auto] gap-2 items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{order.item_name || order.name}</span>
                    <input type="number" min="1" value={orderQuantities[order.id] || 1}
                      onChange={e => setOrderQuantities(prev => ({ ...prev, [order.id]: e.target.value }))}
                      disabled={removeOrderIds.includes(order.id)}
                      className="px-2 py-1 rounded-lg border dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                    <label className="flex items-center gap-1 text-xs text-red-500 font-bold">
                      <input type="checkbox" checked={removeOrderIds.includes(order.id)} onChange={() => toggleRemoveOrder(order.id)} />
                      Remove
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-2">
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Add item</span>
              <select value={addItemId} onChange={e => setAddItemId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white">
                <option value="">No item</option>
                {activeItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.stock} stock)</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-gray-500 mb-1">Qty</span>
              <input type="number" min="1" value={addQuantity} onChange={e => setAddQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
            </label>
          </div>

          <label className="block">
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Reason</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows="3"
              className="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
          </label>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-gray-200">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="px-5 py-2 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">
            Save correction
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionCorrectionModal;
