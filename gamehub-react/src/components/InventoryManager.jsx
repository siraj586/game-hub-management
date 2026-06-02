import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrencyAmount, getCurrencyOptions } from '../utils/currency';
import { hasAnyPermission, isOwnerUser } from '../utils/permissions';

const emptyItem = {
  id: null,
  name: '',
  price: 0,
  price_currency: 'USD',
  cost_price: 0,
  cost_currency: 'USD',
  stock: 0,
  minStock: 0,
  isActive: true,
};

const normalizeDraftItem = (item) => ({
  id: item.id || null,
  name: item.name || '',
  price: Number(item.original_price_amount ?? item.price ?? 0),
  price_currency: item.original_price_currency || 'USD',
  cost_price: Number(item.original_cost_amount ?? item.cost_price ?? 0),
  cost_currency: item.original_cost_currency || 'USD',
  stock: Number(item.stock ?? 0),
  minStock: Number(item.minStock ?? 0),
  isActive: item.isActive !== false,
});

const InventoryManager = ({ embedded = false }) => {
  const {
    cafeItems,
    currencySettings,
    currentUser,
    permissions,
    saveInventoryItems,
    t,
  } = useApp();
  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const canManageInventory = hasAnyPermission(permissions, ['can_manage_inventory', 'can_update_stock']);
  const canEditCatalog = isOwnerUser(currentUser);
  const currencyOptions = getCurrencyOptions(currencySettings);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(cafeItems.map(normalizeDraftItem));
      setSelectedIndex(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cafeItems]);

  const selectedItem = items[selectedIndex] || null;
  const activeItems = items.filter(item => item.isActive !== false);
  const lowStockItems = activeItems.filter(item => Number(item.stock || 0) <= Number(item.minStock || 0));
  const inventoryValue = activeItems.reduce(
    (total, item) => total + Number(item.stock || 0) * Number(item.cost_price || 0),
    0
  );

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const matchesQuery = !term || item.name.toLowerCase().includes(term);
        const isLow = Number(item.stock || 0) <= Number(item.minStock || 0);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'low' && item.isActive !== false && isLow) ||
          (statusFilter === 'inactive' && item.isActive === false) ||
          (statusFilter === 'active' && item.isActive !== false);
        return matchesQuery && matchesStatus;
      });
  }, [items, query, statusFilter]);

  const updateItem = (field, value) => {
    setItems(prev => prev.map((item, index) =>
      index === selectedIndex ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    if (!canEditCatalog) return;
    setItems(prev => {
      const next = [{ ...emptyItem, name: 'New item' }, ...prev];
      setSelectedIndex(0);
      return next;
    });
  };

  const toggleActive = (index) => {
    if (!canEditCatalog) return;
    setItems(prev => prev.map((item, itemIndex) =>
      itemIndex === index ? { ...item, isActive: item.isActive === false } : item
    ));
  };

  const handleSave = async () => {
    const cleaned = items.map(item => ({
      ...item,
      name: item.name.trim(),
      price: Math.max(0, Number(item.price || 0)),
      cost_price: Math.max(0, Number(item.cost_price || 0)),
      stock: Math.max(0, Number(item.stock || 0)),
      minStock: Math.max(0, Number(item.minStock || 0)),
    }));

    if (canEditCatalog && cleaned.some(item => !item.name)) {
      alert('Every item needs a name.');
      return;
    }

    setSaving(true);
    const ok = await saveInventoryItems(cleaned);
    setSaving(false);
    if (ok) setSelectedIndex(0);
  };

  if (!canManageInventory) {
    return (
      <div className="rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-6 text-center">
        <i className="fas fa-lock text-3xl text-gray-400 mb-3" />
        <p className="font-bold dark:text-white text-gray-800">Inventory access is not enabled for this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-black dark:text-white text-gray-800 flex items-center gap-2`}>
            <i className="fas fa-boxes-stacked text-amber-500" />
            {t('nav_inventory')}
          </h2>
          <p className="text-sm dark:text-gray-500 text-gray-400 mt-1">{t('inventory_subtitle')}</p>
        </div>
        {canEditCatalog && (
          <button
            type="button"
            onClick={addItem}
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600"
          >
            <i className="fas fa-plus mr-2" />
            {t('add_item')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-4">
          <p className="text-[11px] uppercase font-bold text-gray-400">{t('active')}</p>
          <p className="text-2xl font-black dark:text-white text-gray-800">{activeItems.length}</p>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-[11px] uppercase font-bold text-red-500">{t('low_stock')}</p>
          <p className="text-2xl font-black text-red-500">{lowStockItems.length}</p>
        </div>
        <div className="rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-4">
          <p className="text-[11px] uppercase font-bold text-gray-400">{t('stock')}</p>
          <p className="text-2xl font-black dark:text-white text-gray-800">
            {activeItems.reduce((sum, item) => sum + Number(item.stock || 0), 0)}
          </p>
        </div>
        <div className="rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-4">
          <p className="text-[11px] uppercase font-bold text-gray-400">Value</p>
          <p className="text-2xl font-black dark:text-white text-gray-800">
            {formatCurrencyAmount(inventoryValue, 'USD')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 border-gray-200 flex flex-wrap gap-3 items-center">
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search items..."
              className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white"
            />
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              className="px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="low">{t('low_stock')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-gray-400 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left px-4 py-3">{t('item_name')}</th>
                  <th className="text-right px-4 py-3">{t('sale_price')}</th>
                  <th className="text-right px-4 py-3">{t('stock')}</th>
                  <th className="text-right px-4 py-3">{t('min_stock')}</th>
                  <th className="text-right px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 divide-gray-100">
                {filteredItems.map(({ item, index }) => {
                  const isSelected = index === selectedIndex;
                  const isLow = item.isActive !== false && Number(item.stock || 0) <= Number(item.minStock || 0);
                  return (
                    <tr
                      key={item.id || `new-${index}`}
                      onClick={() => setSelectedIndex(index)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-bold dark:text-white text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">
                        {formatCurrencyAmount(item.price, item.price_currency || 'USD')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono dark:text-gray-200 text-gray-700">{item.stock}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{item.minStock}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-black ${
                          item.isActive === false
                            ? 'bg-gray-500/10 text-gray-500'
                            : isLow
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-emerald-500/10 text-emerald-600'
                        }`}>
                          {item.isActive === false ? t('inactive') : isLow ? t('low_stock') : t('active')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                      No inventory items match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-xl border dark:border-gray-700 border-gray-200 bg-white dark:bg-gray-800 p-4 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black dark:text-white text-gray-800">Item Details</h3>
            {selectedItem && canEditCatalog && (
              <button
                type="button"
                onClick={() => toggleActive(selectedIndex)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  selectedItem.isActive === false
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-gray-500/10 text-gray-500'
                }`}
              >
                {selectedItem.isActive === false ? 'Activate' : 'Deactivate'}
              </button>
            )}
          </div>

          {selectedItem ? (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">{t('item_name')}</span>
                <input
                  value={selectedItem.name}
                  onChange={event => updateItem('name', event.target.value)}
                  disabled={!canEditCatalog}
                  className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white disabled:opacity-60"
                />
              </label>

              <div className="grid grid-cols-[0.9fr_1fr] gap-2">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Currency</span>
                  <select
                    value={selectedItem.price_currency || 'USD'}
                    onChange={event => updateItem('price_currency', event.target.value)}
                    disabled={!canEditCatalog}
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white disabled:opacity-60"
                  >
                    {currencyOptions.map(option => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">{t('sale_price')}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selectedItem.price}
                    onChange={event => updateItem('price', event.target.value)}
                    disabled={!canEditCatalog}
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="grid grid-cols-[0.9fr_1fr] gap-2">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Currency</span>
                  <select
                    value={selectedItem.cost_currency || 'USD'}
                    onChange={event => updateItem('cost_currency', event.target.value)}
                    disabled={!canEditCatalog}
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white disabled:opacity-60"
                  >
                    {currencyOptions.map(option => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">{t('cost_price')}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selectedItem.cost_price}
                    onChange={event => updateItem('cost_price', event.target.value)}
                    disabled={!canEditCatalog}
                    className="w-full px-3 py-2 rounded-lg border text-sm dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">{t('stock')}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={selectedItem.stock}
                    onChange={event => updateItem('stock', event.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase text-gray-400 mb-1">{t('min_stock')}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={selectedItem.minStock}
                    onChange={event => updateItem('minStock', event.target.value)}
                    disabled={!canEditCatalog}
                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono dark:bg-gray-900 bg-gray-50 dark:border-gray-700 border-gray-200 dark:text-white disabled:opacity-60"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold disabled:opacity-60"
              >
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'} mr-2`} />
                {t('save_inventory')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Select an item to edit.</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default InventoryManager;
