import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatDuration } from '../utils/helpers';
import { hasPermission } from '../utils/permissions';

const FinalizeModal = ({ sessionId, onClose }) => {
  const { sessions, endSession, permissions, systemName, currentUser } = useApp();
  const [discount, setDiscount] = useState(0);
  const receiptRef = useRef(null);

  const session = sessions.find(s => s.id === sessionId);
  if (!session) return null;
  const canEndSession = hasPermission(permissions, 'can_end_session');
  const canApplyDiscount = hasPermission(permissions, 'can_apply_discount');

  const elapsedMinutes = session.elapsedTime ?? session.durationMinutes ?? 0;
  const backendTotal = Number(session.finalTotal ?? session.liveCost ?? session.totalCost ?? 0);
  const itemsCost = session.ordersCost || 0;
  const playCost = Math.max(0, backendTotal + (session.discount || 0) - itemsCost);
  const subtotal = Math.max(0, playCost + itemsCost);
  const appliedDiscount = session.endTime || canApplyDiscount
    ? (session.endTime ? (session.discount || 0) : Math.min(Math.max(0, discount), subtotal))
    : 0;
  const total = Math.max(0, backendTotal - (session.endTime ? 0 : appliedDiscount));

  const handleEnd = () => {
    if (window.confirm("Are you sure you want to end this session? This will finalize all costs.")) {
      endSession(sessionId, appliedDiscount);
      onClose();
    }
  };

  const downloadReceipt = async () => {
    const el = receiptRef.current;
    if (!el) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `receipt_${sessionId}.png`;
      link.href = imgData;
      link.click();
    } catch {
      alert("Could not generate receipt image.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shrink-0">
          <h2 className="text-xl font-bold dark:text-white text-gray-800 flex items-center">
            <i className="fas fa-file-invoice-dollar text-cyan-500 mr-2"></i>
            {session.endTime ? 'Session Receipt' : 'Finalize Session'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition text-xl">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          {/* Receipt Preview */}
          <div id="receipt-print-area" ref={receiptRef} className="p-6 rounded-lg mx-auto max-w-[280px] mb-4 shadow-sm border border-gray-100 scale-95 origin-top">
            <div className="receipt-header text-center">
              <i className="fas fa-gamepad text-3xl text-rose-500 mb-1"></i>
              <h2 className="text-xl font-black uppercase tracking-widest text-gray-900">{systemName}</h2>
              <p className="text-[10px] opacity-70 text-gray-700">
                ID: #{session.id.toString().slice(-5)} •{' '}
                {session.endTime ? new Date(session.endTime).toLocaleString() : new Date().toLocaleString()}
              </p>
            </div>

            <div className="py-2 text-[11px] text-gray-800">
              <div className="receipt-item"><span>CUSTOMER:</span><span>{session.name}</span></div>
              <div className="receipt-item"><span>STATION:</span><span>{session.stationId}</span></div>
              <div className="receipt-item"><span>CASHIER:</span><span>{currentUser?.username || '-'}</span></div>
              <div className="receipt-item"><span>PAYMENT:</span><span>Cash</span></div>
              <div className="receipt-item"><span>TIME:</span><span>{formatDuration(elapsedMinutes)}</span></div>
            </div>

            <div className="receipt-total-section">
              <div className="receipt-item font-bold text-xs text-gray-900">
                <span>PLAY COST:</span><span>${playCost.toFixed(2)}</span>
              </div>
              {session.orders && session.orders.length > 0 && (
                <>
                  <div className="mt-1 text-[9px] font-bold opacity-60 uppercase text-gray-700">Cafe:</div>
                  {session.orders.map((o, i) => (
                    <div key={i} className="receipt-item text-[10px] pl-1 text-gray-800">
                      <span>{o.quantity || 1}x {o.name}</span><span>${Number(o.price ?? o.total_price ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="receipt-total-section border-t-2 border-black">
              <div className="receipt-item font-bold text-xs text-gray-900">
                <span>SUBTOTAL:</span><span>${subtotal.toFixed(2)}</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="receipt-item font-bold text-emerald-600 text-xs">
                  <span>DISCOUNT:</span><span>-${appliedDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="receipt-item text-xl font-black mt-1 text-rose-600">
                <span>TOTAL:</span><span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="receipt-footer mt-4">
              <p className="text-[9px] text-gray-400">THANK YOU FOR GAMING!</p>
            </div>
          </div>

          {/* Discount Input - only for active sessions */}
          {!session.endTime && canApplyDiscount && (
            <div className="px-2">
              <label className="block text-[11px] font-bold dark:text-gray-400 text-gray-500 mb-1">Apply Discount ($)</label>
              <input
                type="number"
                min="0"
                max={subtotal}
                step="0.5"
                value={discount}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-rose-500 outline-none transition dark:bg-gray-700 bg-gray-50 dark:border-gray-600 border-gray-300 dark:text-white text-sm font-bold"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap justify-end items-center gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold transition text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">
            {session.endTime ? 'Close' : 'Cancel'}
          </button>
          <button onClick={downloadReceipt} className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2">
            <i className="fas fa-download text-blue-500"></i> Receipt
          </button>
          {!session.endTime && canEndSession && (
            <button onClick={handleEnd} className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg text-xs font-bold transition shadow-lg flex items-center gap-2">
              <i className="fas fa-check-double"></i> Checkout & End
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinalizeModal;
