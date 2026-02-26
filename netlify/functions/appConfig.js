function envText(key, fallback = '') {
  const value = process.env[key];
  if (value === undefined || value === null) return String(fallback).trim();
  return String(value).trim();
}

function envBool(key, fallback = false) {
  const value = envText(key, '');
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function envNumber(key, fallback = 0) {
  const value = Number(envText(key, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export const APP_CONFIG = Object.freeze({
  PAYMENTS_MODE: envText('PAYMENTS_MODE', 'demo').toLowerCase(),
  IMAGE_UPGRADE_ENABLED: envBool('IMAGE_UPGRADE_ENABLED', true),
  IMAGE_VALIDATION_ENABLED: envBool('IMAGE_VALIDATION_ENABLED', true),
  LOGO_UPGRADE_PRICE_BASIC: envNumber('LOGO_UPGRADE_PRICE_BASIC', 25),
});

export const isDemoPaymentsMode = APP_CONFIG.PAYMENTS_MODE !== 'live';
