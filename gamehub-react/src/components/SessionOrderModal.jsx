import { useApp } from '../context/AppContext';
import BuffetItemGrid from './BuffetItemGrid';
import { hasPermission } from '../utils/permissions';

const SessionOrderModal = ({ session, onClose }) => {
  const { cafeItems, addOrderToSession, permissions, t } = useApp();

  if (!session) return null;

  const canAdd = hasPermission(permissions, 'can_add_session_order');
  const activeItems = cafeItems.filter(item => item.isActive !== false);

  const handleAdd = async (item) => {
    if (!canAdd || item.stock < 1) return;
    await addOrderToSession(session.id, item.id, item.name, item.price);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-fade-in-up">
        <div className="p-5 border-b dark:border-gray-700 border-gray-200 flex justify-between items-start gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1">
              <i className="fas fa-coffee mr-1" />
              {t('add_buffet_to_session')}
            </p>
            <h2 className="text-xl font-black dark:text-white text-gray-800">{session.name}</h2>
            <p className="text-sm dark:text-gray-400 text-gray-500 font-mono mt-0.5">
              {session.stationId} · {session.deviceType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full dark:bg-gray-700 bg-gray-100 text-gray-500 hover:text-red-500 flex items-center justify-center shrink-0"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          {!canAdd ? (
            <p className="text-center text-gray-500 py-8">{t('view_only')}</p>
          ) : (
            <BuffetItemGrid
              items={activeItems}
              onItemClick={handleAdd}
              stockLabel={t('stock')}
              columns="grid-cols-2 sm:grid-cols-3"
              getItemDisabled={(item) => item.stock < 1}
            />
          )}
        </div>

        <div className="p-4 border-t dark:border-gray-700 border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl dark:bg-gray-700 bg-gray-100 dark:text-gray-300 text-gray-700 font-bold"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionOrderModal;
