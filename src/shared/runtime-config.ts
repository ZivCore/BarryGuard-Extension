const DEFAULT_API_URL = 'https://barryguard.com/api';
const DEFAULT_APP_URL = 'https://barryguard.com';

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeAppUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getEnvValue(key: string): string | undefined {
  return import.meta.env[key];
}

export function getApiBaseUrl(): string {
  const configuredUrl = getEnvValue('BARRYGUARD_API_URL')
    || getEnvValue('WXT_BARRYGUARD_API_URL')
    || getEnvValue('VITE_BARRYGUARD_API_URL')
    || DEFAULT_API_URL;

  return normalizeApiUrl(configuredUrl);
}

export function getAppBaseUrl(): string {
  const configuredUrl = getEnvValue('BARRYGUARD_APP_URL')
    || getEnvValue('WXT_BARRYGUARD_APP_URL')
    || getEnvValue('VITE_BARRYGUARD_APP_URL')
    || DEFAULT_APP_URL;

  return normalizeAppUrl(configuredUrl);
}

export function getPricingUrl(): string {
  const configuredUrl = getEnvValue('BARRYGUARD_PRICING_URL')
    || getEnvValue('WXT_BARRYGUARD_PRICING_URL')
    || getEnvValue('VITE_BARRYGUARD_PRICING_URL');

  return configuredUrl ? normalizeAppUrl(configuredUrl) : `${getAppBaseUrl()}/pricing`;
}

export function getAccountUrl(): string {
  const configuredUrl = getEnvValue('BARRYGUARD_ACCOUNT_URL')
    || getEnvValue('WXT_BARRYGUARD_ACCOUNT_URL')
    || getEnvValue('VITE_BARRYGUARD_ACCOUNT_URL');

  return configuredUrl ? normalizeAppUrl(configuredUrl) : `${getAppBaseUrl()}/dashboard/account`;
}

export function getForgotPasswordUrl(): string {
  const configuredUrl = getEnvValue('BARRYGUARD_FORGOT_PASSWORD_URL')
    || getEnvValue('WXT_BARRYGUARD_FORGOT_PASSWORD_URL')
    || getEnvValue('VITE_BARRYGUARD_FORGOT_PASSWORD_URL');

  return configuredUrl ? normalizeAppUrl(configuredUrl) : `${getAppBaseUrl()}/forgot-password`;
}

export function getOAuthUrl(provider: 'google' | 'github'): string {
  return `${getAppBaseUrl()}/auth/${provider}?extension=true`;
}
