export const BASE_CURRENCY = 'USD';

export const defaultCurrencySettings = {
  base_currency_code: BASE_CURRENCY,
  local_currency_enabled: false,
  local_currency_code: '',
  local_currency_name: '',
  local_units_per_usd: '',
};

export const canManageCurrencySettings = (permissions = {}) =>
  Boolean(permissions.manage_settings);

export const isLocalCurrencyEnabled = (settings = defaultCurrencySettings) =>
  Boolean(
    settings.local_currency_enabled &&
    settings.local_currency_code &&
    Number(settings.local_units_per_usd) > 0
  );

export const getCurrencyOptions = (settings = defaultCurrencySettings) => {
  const options = [{ code: BASE_CURRENCY, label: BASE_CURRENCY }];
  if (isLocalCurrencyEnabled(settings)) {
    options.push({
      code: settings.local_currency_code,
      label: settings.local_currency_code,
    });
  }
  return options;
};

export const roundMoney = (value) => {
  const number = Number(value || 0);
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

export const usdToLocal = (usdAmount, settings = defaultCurrencySettings) => {
  if (!isLocalCurrencyEnabled(settings)) return null;
  return roundMoney(Number(usdAmount || 0) * Number(settings.local_units_per_usd));
};

export const localToUsd = (localAmount, settings = defaultCurrencySettings) => {
  if (!isLocalCurrencyEnabled(settings)) return null;
  return roundMoney(Number(localAmount || 0) / Number(settings.local_units_per_usd));
};

export const convertMoney = (
  amount,
  fromCurrency,
  toCurrency,
  settings = defaultCurrencySettings
) => {
  const fromCode = (fromCurrency || BASE_CURRENCY).toUpperCase();
  const toCode = (toCurrency || BASE_CURRENCY).toUpperCase();
  if (fromCode === toCode) return roundMoney(amount);
  if (fromCode === BASE_CURRENCY && toCode === settings.local_currency_code) {
    return usdToLocal(amount, settings);
  }
  if (fromCode === settings.local_currency_code && toCode === BASE_CURRENCY) {
    return localToUsd(amount, settings);
  }
  return null;
};

export const formatCurrencyAmount = (amount, currency = BASE_CURRENCY, options = {}) => {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const defaultDigits = code === BASE_CURRENCY ? 2 : 0;
  const minimumFractionDigits = options.minimumFractionDigits ?? defaultDigits;
  const maximumFractionDigits = options.maximumFractionDigits ?? defaultDigits;

  return `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  })} ${code}`;
};
