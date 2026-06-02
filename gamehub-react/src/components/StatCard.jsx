const StatCard = ({ title, value, secondaryValue, icon, trend, trendUp, subText, onClick }) => (
  <div 
    onClick={onClick}
    className={`rounded-xl p-3 sm:p-4 shadow-sm transition-all border dark:bg-gray-800/80 bg-white/90 dark:border-gray-700 border-gray-200 
      ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-95 group' : ''}
    `}
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-[11px] sm:text-xs font-bold dark:text-gray-400 text-gray-500 group-hover:text-rose-500 transition-colors uppercase tracking-tight">{title}</p>
        <div className="text-xl sm:text-2xl font-bold mt-1 dark:text-white text-gray-800 break-words">{value}</div>
        {secondaryValue && (
          <p className="text-xs sm:text-sm font-black text-indigo-500 dark:text-indigo-300 mt-1 break-words">
            {secondaryValue}
          </p>
        )}
        {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
        {trend && (
          <p className={`text-xs mt-2 ${trendUp ? 'text-green-400' : 'text-red-400'}`}>{trend}</p>
        )}
      </div>
      <div className={`p-2.5 rounded-lg transition-colors ${onClick ? 'dark:bg-gray-700 bg-indigo-50 group-hover:bg-rose-500 group-hover:text-white' : 'dark:bg-gray-700 bg-indigo-50'}`}>
        <i className={`fas ${icon} text-lg sm:text-xl dark:text-rose-400 text-indigo-500 ${onClick ? 'group-hover:text-white' : ''}`}></i>
      </div>
    </div>
  </div>
);

export default StatCard;
