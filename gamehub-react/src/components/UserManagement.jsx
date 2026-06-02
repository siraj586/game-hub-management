import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  STAFF_PERMISSION_GROUPS,
  emptyStaffPermissions,
  isOwnerUser,
} from '../utils/permissions';

const PermissionGrid = ({ value, onChange, disabled = false }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {STAFF_PERMISSION_GROUPS.map(group => (
      <fieldset key={group.title} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <legend className="px-1 text-[11px] font-black uppercase tracking-widest text-gray-500">
          {group.title}
        </legend>
        <div className="mt-2 space-y-2">
          {group.permissions.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs dark:text-gray-300 text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(value?.[key])}
                disabled={disabled}
                onChange={e => onChange(key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    ))}
  </div>
);

const UserManagement = () => {
  const { users, addUser, updateUser, deleteUser } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [permissionDrafts, setPermissionDrafts] = useState({});
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    permissions: emptyStaffPermissions(),
  });

  const updateFormPermission = (key, checked) => {
    setFormData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: checked },
    }));
  };

  const updateDraftPermission = (userId, key, checked) => {
    setPermissionDrafts(prev => ({
      ...prev,
      [userId]: { ...emptyStaffPermissions(), ...(prev[userId] || {}), [key]: checked },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const created = await addUser({
      username: formData.username,
      password: formData.password,
      role: 'STAFF',
      permissions: formData.permissions,
    });
    if (!created) return;
    setFormData({ username: '', password: '', permissions: emptyStaffPermissions() });
    setIsAdding(false);
  };

  const handleSavePermissions = async (user) => {
    setSavingUserId(user.id);
    await updateUser(user.id, {
      role: 'STAFF',
      permissions: {
        ...emptyStaffPermissions(),
        ...(user.permissions || {}),
        ...(permissionDrafts[user.id] || {}),
      },
    });
    setSavingUserId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold dark:text-white text-gray-800">Staff Accounts & Permissions</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
        >
          {isAdding ? 'Cancel' : 'Add Staff User'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-indigo-500/30 space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Username</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 bg-white dark:border-gray-600 border-gray-300 dark:text-white text-sm"
              />
            </div>
          </div>
          <PermissionGrid value={formData.permissions} onChange={updateFormPermission} />
          <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm">
            Create Staff User
          </button>
        </form>
      )}

      <div className="space-y-4">
        {users.map(user => {
          const owner = isOwnerUser(user);
          const isStaff = user.role === 'STAFF';
          return (
            <div key={user.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 dark:bg-gray-800/40 bg-white">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="font-bold dark:text-white text-gray-800">{user.username}</p>
                  <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${owner ? 'bg-purple-500/20 text-purple-500' : 'bg-gray-500/20 text-gray-400'}`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isStaff && (
                    <button
                      onClick={() => handleSavePermissions(user)}
                      disabled={savingUserId === user.id}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingUserId === user.id ? 'Saving...' : 'Save Permissions'}
                    </button>
                  )}
                  <button onClick={() => deleteUser(user.id)} className="text-red-400 hover:text-red-600 p-2">
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              {isStaff ? (
                <PermissionGrid
                  value={{
                    ...emptyStaffPermissions(),
                    ...(user.permissions || {}),
                    ...(permissionDrafts[user.id] || {}),
                  }}
                  onChange={(key, checked) => updateDraftPermission(user.id, key, checked)}
                />
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
                  Owner accounts always have full access.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserManagement;
