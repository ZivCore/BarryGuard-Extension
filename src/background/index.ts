import { BarryGuardApiClient } from '../shared/api-client';
import { TokenCache, updateCacheTTL } from '../shared/cache';
import { logger } from '../shared/logger';
import { getApiBaseUrl, getExtensionHealthTelemetryEnabled, sanitizeCustomerPortalUrl } from '../shared/runtime-config';
import { extractTokenScores, sanitizeTokenScore } from '../shared/token-score';
import type {
  ApiResponse,
  HourlyUsageState,
  SelectedToken,
  TokenMetadata,
  TokenListAnalysisData,
  TokenScore,
  UserProfile,
  TierLevel,
  AuthToken,
  WatchlistAlert,
  WatchlistStatus,
} from '../shared/types';

const api = new BarryGuardApiClient();
const cache = new TokenCache();

const AUTH_KEY = 'auth_token';
const PROFILE_KEY = 'user_profile';
const PROFILE_SYNC_AT_KEY = 'profile_synced_at';
const SINGLE_ANALYSIS_KEY = 'single_analysis_state';
const HOURLY_USAGE_KEY = 'hourly_usage_state';
const ANONYMOUS_HOURLY_LIMIT = 10;
const FREE_HOURLY_LIMIT = 30;
const FREE_COOLDOWN_SECONDS = 10;
const ANONYMOUS_COOLDOWN_SECONDS = FREE_COOLDOWN_SECONDS;
const PROFILE_REFRESH_MAX_AGE_MS = 60 * 1000;
const DEFAULT_LIST_REQUEST_LIMIT: Record<TierLevel, number> = {
  free: 0,
  rescue_pass: 500,
  pro: 2000,
};
// Fallback limits — authoritative values are fetched from /api/config at startup
// and stored in _dynamicTierLimits. These must stay aligned with config.json.
const DEFAULT_HOURLY_ANALYSIS_LIMIT: Record<TierLevel, number> = {
  free: 30,
  rescue_pass: 250,
  pro: 1000,
};

const TIER_LIMITS_KEY = 'bg_tier_limits';
const USAGE_CORRECTION_GRACE_MS = 60_000; // Don't correct usage downward within 60s of an increment

interface StoredTierLimits {
  analysesPerHour: Partial<Record<TierLevel, number>>;
  cooldownSeconds: Partial<Record<TierLevel, number>>;
  syncedAt: number;
}

// Module-level state populated from /api/config and persisted in chrome.storage.local
let _dynamicTierLimits: StoredTierLimits | null = null;
// Timestamp of last local usage increment — guards against stale backend corrections
let _lastIncrementAt = 0;
// Sticky tier: prevents flicker during auth token refresh cycles
let _lastConfirmedTier: TierLevel | null = null;

interface SingleAnalysisState {
  lastAnalyzeAt?: number;
}

const DEFAULT_ACTION_ICON_PATHS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
} as const;

type JsonRecord = Record<string, unknown>;

