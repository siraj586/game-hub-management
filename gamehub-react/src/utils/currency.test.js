import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_CURRENCY,
  canManageCurrencySettings,
  convertMoney,
  getCurrencyOptions,
  isLocalCurrencyEnabled,
  localToUsd,
  usdToLocal,
} from './currency.js';

const enabledSettings = {
  base_currency_code: BASE_CURRENCY,
  local_currency_enabled: true,
  local_currency_code: 'SYP',
  local_currency_name: 'Syrian Pound',
  local_units_per_usd: '13800',
};

test('currency settings visibility is owner/settings gated', () => {
  assert.equal(canManageCurrencySettings({ manage_settings: true }), true);
  assert.equal(canManageCurrencySettings({ can_start_session: true }), false);
});

test('local currency options appear only when enabled with a positive rate', () => {
  assert.deepEqual(getCurrencyOptions({ local_currency_enabled: false }), [
    { code: 'USD', label: 'USD' },
  ]);
  assert.equal(isLocalCurrencyEnabled(enabledSettings), true);
  assert.deepEqual(getCurrencyOptions(enabledSettings), [
    { code: 'USD', label: 'USD' },
    { code: 'SYP', label: 'SYP' },
  ]);
});

test('conversion preview math uses configured manual rate', () => {
  assert.equal(localToUsd(27600, enabledSettings), 2);
  assert.equal(usdToLocal(2, enabledSettings), 27600);
  assert.equal(convertMoney(27600, 'SYP', 'USD', enabledSettings), 2);
  assert.equal(convertMoney(2, 'USD', 'SYP', enabledSettings), 27600);
  assert.equal(convertMoney(5, 'USD', 'USD', enabledSettings), 5);
});
