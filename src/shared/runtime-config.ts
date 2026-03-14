const DEFAULT_API_URL = 'https://www.barryguard.com/api';
const DEFAULT_APP_URL = 'https://www.barryguard.com';
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);
const CUSTOMER_PORTAL_HOSTS = new Set(['billing.stripe.com']);
const EXPLORER_HOSTS = new Set(['solscan.io']);
const OAUTH_HOSTS = new Set(['accounts.google.com']);

function isLocalDevHost(hostname: string): boolean {
  return LOCALHOST_HOSTS.has(hostname);
}

function parseTrustedUrl(url: string, allowLocalHttp = false): URL {
  const parsed = new URL(url);
  if (parsed.protocol === 'https:') {
    return parsed;
  }

  if (allowLocalHttp && parsed.protocol === 'http:' && isLocalDevHost(parsed.hostname)) {
    return parsed;
  }

  throw new Error(`[BarryGuard] URL must use HTTPS${allowLocalHttp ? ' or localhost HTTP' : ''}. Received: "${url}"`);
}

function tryParseTrustedUrl(url: string, allowLocalHttp = false): URL | null {
  try {
    return parseTrustedUrl(url, allowLocalHttp);
  } catch {
    return null;
  }
}

function normalizeTrustedUrl(url: string, allowLocalHttp = false): string {
  const parsed = parseTrustedUrl(url, allowLocalHttp);
  parsed.hash = '';
  const normalized = parsed.toString().replace(/\/+$/, '');
  return normalized;
}

function matchesOrigin(url: URL, origin: string): boolean {
  return url.origin === origin;
}

function normalizeApiUrl(url: string): string {
  return normalizeTrustedUrl(url);
}

function normalizeAppUrl(url: string): string {
  return normalizeTrustedUrl(url, true);
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

export function getLoginUrl(): string {
  const configuredUrl = getEnvValue('BARRYGUARD_LOGIN_URL')
    || getEnvValue('WXT_BARRYGUARD_LOGIN_URL')
    || getEnvValue('VITE_BARRYGUARD_LOGIN_URL');

  return configuredUrl ? normalizeAppUrl(configuredUrl) : `${getAppBaseUrl()}/login`;
}

export function sanitizeExternalNavigationUrl(url: string): string | null {
  const parsed = tryParseTrustedUrl(url, true);
  if (!parsed) {
    return null;
  }

  return parsed.toString();
}

export function sanitizeAppNavigationUrl(url: string): string | null {
  const parsed = tryParseTrustedUrl(url, true);
  if (!parsed) {
    return null;
  }

  return matchesOrigin(parsed, new URL(getAppBaseUrl()).origin) ? parsed.toString() : null;
}

export function sanitizeCustomerPortalUrl(url: string): string | null {
  const parsed = tryParseTrustedUrl(url, true);
  if (!parsed) {
    return null;
  }

  const appOrigin = new URL(getAppBaseUrl()).origin;
  if (matchesOrigin(parsed, appOrigin) || CUSTOMER_PORTAL_HOSTS.has(parsed.hostname)) {
    return parsed.toString();
  }

  return null;
}

export function sanitizeOAuthNavigationUrl(url: string): string | null {
  const parsed = tryParseTrustedUrl(url, true);
  if (!parsed) {
    return null;
  }

  const appOrigin = new URL(getAppBaseUrl()).origin;
  if (matchesOrigin(parsed, appOrigin) || OAUTH_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith('.supabase.co')) {
    return parsed.toString();
  }

  return null;
}

export function normalizeOAuthNavigationUrl(url: string, provider: 'google'): string | null {
  const trusted = sanitizeOAuthNavigationUrl(url);
  if (!trusted) {
    return null;
  }

  const parsed = new URL(trusted);
  const appOrigin = new URL(getAppBaseUrl()).origin;
  if (parsed.origin !== appOrigin) {
    return parsed.toString();
  }

  if (parsed.pathname === `/auth/${provider}` || parsed.pathname === `/api/auth/${provider}`) {
    return null;
  }

  return parsed.toString();
}

export function sanitizeExplorerUrl(url: string): string | null {
  const parsed = tryParseTrustedUrl(url);
  if (!parsed) {
    return null;
  }

  return EXPLORER_HOSTS.has(parsed.hostname) ? parsed.toString() : null;
}
