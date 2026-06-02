export const STAFF_PERMISSION_GROUPS = [
  {
    title: 'Sessions',
    permissions: [
      ['can_start_session', 'Start sessions'],
      ['can_pause_session', 'Pause sessions'],
      ['can_resume_session', 'Resume sessions'],
      ['can_end_session', 'End sessions'],
    ],
  },
  {
    title: 'Orders & POS',
    permissions: [
      ['can_add_session_order', 'Add session orders'],
      ['can_remove_session_order', 'Remove session orders'],
      ['can_create_standalone_sale', 'Create standalone sales'],
      ['can_apply_discount', 'Apply discounts'],
    ],
  },
  {
    title: 'Reports & Inventory',
    permissions: [
      ['can_view_shift_report', 'View shift reports'],
      ['can_close_shift', 'Close shifts'],
      ['can_manage_inventory', 'Manage inventory'],
      ['can_update_stock', 'Update stock'],
      ['can_view_audit_logs', 'View audit logs'],
    ],
  },
];

export const STAFF_PERMISSION_KEYS = STAFF_PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(([key]) => key)
);

export const isOwnerUser = (user) =>
  Boolean(user?.is_superuser || user?.role === 'OWNER');

export const hasPermission = (permissions, key) => Boolean(permissions?.[key]);

export const hasAnyPermission = (permissions, keys) =>
  keys.some(key => hasPermission(permissions, key));

export const emptyStaffPermissions = () =>
  STAFF_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});
