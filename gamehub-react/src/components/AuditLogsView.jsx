import { useApp } from '../context/AppContext';
import { isOwnerUser } from '../utils/permissions';

const AuditLogsView = () => {
  const { auditLogs, clearAuditLogs, currentUser } = useApp();

  const isOwner = isOwnerUser(currentUser);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold dark:text-white text-gray-800">System Activity Logs</h3>
        {isOwner && (
          <button 
            onClick={clearAuditLogs}
            className="px-4 py-2 border border-red-500/50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white transition"
          >
            <i className="fas fa-trash-alt mr-2"></i> Clear All Logs
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 text-[10px] uppercase font-black text-gray-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-10 text-center text-gray-400 opacity-50 italic">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                auditLogs.map(log => (
                  <tr key={log.id} className="text-[12px] dark:text-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3 whitespace-nowrap opacity-70">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-500">
                      {log.username}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span className="opacity-60">{log.resource_type}:</span> {log.resource_name}
                    </td>
                    <td className="px-4 py-3 italic">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 italic flex items-center gap-2">
        <i className="fas fa-info-circle"></i>
        Logs generated automatically whenever pricing or critical settings are updated. Only Owner can clear these logs.
      </p>
    </div>
  );
};

export default AuditLogsView;
