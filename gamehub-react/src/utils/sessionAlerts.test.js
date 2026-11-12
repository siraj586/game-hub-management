import test from 'node:test';
import assert from 'node:assert/strict';
import { findExpiredSessions } from './sessionAlerts.js';

const NOW = new Date('2026-11-04T20:00:00Z').getTime();
const prepaid = (overrides) => ({
  id: 1,
  sessionType: 'PRE',
  plannedEndTime: '2026-11-04T19:59:00Z',
  endTime: null,
  isPaused: false,
  ...overrides,
});

const expiredIds = (sessions, dismissed = new Set()) =>
  findExpiredSessions(sessions, dismissed, NOW).map((session) => session.id);

test('alerts for a running prepaid session whose time is up', () => {
  assert.deepEqual(expiredIds([prepaid()]), [1]);
});

test('alerts at the exact planned end', () => {
  assert.deepEqual(expiredIds([prepaid({ plannedEndTime: '2026-11-04T20:00:00Z' })]), [1]);
});

test('does not alert before the planned end', () => {
  assert.deepEqual(expiredIds([prepaid({ plannedEndTime: '2026-11-04T20:01:00Z' })]), []);
});

test('does not alert for ended, paused or postpaid sessions', () => {
  assert.deepEqual(
    expiredIds([
      prepaid({ id: 2, endTime: '2026-11-04T19:59:30Z' }),
      prepaid({ id: 3, isPaused: true }),
      prepaid({ id: 4, sessionType: 'POST' }),
      prepaid({ id: 5, plannedEndTime: null }),
    ]),
    [],
  );
});

test('does not alert again after dismissal', () => {
  assert.deepEqual(expiredIds([prepaid()], new Set([1])), []);
});
