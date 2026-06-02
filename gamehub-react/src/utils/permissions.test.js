import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STAFF_PERMISSION_KEYS,
  emptyStaffPermissions,
  hasAnyPermission,
  hasPermission,
  isOwnerUser,
} from './permissions.js';

describe('permission helpers', () => {
  it('builds a false default for every staff permission', () => {
    const permissions = emptyStaffPermissions();

    assert.equal(Object.keys(permissions).length, STAFF_PERMISSION_KEYS.length);
    assert.equal(STAFF_PERMISSION_KEYS.every(key => permissions[key] === false), true);
  });

  it('checks individual and grouped permissions', () => {
    const permissions = {
      ...emptyStaffPermissions(),
      can_add_session_order: true,
    };

    assert.equal(hasPermission(permissions, 'can_add_session_order'), true);
    assert.equal(hasPermission(permissions, 'can_remove_session_order'), false);
    assert.equal(
      hasAnyPermission(permissions, ['can_remove_session_order', 'can_add_session_order']),
      true
    );
  });

  it('detects owner users from backend auth payloads', () => {
    assert.equal(isOwnerUser({ role: 'OWNER' }), true);
    assert.equal(isOwnerUser({ role: 'STAFF' }), false);
    assert.equal(isOwnerUser({ role: 'STAFF', is_superuser: true }), true);
  });
});