const VALID_TIERS = ['free', 'rescue_pass', 'pro'] as const;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function pickString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function pickNumber(record: JsonRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function mergeRecords(...records: Array<JsonRecord | null>): JsonRecord {
  return records.reduce<JsonRecord>((acc, record) => (record ? { ...acc, ...record } : acc), {});
}

// inferTier reads the tier exclusively from the trusted 'tier' field (an explicit enum field).
// It does NOT derive tier from generic boolean flags, price hints, or subscription status fields
// to prevent tier upgrades from API-response manipulation.
// Uses _lastConfirmedTier as sticky fallback to prevent downgrade flicker during auth refresh.
function inferTier(data: unknown): TierLevel {
  if (!data || typeof data !== 'object') {
    if (_lastConfirmedTier) {
      logger.debug(`inferTier: no data, keeping last confirmed tier: ${_lastConfirmedTier}`);
      return _lastConfirmedTier;
    }
    return 'free';
  }
  const record = data as Record<string, unknown>;
  // Admins always get pro regardless of subscription tier
  const role = record['role'];
  if (role === 'admin') {
    _lastConfirmedTier = 'pro';
    return 'pro';
  }
  const tier = record['tier'];
  if (typeof tier === 'string' && VALID_TIERS.includes(tier as TierLevel)) {
    const newTier = tier as TierLevel;
    if (_lastConfirmedTier && newTier !== _lastConfirmedTier) {
      logger.debug(`Tier changed: ${_lastConfirmedTier} → ${newTier}`);
    }
    _lastConfirmedTier = newTier;
    return newTier;
  }
  // Tier field missing/invalid — keep last confirmed tier to avoid downgrade during token refresh
  if (_lastConfirmedTier) {
    logger.debug(`inferTier: tier field missing/invalid, keeping last confirmed tier: ${_lastConfirmedTier}`);
    return _lastConfirmedTier;
  }
  return 'free';
}

async function getStoredToken(): Promise<AuthToken | null> {
  // Auth token is stored in session storage (cleared on browser restart — more secure)
  const stored = await chrome.storage.session.get(AUTH_KEY);
  return stored[AUTH_KEY] ?? null;
}

async function getStoredProfile(): Promise<UserProfile | null> {
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  return stored[PROFILE_KEY] ?? null;
}

async function persistProfileState(profile: UserProfile): Promise<void> {
  logger.debug('persistProfileState called, hourlyAnalysesUsed:', profile.hourlyAnalysesUsed);
  // H-7: Clear cache when tier changes so stale data from a lower/higher tier doesn't persist
  const previousProfile = await getStoredProfile();
  const previousTier = previousProfile?.tier;

  // Strip stripeCustomerId — only needed server-side, should not persist in local storage
  const { stripeCustomerId: _ignored, ...profileToStore } = profile as UserProfile & { stripeCustomerId?: unknown };
  await chrome.storage.local.set({
    [PROFILE_KEY]: profileToStore,
    [PROFILE_SYNC_AT_KEY]: Date.now(),
  });

  if (previousTier && previousTier !== profile.tier) {
    await cache.clear();
  }

  // Sync hourly bucket (resets on hour change), then correct local counter
  // from the fresh profile's hourlyAnalysesUsed (backend is source of truth).
  await syncHourlyUsageState(profile);
  await correctLocalUsageFromBackend(profile);
  await updateActionIcon(profile);
}

async function applyProfileState(profile: UserProfile | null): Promise<void> {
  await syncHourlyUsageState(profile);
  await updateActionIcon(profile);
}

async function getStoredNormalizedProfile(): Promise<UserProfile | null> {
  const storedProfile = await getStoredProfile();
  return storedProfile ? normalizeProfile(storedProfile) : null;
}

async function clearSessionState(force = false): Promise<void> {
  // Guard: don't clear a profile that was just set by WEBSITE_SESSION_DETECTED
  if (!force) {
    const syncedAt = await getProfileSyncedAt();
    if (syncedAt && Date.now() - syncedAt < 5000) return;
  }
  // Auth token lives in session storage; profile data lives in local storage
  await chrome.storage.session.remove(AUTH_KEY);
  await chrome.storage.local.remove([PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
  api.clearAuthToken();
  await applyProfileState(null);
}

function isUnauthorizedResponse<T>(response: ApiResponse<T>): boolean {
  return response.statusCode === 401;
}

async function fetchFreshProfile(): Promise<{
  response: ApiResponse<UserProfile>;
  refreshedToken?: AuthToken;
  shouldClearSession: boolean;
}> {
  const result = await loadProfileFromApi();
  if (result.success && result.data) {
    return { response: result, shouldClearSession: false };
  }

  if (!isUnauthorizedResponse(result)) {
    return { response: result, shouldClearSession: false };
  }

  const refreshResult = await api.refreshToken();
  if (!refreshResult.success || !refreshResult.data) {
    return {
      response: {
        success: false,
        error: refreshResult.error,
        statusCode: refreshResult.statusCode,
        errorType: refreshResult.errorType,
        retryAfterSeconds: refreshResult.retryAfterSeconds,
      },
      shouldClearSession: isUnauthorizedResponse(refreshResult),
    };
  }

  const retryProfile = await loadProfileFromApi();
  return {
    response: retryProfile,
    refreshedToken: refreshResult.data,
    shouldClearSession: isUnauthorizedResponse(retryProfile),
  };
}

async function getProfileSyncedAt(): Promise<number | null> {
  const stored = await chrome.storage.local.get(PROFILE_SYNC_AT_KEY);
  const value = stored[PROFILE_SYNC_AT_KEY];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function refreshProfileStateIfNeeded(force = false): Promise<UserProfile | null> {
  const storedProfile = await getStoredNormalizedProfile();
  const syncedAt = await getProfileSyncedAt();
  const isFresh = !force && syncedAt !== null && Date.now() - syncedAt <= PROFILE_REFRESH_MAX_AGE_MS;
  if (storedProfile && isFresh) {
    // Re-hydrate the API client's in-memory auth token after service worker restarts.
    // Session storage survives restarts but the api instance is re-created empty.
    const token = await getStoredToken();
    if (token) {
      // If the access token is expired (or expires within 60s), fall through to
      // the full refresh path which handles token renewal via refresh_token.
      const isExpired = typeof token.expires_at === 'number'
        && token.expires_at * 1000 <= Date.now() + 60_000;
      if (isExpired) {
        // Don't return early — let the full refresh path handle token renewal
      } else {
        api.setAuthToken(token);
        return storedProfile;
      }
    }
  }

  const storedToken = await getStoredToken();
  if (!storedToken) {
    // No Bearer token — try cookie-based session (user logged in on website)
    const sessionResult = await api.validateSession();
    const sessionData = sessionResult.data as Record<string, unknown> | undefined;
    const sessionValid = sessionResult.success && sessionData && sessionData['valid'] !== false;
    if (sessionValid && sessionData) {
      // If the session response includes a token (cookie-based login), store it
      // so the extension can use Bearer auth going forward
      const sessionProfile = sessionResult.data as UserProfile & { token?: { access_token: string; refresh_token: string } };
      if (sessionProfile.token?.access_token) {
        await chrome.storage.session.set({ [AUTH_KEY]: sessionProfile.token });
        api.setAuthToken(sessionProfile.token as import('../shared/types').AuthToken);
      }

      const tierResult = await api.getUserTier();
      const storedProfile = await getStoredNormalizedProfile();
      const merged = tierResult.success && tierResult.data
        ? normalizeProfile({ ...sessionResult.data, ...tierResult.data })
        : mergeProfileWithFallback(sessionResult.data ?? {}, storedProfile);

      await persistProfileState(merged);
      return merged;
    }

    // Forced refresh without token and no valid cookie session -> clear stale local state
    if (force) {
      await chrome.storage.local.remove([PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
      await applyProfileState(null);
      return null;
    }

    // No valid session from cookies/token — but if we have a stored profile
    // (e.g. from a recent content script delivery), keep it instead of clearing.
    if (storedProfile) {
      await chrome.storage.local.set({ [PROFILE_SYNC_AT_KEY]: Date.now() });
      await applyProfileState(storedProfile);
      return storedProfile;
    }

    await chrome.storage.local.remove([PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
    await applyProfileState(null);
    return null;
  }

  api.setAuthToken(storedToken);
  const result = await fetchFreshProfile();
  if (result.refreshedToken) {
    await chrome.storage.session.set({ [AUTH_KEY]: result.refreshedToken });
  }

  if (result.response.success && result.response.data) {
    await persistProfileState(result.response.data);
    return result.response.data;
  }

  // When token refresh fails but we have a stored profile, keep it.
  // The content script on the website will deliver a fresh token within seconds.
  // Clearing aggressively causes tier loss between refresh cycles.
  if (storedProfile) {
    await chrome.storage.local.set({ [PROFILE_SYNC_AT_KEY]: Date.now() });
    await applyProfileState(storedProfile);
    return storedProfile;
  }

  if (result.shouldClearSession) {
    await clearSessionState();
    return null;
  }

  await applyProfileState(null);
  return null;
}

let _initPromise: Promise<void> | null = null;

function runInitializeOnce(): void {
  if (_initPromise) return;
  _initPromise = initialize().finally(() => {
    _initPromise = null;
  });
}

async function getStoredTierLimits(): Promise<StoredTierLimits | null> {
  const stored = await chrome.storage.local.get(TIER_LIMITS_KEY);
  return (stored[TIER_LIMITS_KEY] as StoredTierLimits | undefined) ?? null;
}

async function syncCacheTTLsFromApi(): Promise<void> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/config`);
    if (!response.ok) return;
    const data = await response.json() as {
      cache?: { ttlMinutes?: Partial<Record<string, number>> };
      auth?: { tiers?: Record<string, { analysesPerHour?: number; cooldownSeconds?: number }> };
    };

    // Sync cache TTLs
    const ttlMinutes = data?.cache?.ttlMinutes;
    if (ttlMinutes && typeof ttlMinutes === 'object') {
      const ttlMs: Partial<Record<TierLevel, number>> = {};
      if (typeof ttlMinutes['free'] === 'number')        ttlMs.free        = ttlMinutes['free'] * 60000;
      if (typeof ttlMinutes['rescue_pass'] === 'number') ttlMs.rescue_pass = ttlMinutes['rescue_pass'] * 60000;
      if (typeof ttlMinutes['pro'] === 'number')         ttlMs.pro         = ttlMinutes['pro'] * 60000;
      updateCacheTTL(ttlMs);
    }

    // Sync tier limits (analysesPerHour, cooldownSeconds) from server config
    const tiers = data?.auth?.tiers;
    if (tiers && typeof tiers === 'object') {
      const tierLimits: StoredTierLimits = {
        analysesPerHour: {},
        cooldownSeconds: {},
        syncedAt: Date.now(),
      };
      for (const [key, config] of Object.entries(tiers)) {
        if (VALID_TIERS.includes(key as TierLevel) && config && typeof config === 'object') {
          const t = key as TierLevel;
          if (typeof config.analysesPerHour === 'number') tierLimits.analysesPerHour[t] = config.analysesPerHour;
          if (typeof config.cooldownSeconds === 'number') tierLimits.cooldownSeconds[t] = config.cooldownSeconds;
        }
      }
      _dynamicTierLimits = tierLimits;
      await chrome.storage.local.set({ [TIER_LIMITS_KEY]: tierLimits });
    }
  } catch {
    // Non-fatal: extension continues with hardcoded defaults
  }
}

async function initialize(): Promise<void> {
  await cache.init();
  // Restore cached tier limits before API sync (service worker may have restarted)
  const storedLimits = await getStoredTierLimits();
  if (storedLimits) _dynamicTierLimits = storedLimits;
  await syncCacheTTLsFromApi();
  // M-8: Periodic re-sync of cache TTLs + tier limits from backend (every 30 minutes)
  setInterval(() => { void syncCacheTTLsFromApi(); }, 30 * 60 * 1000);
  // Content script is the sole auth authority — no periodic background refresh.
  // Load stored profile on startup (non-forced, won't clear if stale).
  await refreshProfileStateIfNeeded(false);
  logger.debug('Background worker initialized');
}

async function updateActionIcon(profile: UserProfile | null): Promise<void> {
  try {
    await chrome.action.setIcon({ path: DEFAULT_ACTION_ICON_PATHS });
  } catch {
    // Ignore icon update failures in unsupported environments.
  }
}

function normalizeProfile(profile: UserProfile | JsonRecord): UserProfile {
  const profileRecord = asRecord(profile) ?? {};
  const nestedData = asRecord(profileRecord.data) ?? {};
  const nestedUser = asRecord(profileRecord.user) ?? {};
  const nestedProfile = asRecord(profileRecord.profile) ?? {};
  const nestedSubscription = asRecord(profileRecord.subscription) ?? {};
  const nestedUsage = mergeRecords(
    asRecord(profileRecord.usage),
    asRecord(nestedData.usage),
    asRecord(nestedUser.usage),
    asRecord(nestedProfile.usage),
    asRecord(nestedSubscription.usage),
  );
  const nestedQuota = mergeRecords(
    asRecord(profileRecord.quota),
    asRecord(nestedData.quota),
    asRecord(nestedUser.quota),
    asRecord(nestedProfile.quota),
    asRecord(nestedSubscription.quota),
  );
  const nestedLimits = mergeRecords(
    asRecord(profileRecord.limits),
    asRecord(nestedData.limits),
    asRecord(nestedUser.limits),
    asRecord(nestedProfile.limits),
    asRecord(nestedSubscription.limits),
  );
  const nestedHourly = mergeRecords(
    asRecord(profileRecord.hourly),
    asRecord(nestedData.hourly),
    asRecord(nestedUser.hourly),
    asRecord(nestedProfile.hourly),
    asRecord(nestedSubscription.hourly),
    asRecord(nestedUsage.hourly),
    asRecord(nestedQuota.hourly),
    asRecord(nestedLimits.hourly),
  );
  const merged = {
    ...nestedData,
    ...nestedUser,
    ...nestedProfile,
    ...nestedSubscription,
    ...nestedUsage,
    ...nestedQuota,
    ...nestedLimits,
    ...nestedHourly,
    ...profileRecord,
  } as JsonRecord;
  const typedProfile = merged as Partial<UserProfile>;
  const tier = inferTier(merged);
  const stripeCustomerId =
    pickString(merged, ['stripeCustomerId', 'stripe_customer_id']) ?? typedProfile.stripeCustomerId;
  const subscriptionStatus =
    pickString(merged, ['subscriptionStatus', 'subscription_status']) ?? typedProfile.subscriptionStatus;
  const currentPeriodEnd =
    pickString(merged, ['currentPeriodEnd', 'current_period_end']) ?? typedProfile.currentPeriodEnd;
  const customerPortalUrl =
    pickString(merged, ['customerPortalUrl', 'customer_portal_url']) ?? typedProfile.customerPortalUrl;
  const hourlyAnalysesUsed =
    pickNumber(merged, [
      'hourlyAnalysesUsed',
      'hourly_analyses_used',
      'analysesThisHour',
      'analyses_this_hour',
      'usedThisHour',
      'used_this_hour',
      'usedInLastHour',
      'used_in_last_hour',
      'analysesUsedLastHour',
      'analyses_used_last_hour',
      'usage',
      'used',
    ])
    ?? typedProfile.hourlyAnalysesUsed;
  const hourlyAnalysesRemaining =
    pickNumber(merged, [
      'hourlyAnalysesRemaining',
      'hourly_analyses_remaining',
      'analysesRemainingThisHour',
      'analyses_remaining_this_hour',
      'remainingAnalysesThisHour',
      'remaining_analyses_this_hour',
      'remainingThisHour',
      'remaining_this_hour',
      'analysesRemaining',
      'analyses_remaining',
      'remaining',
    ]) ?? typedProfile.hourlyAnalysesRemaining;
  const explicitHourlyAnalysesLimit =
    pickNumber(merged, [
      'hourlyAnalysesLimit',
      'hourly_analyses_limit',
      'maxAnalysesPerHour',
      'max_analyses_per_hour',
      'maximumAnalysesPerHour',
      'maximum_analyses_per_hour',
      'maximumPerHour',
      'maximum_per_hour',
      'maxPerHour',
      'max_per_hour',
      'hourlyLimit',
      'hourly_limit',
      'limit',
      'max',
    ]) ?? typedProfile.hourlyAnalysesLimit;
  const hourlyAnalysesLimit =
    explicitHourlyAnalysesLimit
    ?? (
      typeof hourlyAnalysesUsed === 'number'
      && Number.isFinite(hourlyAnalysesUsed)
      && typeof hourlyAnalysesRemaining === 'number'
      && Number.isFinite(hourlyAnalysesRemaining)
        ? Math.max(0, hourlyAnalysesUsed) + Math.max(0, hourlyAnalysesRemaining)
        : undefined
    );
  const email = pickString(merged, ['email']) ?? typedProfile.email ?? '';
  const id = pickString(merged, ['id']) ?? typedProfile.id ?? email;

  return {
    ...(typedProfile as UserProfile),
    id,
    email,
    tier,
    capabilities: {
      singleTokenAnalysis: typedProfile.capabilities?.singleTokenAnalysis ?? true,
      tokenListAnalysis: typedProfile.capabilities?.tokenListAnalysis ?? tier !== 'free',
    },
    listRequestLimit: typedProfile.listRequestLimit ?? DEFAULT_LIST_REQUEST_LIMIT[tier],
    singleTokenCooldownSeconds:
      typedProfile.singleTokenCooldownSeconds ?? (tier === 'free' ? FREE_COOLDOWN_SECONDS : 0),
    singleTokenHourlyLimit:
      typedProfile.singleTokenHourlyLimit
        ?? _dynamicTierLimits?.analysesPerHour[tier]
        ?? DEFAULT_HOURLY_ANALYSIS_LIMIT[tier],
    hourlyAnalysesUsed,
    hourlyAnalysesRemaining,
    hourlyAnalysesLimit,
    stripeCustomerId,
    subscriptionStatus,
    currentPeriodEnd,
    customerPortalUrl: customerPortalUrl ? sanitizeCustomerPortalUrl(customerPortalUrl) ?? undefined : undefined,
  };
}

function mergeProfileWithFallback(
  profile: UserProfile | JsonRecord,
  fallbackProfile: UserProfile | null,
): UserProfile {
  if (!fallbackProfile) {
    return normalizeProfile(profile);
  }

  return normalizeProfile({
    ...fallbackProfile,
    ...profile,
  });
}

async function loadProfileFromApi(): Promise<ApiResponse<UserProfile>> {
  const session = await api.validateSession();
  if (!session.success || !session.data) {
    return session;
  }

  // /auth/session returns HTTP 200 with { valid: false } when token is expired.
  // Treat this as a 401 so fetchFreshProfile() triggers token refresh.
  if ((session.data as unknown as { valid?: boolean }).valid === false) {
    return { success: false, error: 'Session invalid', statusCode: 401 };
  }

  const tierResult = await api.getUserTier();
  if (!tierResult.success || !tierResult.data) {
    const storedProfile = await getStoredNormalizedProfile();
    return {
      success: true,
      data: mergeProfileWithFallback(session.data, storedProfile),
    };
  }

  return {
    success: true,
    data: mergeProfileWithFallback({
      ...session.data,
      ...tierResult.data,
    }, null),
  };
}

/**
 * Fetches token metadata from the BarryGuard backend (E-H3, E-M1, E-M8).
 *
 * The backend is the authoritative source for token name/symbol/logo (ADR-007).
 * All HTML parsing previously done in the service worker is now backend-only.
 * On failure, the popup shows a placeholder — no further Extension-side fetch occurs.
 */
async function getTokenMetadataFromBackend(
  address: string,
  chain: string = 'solana',
): Promise<{ success: boolean; data?: TokenMetadata; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}?source=content_script`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (api.getAuthToken()) {
      headers['Authorization'] = `Bearer ${api.getAuthToken()!.access_token}`;
    }
    const extensionVersion = (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.()?.version) ?? '';
    if (extensionVersion) headers['X-Extension-Version'] = String(extensionVersion);

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      return { success: false, error: `Backend metadata request failed with HTTP ${response.status}` };
    }

    const data = await response.json() as Record<string, unknown>;

    // Backend delivers tokenName, tokenSymbol, tokenLogoUrl in the TokenScore shape.
    // Map to the TokenMetadata shape used by the popup (name, symbol, imageUrl).
    const name = typeof data['tokenName'] === 'string' ? data['tokenName'] : undefined;
    const symbol = typeof data['tokenSymbol'] === 'string' ? data['tokenSymbol'] : undefined;
    // Only accept https imageUrl — backend already applies og-logo-policy whitelist.
    const rawLogoUrl = typeof data['tokenLogoUrl'] === 'string' ? data['tokenLogoUrl'] : undefined;
    const imageUrl = rawLogoUrl && rawLogoUrl.startsWith('https://') ? rawLogoUrl : undefined;

    if (!name && !symbol && !imageUrl) {
      return { success: false, error: 'No token metadata in backend response.' };
    }

    return { success: true, data: { name, symbol, imageUrl } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backend metadata lookup failed.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

interface DexScreenerPairsResponse {
  pairs?: Array<{
    pairAddress?: string;
    url?: string;
    baseToken?: { address?: string };
  }>;
}

/**
 * Resolves DexScreener pair addresses to token addresses (E-M10).
 *
 * Previously done in Content Scripts (dextools.ts / dexscreener.ts), now moved
 * to the Background service worker. This is the single rate-limit point for
 * all DexScreener API calls from the extension, consistent with ADR-007.
 *
 * The pair-to-token mapping result is returned to the Content Script via
 * the RESOLVE_DEX_PAIR message response.
 */
async function resolveDexPairs(
  pairAddresses: string[],
  chain: string,
): Promise<{ pairAddress: string; tokenAddress: string }[]> {
  if (pairAddresses.length === 0) return [];

  const BATCH_SIZE = 30;
  const TIMEOUT_MS = 10_000;
  const results: { pairAddress: string; tokenAddress: string }[] = [];

  const PAIR_HREF_PATTERN = /^\/[a-z0-9]+\/([a-z0-9]{20,80})(?:[/?#]|$)/i;

  for (let i = 0; i < pairAddresses.length; i += BATCH_SIZE) {
    const batch = pairAddresses.slice(i, i + BATCH_SIZE);
    const url = `https://api.dexscreener.com/latest/dex/pairs/${encodeURIComponent(chain)}/${batch.join(',')}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
      continue;
    }

    if (!response.ok) continue;

    let data: DexScreenerPairsResponse;
    try {
      data = await response.json() as DexScreenerPairsResponse;
    } catch {
      continue;
    }

    for (const pair of data.pairs ?? []) {
      const tokenAddress = pair.baseToken?.address;
      if (!tokenAddress) continue;

      if (pair.pairAddress) {
        results.push({ pairAddress: pair.pairAddress, tokenAddress });
      }

      const urlId = pair.url ? new URL(pair.url).pathname.match(PAIR_HREF_PATTERN)?.[1] : null;
      if (urlId) {
        results.push({ pairAddress: urlId, tokenAddress });
      }

      if (!urlId && batch.length === 1) {
        results.push({ pairAddress: batch[0], tokenAddress });
      }
    }
  }

  return results;
}

async function getSingleAnalysisState(): Promise<SingleAnalysisState> {
  const stored = await chrome.storage.local.get(SINGLE_ANALYSIS_KEY);
  return (stored[SINGLE_ANALYSIS_KEY] as SingleAnalysisState | undefined) ?? {};
}

async function setSingleAnalysisState(state: SingleAnalysisState): Promise<void> {
  await chrome.storage.local.set({ [SINGLE_ANALYSIS_KEY]: state });
}

function getCooldownSeconds(profile: UserProfile | null): number {
  if (!profile) {
    return ANONYMOUS_COOLDOWN_SECONDS;
  }

  return profile.singleTokenCooldownSeconds
    ?? _dynamicTierLimits?.cooldownSeconds[profile.tier]
    ?? (profile.tier === 'free' ? FREE_COOLDOWN_SECONDS : 0);
}

function getHourlyLimit(profile: UserProfile | null): number {
  if (!profile) {
    return ANONYMOUS_HOURLY_LIMIT;
  }

  return profile.singleTokenHourlyLimit
    ?? _dynamicTierLimits?.analysesPerHour[profile.tier]
    ?? DEFAULT_HOURLY_ANALYSIS_LIMIT[profile.tier];
}

function getUsageBucketKey(tier: TierLevel, audience: 'anonymous' | 'authenticated', timestamp = Date.now()): string {
  return `${audience}:${tier}:${Math.floor(timestamp / 3600000)}`;
}

async function getStoredHourlyUsageState(): Promise<HourlyUsageState | null> {
  const stored = await chrome.storage.local.get(HOURLY_USAGE_KEY);
  return (stored[HOURLY_USAGE_KEY] as HourlyUsageState | undefined) ?? null;
}

async function setHourlyUsageState(state: HourlyUsageState): Promise<void> {
  await chrome.storage.local.set({ [HOURLY_USAGE_KEY]: state });
}

async function syncHourlyUsageState(profile: UserProfile | null): Promise<HourlyUsageState | null> {
  const limit = getHourlyLimit(profile);
  const tier: TierLevel = profile?.tier ?? 'free';
  const audience: 'anonymous' | 'authenticated' = profile ? 'authenticated' : 'anonymous';
  const currentBucketKey = getUsageBucketKey(tier, audience);

  const stored = await getStoredHourlyUsageState();

  // Reset when the hourly bucket changes (new hour or tier/audience change)
  if (!stored || stored.bucketKey !== currentBucketKey) {
    const fresh: HourlyUsageState = {
      bucketKey: currentBucketKey,
      tier,
      audience,
      used: 0,
      limit,
      updatedAt: Date.now(),
    };
    await setHourlyUsageState(fresh);
    return fresh;
  }

  // Update limit in case it changed (e.g. profile updated)
  const synced: HourlyUsageState = { ...stored, limit };
  if (synced.limit !== stored.limit) {
    await setHourlyUsageState(synced);
  }
  return synced;
}

async function markUsageExhausted(profile: UserProfile | null): Promise<void> {
  const state = await syncHourlyUsageState(profile);
  if (!state) return;
  // Use backend count if available and higher than local, otherwise set to limit.
  // Prevents over-inflation when a batch 429 fires after only a few tokens were counted.
  const backendUsed = profile?.hourlyAnalysesUsed;
  const used = typeof backendUsed === 'number' && backendUsed > state.used
    ? backendUsed
    : state.limit;
  const exhausted: HourlyUsageState = { ...state, used, updatedAt: Date.now() };
  await setHourlyUsageState(exhausted);
}

async function syncUsageFromQuotaError<T>(profile: UserProfile | null, response: ApiResponse<T>): Promise<void> {
  const state = await syncHourlyUsageState(profile);
  if (!state) return;

  const limit = typeof response.limit === 'number' && Number.isFinite(response.limit)
    ? Math.max(0, response.limit)
    : state.limit;
  const used = typeof response.used === 'number' && Number.isFinite(response.used)
    ? Math.max(0, response.used)
    : limit;

  await setHourlyUsageState({
    ...state,
    limit,
    used: Math.min(used, limit),
    updatedAt: Date.now(),
  });
}

function isQuotaExceededResponse<T>(response: ApiResponse<T>): boolean {
  if (response.statusCode !== 429) {
    return false;
  }

  if (response.errorType !== 'rate_limit' || response.errorCode !== 'RATE_LIMIT') {
    return false;
  }

  return typeof response.limit === 'number'
    && Number.isFinite(response.limit)
    && typeof response.used === 'number'
    && Number.isFinite(response.used)
    && response.used >= response.limit;
}

async function incrementHourlyUsage(profile: UserProfile | null, amount: number): Promise<void> {
  const state = await syncHourlyUsageState(profile);
  if (!state) return;
  const updated: HourlyUsageState = { ...state, used: state.used + amount, updatedAt: Date.now() };
  await setHourlyUsageState(updated);
  _lastIncrementAt = Date.now();
}

/**
 * Correct the local hourly usage counter from the backend's authoritative count.
 * Always syncs when the backend reports a different value — covers drift from
 * batch parse mismatches, 429 over-inflation, and concurrent request races.
 * Relies on profile.hourlyAnalysesUsed being delivered by the content script
 * on barryguard.com (via WEBSITE_SESSION_DETECTED, every 60s).
 */
async function correctLocalUsageFromBackend(profile: UserProfile | null): Promise<void> {
  if (!profile) return;

  // Grace period: skip correction if a local increment happened recently.
  // The backend's hourlyAnalysesUsed may not yet reflect the latest analyses
  // (profile sync is periodic), so correcting now would erase valid local counts.
  if (Date.now() - _lastIncrementAt < USAGE_CORRECTION_GRACE_MS) return;

  const state = await getStoredHourlyUsageState();
  if (!state) return;

  // If the bucket key has changed (new hour), syncHourlyUsageState already reset to 0.
  const currentBucketKey = getUsageBucketKey(profile.tier, profile ? 'authenticated' : 'anonymous');
  if (state.bucketKey !== currentBucketKey) return;

  // Only correct downward — backend reporting lower usage means local over-counted
  // (from 429 over-inflation, batch mismatches, etc.). Never correct upward because
  // the stored profile may have stale hourlyAnalysesUsed from a previous hour.
  const backendUsed = profile.hourlyAnalysesUsed;
  logger.debug('correctLocalUsage:', { localUsed: state.used, backendUsed, bucketKey: state.bucketKey, willCorrect: typeof backendUsed === 'number' && backendUsed < state.used });
  if (typeof backendUsed === 'number' && backendUsed < state.used) {
    logger.debug('Correcting usage:', state.used, '->', backendUsed);
    await setHourlyUsageState({ ...state, used: backendUsed, updatedAt: Date.now() });
  }
}

function mapApiFailure<T>(response: ApiResponse<T>): ApiResponse<T> {
  if (response.success) {
    return response;
  }

  if (response.statusCode === 403) {
    return {
      ...response,
      errorType: 'plan_gate',
      error: response.error ?? 'This feature is not available on your current plan.',
    };
  }

  if (response.statusCode === 429) {
    if (response.errorType === 'cooldown') {
      return {
        ...response,
        errorType: 'cooldown',
        error: response.error ?? 'Cooldown active. Please try again shortly.',
      };
    }

    // Check for anonymous daily limit vs hourly rate limit
    if (response.errorCode === 'ANON_DAILY_LIMIT') {
      return {
        ...response,
        errorType: 'anon_daily_limit',
        error: response.error ?? 'Anonymous daily limit reached. Please log in to continue.',
      };
    }
    return {
      ...response,
      errorType: response.errorType ?? 'rate_limit',
      error: response.error ?? 'Rate limit reached. Please try again later.',
    };
  }

  return {
    ...response,
    errorType: response.errorType ?? 'server',
  };
}

async function maybeEnforceSingleCooldown(profile: UserProfile | null): Promise<ApiResponse<never> | null> {
  const cooldownSeconds = getCooldownSeconds(profile);
  if (cooldownSeconds <= 0) {
    return null;
  }

  const state = await getSingleAnalysisState();
  const lastAnalyzeAt = state.lastAnalyzeAt ?? 0;
  const elapsedSeconds = Math.floor((Date.now() - lastAnalyzeAt) / 1000);
  if (!lastAnalyzeAt || elapsedSeconds >= cooldownSeconds) {
    return null;
  }

  const retryAfterSeconds = cooldownSeconds - elapsedSeconds;
  return {
    success: false,
    error: `Free plan cooldown active. Try again in ${retryAfterSeconds}s.`,
    statusCode: 429,
    errorType: 'cooldown',
    retryAfterSeconds,
  };
}

async function maybeEnforceHourlyLimit(
  profile: UserProfile | null,
  requestedUnits = 1,
): Promise<ApiResponse<never> | null> {
  let state = await syncHourlyUsageState(profile);
  if (!state) return null;

  if (state.used + requestedUnits <= state.limit) {
    return null;
  }

  // Local extension state can be stale across hour boundaries or after 429 over-inflation.
  // Before blocking a user, force-refresh the profile once and reconcile from the backend.
  if (profile) {
    const refreshedProfile = await refreshProfileStateIfNeeded(true);
    if (refreshedProfile) {
      await syncHourlyUsageState(refreshedProfile);
      await correctLocalUsageFromBackend(refreshedProfile);
      state = await syncHourlyUsageState(refreshedProfile) ?? state;
      if (state.used + requestedUnits <= state.limit) {
        return null;
      }
    }
  }

  // Compute seconds until the next hourly bucket starts
  const msUntilReset = 3600000 - (Date.now() % 3600000);
  const retryAfterSeconds = Math.ceil(msUntilReset / 1000);
  return {
    success: false,
    error: `Hourly limit reached (${state.used}/${state.limit}). Resets in ${retryAfterSeconds}s.`,
    statusCode: 429,
    errorType: 'rate_limit',
    retryAfterSeconds,
  };
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(value: unknown): value is string {
  return typeof value === 'string' && SOLANA_ADDRESS_RE.test(value);
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

function isValidEvmAddress(value: unknown): value is string {
  return typeof value === 'string' && EVM_ADDRESS_RE.test(value);
}

function isValidTokenAddress(address: unknown, chain: string): address is string {
  if (chain === 'solana') {
    return isValidSolanaAddress(address);
  }
  return isValidEvmAddress(address);
}

const _inFlightAddresses = new Set<string>();

async function getTokenScore(address: string, chain: string = 'solana') {
  if (_inFlightAddresses.has(address)) {
    return { success: false, error: 'Analysis already in progress for this token.', errorType: 'busy' as const };
  }
  if (!isValidTokenAddress(address, chain)) {
    return { success: false, error: 'Invalid token address format.', errorType: 'validation' as const };
  }
  _inFlightAddresses.add(address);
  try {
    const normalizedProfile = await refreshProfileStateIfNeeded();
    const tier: TierLevel = normalizedProfile?.tier ?? 'free';

    // 1. Local cache (skip if it has locked checks for a paid user — stale free-tier gated result)
    const cached = await cache.get(address, tier);
    if (cached) {
      const cachedHasLocked = cached.checks
        && Object.values(cached.checks).some(
          (c) => c && typeof c === 'object' && (c as unknown as Record<string, unknown>).locked === true,
        );
      if (!(cachedHasLocked && tier !== 'free')) {
        return { success: true, data: { ...cached, cached: true } };
      }
    }

    // 2. Server cache: GET /api/token/[address]
    const existing = await api.getTokenScore(address, chain);
    if (existing.success && existing.data) {
      const normalizedExisting = sanitizeTokenScore(existing.data, { expectedAddress: address });
      if (normalizedExisting) {
        // Don't cache or return results with locked checks for paid users —
        // this means the request went out without proper auth and the backend
        // returned free-tier gated checks.  Fall through to fresh analysis.
        const hasLockedChecks = normalizedExisting.checks
          && Object.values(normalizedExisting.checks).some(
            (c) => c && typeof c === 'object' && (c as unknown as Record<string, unknown>).locked === true,
          );
        if (hasLockedChecks && tier !== 'free') {
          // Skip — proceed to fresh analysis with proper auth
        } else {
          await cache.set(address, normalizedExisting, tier);
          return { success: true, data: { ...normalizedExisting, cached: true } };
        }
      }
    }

    // 3. Cooldown/Limit checks
    await correctLocalUsageFromBackend(normalizedProfile);

    const cooldown = await maybeEnforceSingleCooldown(normalizedProfile);
    if (cooldown) {
      return cooldown;
    }

    const hourlyLimit = await maybeEnforceHourlyLimit(normalizedProfile);
    if (hourlyLimit) {
      return hourlyLimit;
    }

    // 4. Fresh analysis: POST /api/analyze
    const fresh = await api.analyzeToken(address, chain);
    if (fresh.success && fresh.data) {
      const normalizedFresh = sanitizeTokenScore(fresh.data, { expectedAddress: address });
      if (!normalizedFresh) {
        return {
          success: false,
          error: 'BarryGuard API returned malformed token score data.',
          errorType: 'server',
        };
      }

      if (tier === 'free') {
        await setSingleAnalysisState({ lastAnalyzeAt: Date.now() });
      }
      await incrementHourlyUsage(normalizedProfile, 1);

      await cache.set(address, normalizedFresh, tier);
      return { success: true, data: { ...normalizedFresh, cached: false } };
    }

    if (isQuotaExceededResponse(fresh)) {
      await syncUsageFromQuotaError(normalizedProfile, fresh);
    }

    return mapApiFailure(fresh);
  } finally {
    _inFlightAddresses.delete(address);
  }
}

async function analyzeTokenList(addresses: string[]): Promise<ApiResponse<TokenListAnalysisData>> {
  const deduped = [...new Set(addresses.filter((address): address is string => typeof address === 'string' && address.length > 0))];
  if (deduped.length === 0) {
    return { success: true, data: { scores: [], cachedAddresses: [] } };
  }

  const normalizedProfile = await refreshProfileStateIfNeeded();
  const tier = normalizedProfile?.tier ?? 'free';

  if (!normalizedProfile?.capabilities?.tokenListAnalysis) {
    return {
      success: false,
      error: 'List scanning is available on Rescue Pass and Pro.',
      statusCode: 403,
      errorType: 'plan_gate',
    };
  }

  const scores: TokenScore[] = [];
  const cachedAddresses: string[] = [];
  const missingAddresses: string[] = [];

  for (const address of deduped) {
    const cached = await cache.get(address, tier);
    if (cached) {
      scores.push({ ...cached, cached: true });
      cachedAddresses.push(address);
      continue;
    }

    missingAddresses.push(address);
  }

  if (missingAddresses.length === 0) {
    return { success: true, data: { scores, cachedAddresses } };
  }

  await correctLocalUsageFromBackend(normalizedProfile);

  const hourlyLimit = await maybeEnforceHourlyLimit(normalizedProfile, missingAddresses.length);
  if (hourlyLimit) {
    return hourlyLimit as ApiResponse<TokenListAnalysisData>;
  }

  const response = await api.analyzeTokenList(missingAddresses);
  if (!response.success) {
    if (isQuotaExceededResponse(response)) {
      await syncUsageFromQuotaError(normalizedProfile, response);
    }
    return mapApiFailure(response) as ApiResponse<TokenListAnalysisData>;
  }

  const networkScores = extractTokenScores(response.data, { allowedAddresses: missingAddresses });
  // Increment by requested count, not parsed count — backend counts all requested tokens
  await incrementHourlyUsage(normalizedProfile, missingAddresses.length);
  for (const score of networkScores) {
    await cache.set(score.address, score, tier);
    scores.push({ ...score, cached: false });
  }

  // M-7: Count locked checks across all scores so the popup can show "X tokens require upgrade"
  let lockedCount = 0;
  const responseRecord = response.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  if (Array.isArray(responseRecord)) {
    for (const item of responseRecord) {
      if (item && typeof item === 'object' && (item as Record<string, unknown>).locked === true) {
        lockedCount++;
      }
    }
  } else if (responseRecord) {
    const items = (responseRecord.results ?? responseRecord.scores ?? responseRecord.tokens ?? responseRecord.data ?? responseRecord.analyses) as unknown;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object' && (item as Record<string, unknown>).locked === true) {
          lockedCount++;
        }
      }
    }
  }

  return {
    success: true,
    data: {
      scores,
      cachedAddresses,
      lockedCount,
    },
  };
}

async function getWatchlistStatusForToken(address: string): Promise<ApiResponse<WatchlistStatus>> {
  if (!isValidSolanaAddress(address)) {
    return { success: false, error: 'Invalid token address format.', errorType: 'validation' };
  }

  const profile = await refreshProfileStateIfNeeded();
  if (!profile) {
    return { success: false, error: 'No active session.', statusCode: 401 };
  }

  return mapApiFailure(await api.getWatchlistStatus(address)) as ApiResponse<WatchlistStatus>;
}

async function addCurrentTokenToWatchlist(address: string): Promise<ApiResponse<WatchlistStatus>> {
  if (!isValidSolanaAddress(address)) {
    return { success: false, error: 'Invalid token address format.', errorType: 'validation' };
  }

  const profile = await refreshProfileStateIfNeeded();
  if (!profile) {
    return { success: false, error: 'No active session.', statusCode: 401 };
  }

  const response = await api.addToWatchlist(address);
  if (!response.success) {
    const failure = mapApiFailure(response);
    return {
      success: false,
      error: failure.error,
      statusCode: failure.statusCode,
      errorType: failure.errorType,
      errorCode: failure.errorCode,
      retryAfterSeconds: failure.retryAfterSeconds,
    };
  }

  return getWatchlistStatusForToken(address);
}

async function removeCurrentTokenFromWatchlist(address: string): Promise<ApiResponse<{ success: boolean }>> {
  if (!isValidSolanaAddress(address)) {
    return { success: false, error: 'Invalid token address format.', errorType: 'validation' };
  }

  const profile = await refreshProfileStateIfNeeded();
  if (!profile) {
    return { success: false, error: 'No active session.', statusCode: 401 };
  }

  return mapApiFailure(await api.removeFromWatchlist(address));
}

async function getWatchlistAlertsFeed(): Promise<ApiResponse<{ alerts: WatchlistAlert[]; unreadAlerts: number; hasAccess: boolean }>> {
  const profile = await refreshProfileStateIfNeeded();
  if (!profile) {
    return { success: false, error: 'No active session.', statusCode: 401 };
  }

  return mapApiFailure(await api.getWatchlistAlerts()) as ApiResponse<{ alerts: WatchlistAlert[]; unreadAlerts: number; hasAccess: boolean }>;
}

async function markWatchlistAlertAsRead(id: string): Promise<ApiResponse<{ success: boolean }>> {
  const profile = await refreshProfileStateIfNeeded();
  if (!profile) {
    return { success: false, error: 'No active session.', statusCode: 401 };
  }

  return mapApiFailure(await api.markWatchlistAlertRead(id));
}

async function openPopupForToken(selectedToken: SelectedToken) {
  const hasMetadata = Boolean(
    selectedToken.metadata?.name
    || selectedToken.metadata?.symbol
    || selectedToken.metadata?.imageUrl,
  );
  const metadataResult = hasMetadata
    ? { success: false as const }
    : await getTokenMetadataFromBackend(selectedToken.address, 'solana');
  const enrichedToken: SelectedToken = {
    ...selectedToken,
    metadata: {
      ...(selectedToken.metadata ?? {}),
      ...(metadataResult.success ? metadataResult.data : {}),
    },
  };

  await chrome.storage.local.set({ selectedToken: enrichedToken });

  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  }

  return { success: true };
}

// Exported for unit testing only — do not import these in production code
export {
  inferTier as _inferTierForTest,
  normalizeProfile as _normalizeProfileForTest,
  mergeProfileWithFallback as _mergeProfileWithFallbackForTest,
  getCooldownSeconds as _getCooldownSecondsForTest,
  syncHourlyUsageState as _syncHourlyUsageStateForTest,
  incrementHourlyUsage as _incrementHourlyUsageForTest,
  isUnauthorizedResponse as _isUnauthorizedResponseForTest,
  refreshProfileStateIfNeeded as _refreshProfileStateIfNeededForTest,
};

// Exported for unit testing only — do not import these in production code
export const SUPPORTED_PLATFORM_HOST_PATTERNS = [
  /^(www\.)?pump\.fun$/,
  /^amm\.pump\.fun$/,
  /^swap\.pump\.fun$/,
  /^(www\.)?raydium\.io$/,
  /^(www\.)?letsbonk\.fun$/,
  /^(www\.)?bonk\.fun$/,
  /^(www\.)?moonshot\.money$/,
  /^(www\.)?dexscreener\.com$/,
  /^(www\.)?dextools\.io$/,
  /^(www\.)?birdeye\.so$/,
  /^(www\.)?bags\.fm$/,
  /^(.+\.)?solscan\.io$/,
  /^dex\.coinmarketcap\.com$/,
  /^www\.coingecko\.com$/,
];

export function initializeBackground(): void {
  // Re-inject content script after Next.js soft navigations that kill the content script context.
  // Try sending a message first; if the content script is alive it responds. If dead, re-inject.
  // NOTE: Keep this list in sync with platform adapters + manifest `matches` / `host_permissions`.
  // Exported for unit tests to avoid drift.
  const SUPPORTED_HOST_PATTERNS = SUPPORTED_PLATFORM_HOST_PATTERNS;

  const TELEMETRY_DEBOUNCE_MS = 5 * 60 * 1000;
  const _telemetryDebounce = new Map<string, number>();

  type ExtensionHealthEventKind = 'anchor_not_found' | 'injection_failed' | 'scan_zero_tokens';

  function fnv1a32(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // unsigned 32-bit hex
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function derivePathTemplate(url: URL): string | null {
    let path = url.pathname ?? '/';
    // Locale-independent normalization (CoinGecko etc.)
    path = path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?\//i, '/');
    // Remove trailing slash for stability (except root)
    if (path.length > 1) {
      path = path.replace(/\/+$/, '');
    }
    // Mask potential token addresses
    path = path.replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, ':address');
    return path.slice(0, 180);
  }

  async function postExtensionHealthEvent(args: {
    platformId: string;
    eventKind: ExtensionHealthEventKind;
    tabId: number | null;
    tabUrl: string | null;
  }): Promise<void> {
    if (!getExtensionHealthTelemetryEnabled()) {
      return;
    }

    const extensionVersion = chrome.runtime.getManifest().version ?? '0.0.0';
    let url: URL | null = null;
    try {
      url = args.tabUrl ? new URL(args.tabUrl) : null;
    } catch {
      url = null;
    }

    const pathTemplate = url ? derivePathTemplate(url) : null;
    const urlHash = url ? fnv1a32(`${url.origin}${pathTemplate ?? url.pathname}`) : 'no_url';
    const tabKey = typeof args.tabId === 'number' ? String(args.tabId) : 'no_tab';
    const debounceKey = `${tabKey}:${urlHash}:${args.platformId}:${args.eventKind}`;
    const now = Date.now();
    const lastSentAt = _telemetryDebounce.get(debounceKey) ?? 0;
    if (now - lastSentAt < TELEMETRY_DEBOUNCE_MS) {
      return;
    }
    _telemetryDebounce.set(debounceKey, now);

    try {
      const endpoint = `${getApiBaseUrl()}/extension-health`;
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: args.platformId,
          event_kind: args.eventKind,
          extension_version: String(extensionVersion).slice(0, 64),
          path_template: pathTemplate,
        }),
      });
    } catch {
      // best-effort telemetry (no user impact)
    }
  }

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    try {
      const url = new URL(changeInfo.url);
      if (!SUPPORTED_HOST_PATTERNS.some((p) => p.test(url.hostname))) return;

      chrome.tabs.sendMessage(tabId, { type: 'PING' }).then((response) => {
        if (response?.pong) {
          // Content script alive — just tell it to re-scan
          chrome.tabs.sendMessage(tabId, { type: 'TAB_URL_CHANGED', url: changeInfo.url }).catch(() => {});
        }
      }).catch(() => {
        // Content script dead — re-inject it
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/pumpfun.js'],
        }).catch(() => { /* tab closed or no permission */ });
      });
    } catch { /* invalid URL */ }
  });

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    // Only accept messages from this extension's own pages (popup, content scripts, background)
    if (sender.id !== chrome.runtime.id) {
      respond({ success: false, error: 'Unauthorized sender' });
      return false;
    }
    (async () => {
      try {
        switch (message.type) {
          case 'REPORT_EXTENSION_HEALTH': {
            const payload = message.payload as { platformId?: unknown; eventKind?: unknown } | undefined;
            const platformId = typeof payload?.platformId === 'string' ? payload.platformId : '';
            const eventKind = payload?.eventKind;
            if (!platformId || (eventKind !== 'anchor_not_found' && eventKind !== 'injection_failed' && eventKind !== 'scan_zero_tokens')) {
              respond({ success: false, error: 'Invalid telemetry payload' });
              break;
            }

            await postExtensionHealthEvent({
              platformId,
              eventKind,
              tabId: sender.tab?.id ?? null,
              tabUrl: sender.tab?.url ?? null,
            });
            respond({ success: true });
            break;
          }
          case 'GET_TOKEN_SCORE': {
            const payload = message.payload as string | Record<string, unknown> | undefined;
            const address = typeof payload === 'string'
              ? payload
              : (typeof (payload as Record<string, unknown>)?.address === 'string'
                ? (payload as Record<string, unknown>).address as string
                : '');
            const chain = typeof payload === 'object' && payload !== null && typeof (payload as Record<string, unknown>).chain === 'string'
              ? (payload as Record<string, unknown>).chain as string
              : 'solana';
            respond(await getTokenScore(address, chain));
            break;
          }
          case 'ANALYZE_TOKEN': {
            const analyzePayload = message.payload as string | Record<string, unknown> | undefined;
            const analyzeAddress = typeof analyzePayload === 'string' ? analyzePayload
              : (typeof (analyzePayload as Record<string, unknown>)?.address === 'string'
                ? (analyzePayload as Record<string, unknown>).address as string
                : String(analyzePayload ?? ''));
            const analyzeChain = typeof analyzePayload === 'object' && analyzePayload !== null && typeof (analyzePayload as Record<string, unknown>).chain === 'string'
              ? (analyzePayload as Record<string, unknown>).chain as string
              : 'solana';
            respond(await getTokenScore(analyzeAddress, analyzeChain));
            break;
          }
          case 'ANALYZE_TOKEN_LIST':
            respond(await analyzeTokenList((message.payload?.addresses as string[] | undefined) ?? []));
            break;
          case 'GET_CACHED_SCORE': {
            const cachedAddress = typeof message.payload === 'string' ? message.payload : '';
            if (!isValidSolanaAddress(cachedAddress)) {
              respond({ success: false, error: 'Invalid address' });
              break;
            }
            const cachedProfile = await refreshProfileStateIfNeeded();
            const cachedTier: TierLevel = cachedProfile?.tier ?? 'free';
            const cachedScore = await cache.get(cachedAddress, cachedTier);
            respond(cachedScore
              ? { success: true, data: { ...cachedScore, cached: true } }
              : { success: false, error: 'Not in cache' }
            );
            break;
          }
          case 'GET_TOKEN_METADATA': {
            const metaPayload = message.payload as string | { address?: unknown; chain?: unknown } | undefined;
            const metaAddress = typeof metaPayload === 'string'
              ? metaPayload
              : (typeof (metaPayload as Record<string, unknown>)?.address === 'string'
                ? (metaPayload as Record<string, unknown>).address as string
                : '');
            const metaChain = typeof metaPayload === 'object' && metaPayload !== null && typeof (metaPayload as Record<string, unknown>).chain === 'string'
              ? (metaPayload as Record<string, unknown>).chain as string
              : 'solana';
            if (!isValidTokenAddress(metaAddress, metaChain)) {
              respond({ success: false, error: 'Invalid token address format.' });
              break;
            }
            respond(await getTokenMetadataFromBackend(metaAddress, metaChain));
            break;
          }
          case 'OPEN_POPUP_FOR_TOKEN': {
            const token = message.payload as SelectedToken;
            if (!isValidSolanaAddress(token?.address)) {
              respond({ success: false, error: 'Invalid token address format.' });
              break;
            }
            respond(await openPopupForToken(token));
            break;
          }
          case 'GET_USER_TIER': {
            // Prefer stored profile — it was set by the content script (sole auth authority)
            const profile = await getStoredNormalizedProfile() ?? await refreshProfileStateIfNeeded(false);
            respond(profile ? { success: true, data: profile } : { success: false, error: 'No active session.' });
            break;
          }
          case 'REFRESH_TOKEN_SCORE': {
            if (!isValidSolanaAddress(message.payload?.address)) {
              respond({ success: false, error: 'Invalid token address format.', errorType: 'validation' as const });
              break;
            }
            const chain = message.payload?.chain ?? 'solana';
            const refreshResult = await api.refreshTokenScore(message.payload.address, chain);
            if (refreshResult.success && refreshResult.data) {
              const normalized = sanitizeTokenScore(refreshResult.data, { expectedAddress: message.payload.address });
              if (normalized) {
                const normalizedProfile = await refreshProfileStateIfNeeded();
                const tier: TierLevel = normalizedProfile?.tier ?? 'free';
                await cache.set(message.payload.address, normalized, tier);
                respond({ success: true, data: { ...normalized, cached: false } });
              } else {
                respond({ success: false, error: 'Malformed token score data.', errorType: 'server' as const });
              }
            } else if (refreshResult.statusCode === 403) {
              respond({
                ...refreshResult,
                errorType: 'plan_gate' as const,
                error: 'Refresh is available on Rescue Pass and Pro plans.',
              });
            } else {
              respond(mapApiFailure(refreshResult));
            }
            break;
          }
          case 'GET_WATCHLIST_STATUS':
            respond(await getWatchlistStatusForToken(message.payload));
            break;
          case 'ADD_TO_WATCHLIST':
            respond(await addCurrentTokenToWatchlist(message.payload));
            break;
          case 'REMOVE_FROM_WATCHLIST':
            respond(await removeCurrentTokenFromWatchlist(message.payload));
            break;
          case 'GET_WATCHLIST_ALERTS':
            respond(await getWatchlistAlertsFeed());
            break;
          case 'MARK_WATCHLIST_ALERT_READ':
            respond(await markWatchlistAlertAsRead(message.payload));
            break;
          case 'RESOLVE_DEX_PAIR': {
            // E-M10: DexScreener API fetch moved from Content Script to Background.
            // Content scripts send { pairs: string[], chain: string } and receive
            // { results: { pairAddress: string; tokenAddress: string }[] }.
            const dexPayload = message.payload as { pairs?: unknown; chain?: unknown } | undefined;
            const rawPairs = Array.isArray(dexPayload?.pairs) ? dexPayload.pairs : [];
            const dexChain = typeof dexPayload?.chain === 'string' ? dexPayload.chain : 'solana';
            const validPairs = rawPairs.filter((p): p is string => typeof p === 'string' && p.length > 0);
            if (validPairs.length === 0) {
              respond({ success: true, data: { results: [] } });
              break;
            }
            const resolved = await resolveDexPairs(validPairs, dexChain);
            respond({ success: true, data: { results: resolved } });
            break;
          }
          case 'LOGIN': {
            const result = await api.login(message.payload.email, message.payload.password);
            if (result.success && result.data) {
              const normalizedUser = normalizeProfile({
                ...(asRecord(result.data) ?? {}),
                ...(asRecord(result.data.user) ?? {}),
              });
              // H-4: If token is null (e.g. email confirmation required), don't store auth or persist profile
              if (!result.data.token) {
                respond({ success: true, data: { ...normalizedUser, requiresEmailConfirmation: true } });
                break;
              }
              // Auth token stored in session storage (cleared on browser restart — more secure)
              await chrome.storage.session.set({ [AUTH_KEY]: result.data.token });
              await persistProfileState(normalizedUser);
              respond({ success: true, data: normalizedUser });
              break;
            }
            respond(result.success ? { success: true, data: result.data?.user } : mapApiFailure(result));
            break;
          }
          case 'REGISTER': {
            const result = await api.register(message.payload.email, message.payload.password);
            if (result.success && result.data) {
              const normalizedUser = normalizeProfile({
                ...(asRecord(result.data) ?? {}),
                ...(asRecord(result.data.user) ?? {}),
              });
              // H-4: If token is null (e.g. email confirmation required), don't store auth or persist profile
              if (!result.data.token) {
                respond({ success: true, data: { ...normalizedUser, requiresEmailConfirmation: true } });
                break;
              }
              // Auth token stored in session storage (cleared on browser restart — more secure)
              await chrome.storage.session.set({ [AUTH_KEY]: result.data.token });
              await persistProfileState(normalizedUser);
              respond({ success: true, data: normalizedUser });
              break;
            }
            respond(result.success ? { success: true, data: result.data?.user } : mapApiFailure(result));
            break;
          }
          case 'SEND_MAGIC_LINK': {
            const email = typeof message.payload?.email === 'string' ? message.payload.email.trim() : '';
            if (!email) {
              respond({ success: false, error: 'Email is required.' });
              break;
            }

            respond(await api.sendMagicLink(email));
            break;
          }
          case 'OAUTH_LOGIN':
            if (message.payload !== 'google') {
              respond({ success: false, error: 'Unsupported OAuth provider.' });
              break;
            }
            respond(await api.oauthLogin('google'));
            break;
          case 'LOGOUT':
            await api.logout();
            // Auth token lives in session storage; profile data lives in local storage
            await chrome.storage.session.remove(AUTH_KEY);
            await chrome.storage.local.remove([PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
            await syncHourlyUsageState(null);
            await updateActionIcon(null);
            respond({ success: true });
            break;
          case 'WEBSITE_SESSION_DETECTED': {
            // Content script is the sole auth authority — trust its session data directly
            const sessionPayload = message.payload as { token?: { access_token: string; refresh_token: string; expires_at?: number | null; token_type?: string }; profile?: unknown } | undefined;
            if (sessionPayload?.token?.access_token) {
              await chrome.storage.session.set({ [AUTH_KEY]: sessionPayload.token });
              api.setAuthToken(sessionPayload.token as import('../shared/types').AuthToken);
            }
            if (sessionPayload?.profile) {
              const profile = normalizeProfile(sessionPayload.profile as import('../shared/types').UserProfile);
              await persistProfileState(profile);
            } else {
              // Content script detected cookies but couldn't fetch session — try background refresh
              await refreshProfileStateIfNeeded(true);
            }
            respond({ success: true });
            break;
          }
          case 'REFRESH_USAGE': {
            // Popup requests a fresh usage state — always correct from backend profile
            const currentProfile = await getStoredNormalizedProfile() ?? await refreshProfileStateIfNeeded();
            // FIRST sync (resets counter to 0 on hour change), THEN correct from backend
            await syncHourlyUsageState(currentProfile);
            await correctLocalUsageFromBackend(currentProfile);
            respond({ success: true });
            break;
          }
          case 'WEBSITE_SESSION_LOST':
            // Website logged out — force-clear extension session
            await clearSessionState(true);
            respond({ success: true });
            break;
          default:
            respond({ success: false, error: 'Unknown message type' });
        }
      } catch (error) {
        respond({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();

    return true;
  });

  chrome.runtime.onInstalled.addListener(() => {
    runInitializeOnce();
  });
  chrome.runtime.onStartup.addListener(() => {
    runInitializeOnce();
  });
  runInitializeOnce();
}
