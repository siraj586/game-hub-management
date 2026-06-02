const BuffetItemGrid = ({
  items,
  onItemClick,
  disabled = false,
  getItemDisabled,
  stockLabel = 'Stock',
  columns = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}) => {
  if (!items.length) {
    return (
      <p className="text-center text-sm text-gray-500 py-8 col-span-full">
        <i className="fas fa-coffee mb-2 block text-2xl opacity-40" />
        No items available
      </p>
    );
  }

  return (
    <div className={`grid ${columns} gap-3`}>
      {items.map((item) => {
        const itemDisabled = disabled || (getItemDisabled ? getItemDisabled(item) : item.stock < 1);
        return (
          <button
            key={item.id}
            type="button"
            disabled={itemDisabled}
            onClick={() => onItemClick(item)}
            className={`flex flex-col p-3 rounded-xl border transition text-left
              ${itemDisabled
                ? 'opacity-40 cursor-not-allowed grayscale dark:bg-gray-800 bg-gray-100 border-gray-300 dark:border-gray-700'
                : 'hover:border-amber-500 hover:shadow-md active:scale-95 dark:bg-gray-800/80 bg-white border-gray-200 dark:border-gray-600'
              }`}
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500 mb-2">
              <i className="fas fa-mug-hot text-sm" />
            </div>
            <span className="font-bold text-sm dark:text-white text-gray-800 truncate">{item.name}</span>
            <span className="text-amber-600 dark:text-amber-400 font-black">${item.price.toFixed(2)} USD</span>
            {item.local_price !== null && item.local_price !== undefined && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {item.local_price.toFixed(2)} {item.local_currency_code}
              </span>
            )}
            <span className={`text-[10px] font-mono mt-1 ${item.stock < 1 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {item.stock} {stockLabel}
            </span>
            {item.lowStock && (
              <span className="mt-1 text-[10px] font-black text-red-500">
                Low stock
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default BuffetItemGrid;
