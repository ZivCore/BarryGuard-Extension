import { BarryGuardApiClient } from '../shared/api-client';
import { TokenCache } from '../shared/cache';
import { extractPumpFunEmbeddedMetadata } from '../shared/pumpfun-metadata';
import { sanitizeCustomerPortalUrl } from '../shared/runtime-config';
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
} from '../shared/types';

const api = new BarryGuardApiClient();
const cache = new TokenCache();

const AUTH_KEY = 'auth_token';
const PROFILE_KEY = 'user_profile';
const PROFILE_SYNC_AT_KEY = 'profile_synced_at';
const SINGLE_ANALYSIS_KEY = 'single_analysis_state';
const HOURLY_USAGE_KEY = 'hourly_usage_state';
const ANONYMOUS_HOURLY_LIMIT = 10;
const FREE_HOURLY_LIMIT = 100;
const FREE_COOLDOWN_SECONDS = 10;
const ANONYMOUS_COOLDOWN_SECONDS = FREE_COOLDOWN_SECONDS;
const PROFILE_REFRESH_MAX_AGE_MS = 60 * 1000;
const DEFAULT_LIST_REQUEST_LIMIT: Record<TierLevel, number> = {
  free: 0,
  rescue_pass: 500,
  pro: 2000,
};

interface SingleAnalysisState {
  lastAnalyzeAt?: number;
}

const DEFAULT_ACTION_ICON_PATHS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
} as const;

const PAID_ACTION_ICON_PATHS: Record<'rescue_pass' | 'pro', Record<number, string>> = {
  rescue_pass: {
    16: 'silver256.png',
    32: 'silver256.png',
    48: 'silver256.png',
    128: 'silver256.png',
  },
  pro: {
    16: 'gold256.png',
    32: 'gold256.png',
    48: 'gold256.png',
    128: 'gold256.png',
  },
};

type JsonRecord = Record<string, unknown>;

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

function normalizeTierValue(value: unknown): TierLevel | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'free') {
    return 'free';
  }

  if (['rescue_pass', 'rescue', 'premium', 'paid'].includes(normalized)) {
    return 'rescue_pass';
  }

  if (normalized === 'pro') {
    return 'pro';
  }

  return null;
}

function inferTier(record: JsonRecord, _depth = 0, allowGenericStatus = false): TierLevel {
  if (_depth > 3) return 'free';
  const directTier = normalizeTierValue(
    pickString(record, ['tier', 'plan', 'planTier', 'plan_tier', 'subscriptionTier', 'subscription_tier']),
  );
  if (directTier) {
    return directTier;
  }

  if (record.isPro === true || record.is_pro === true) {
    return 'pro';
  }

  if (
    record.isPaid === true
    || record.is_paid === true
    || record.hasSubscription === true
    || record.has_subscription === true
    || record.subscriptionActive === true
    || record.subscription_active === true
    || record.hasActiveSubscription === true
    || record.has_active_subscription === true
  ) {
    return 'rescue_pass';
  }

  const nestedSources = [
    asRecord(record.data),
    asRecord(record.user),
    asRecord(record.profile),
    asRecord(record.membership),
    asRecord(record.billing),
    asRecord(record.entitlements),
  ].filter((value): value is JsonRecord => Boolean(value));

  for (const source of nestedSources) {
    const nestedTier = inferTier(source, _depth + 1);
    if (nestedTier !== 'free') {
      return nestedTier;
    }
  }

  const nestedSubscription = asRecord(record.subscription);
  if (nestedSubscription) {
    const nestedSubscriptionTier = inferTier(nestedSubscription, _depth + 1, true);
    if (nestedSubscriptionTier !== 'free') {
      return nestedSubscriptionTier;
    }
  }

  const priceHint = pickString(record, [
    'priceId',
    'price_id',
    'stripePriceId',
    'stripe_price_id',
    'product',
    'productName',
    'product_name',
    'priceName',
    'price_name',
    'planName',
    'plan_name',
    'name',
  ]);
  if (priceHint) {
    const normalizedPriceHint = priceHint.toLowerCase();
    if (normalizedPriceHint.includes('pro')) {
      return 'pro';
    }
    if (normalizedPriceHint.includes('rescue')) {
      return 'rescue_pass';
    }
  }

  // Only check explicit subscription status fields — 'status' is too generic and can be spoofed
  const status = pickString(
    record,
    allowGenericStatus
      ? ['subscriptionStatus', 'subscription_status', 'status']
      : ['subscriptionStatus', 'subscription_status'],
  );
  if (status) {
    const normalizedStatus = status.toLowerCase();
    if (['active', 'trialing'].includes(normalizedStatus)) {
      return 'rescue_pass';
    }
  }

  return 'free';
}

async function getStoredToken(): Promise<AuthToken | null> {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  return stored[AUTH_KEY] ?? null;
}

async function getStoredProfile(): Promise<UserProfile | null> {
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  return stored[PROFILE_KEY] ?? null;
}

async function persistProfileState(profile: UserProfile): Promise<void> {
  await chrome.storage.local.set({
    [PROFILE_KEY]: profile,
    [PROFILE_SYNC_AT_KEY]: Date.now(),
  });
  await syncHourlyUsageState(profile);
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

async function clearSessionState(): Promise<void> {
  await chrome.storage.local.remove([AUTH_KEY, PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
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
    return storedProfile;
  }

  const storedToken = await getStoredToken();
  if (!storedToken) {
    const sessionProfile = await loadProfileFromApi();
    if (sessionProfile.success && sessionProfile.data) {
      await persistProfileState(sessionProfile.data);
      return sessionProfile.data;
    }

    if (isUnauthorizedResponse(sessionProfile)) {
      await chrome.storage.local.remove([PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
      await applyProfileState(null);
      return null;
    }

    if (storedProfile) {
      await chrome.storage.local.set({ [PROFILE_SYNC_AT_KEY]: Date.now() });
      await applyProfileState(storedProfile);
      return storedProfile;
    }

    await applyProfileState(null);
    return null;
  }

  api.setAuthToken(storedToken);
  const result = await fetchFreshProfile();
  if (result.refreshedToken) {
    await chrome.storage.local.set({ [AUTH_KEY]: result.refreshedToken });
  }

  if (result.response.success && result.response.data) {
    await persistProfileState(result.response.data);
    return result.response.data;
  }

  if (result.shouldClearSession) {
    await clearSessionState();
    return null;
  }

  if (storedProfile) {
    await chrome.storage.local.set({ [PROFILE_SYNC_AT_KEY]: Date.now() });
    await applyProfileState(storedProfile);
    return storedProfile;
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

async function initialize(): Promise<void> {
  await cache.init();
  await refreshProfileStateIfNeeded(true);
  console.log('[BarryGuard] Background worker initialized');
  return;

  const token = await getStoredToken();
  if (token) {
    api.setAuthToken(token as AuthToken);
    const profileResult = await fetchFreshProfile();
    if (profileResult.refreshedToken) {
      await chrome.storage.local.set({ [AUTH_KEY]: profileResult.refreshedToken });
    }

    if (profileResult.response.success && profileResult.response.data) {
      await persistProfileState(profileResult.response.data as UserProfile);
    } else if (profileResult.shouldClearSession) {
      await clearSessionState();
      // Refresh failed — clear session
    } else {
      const storedProfile = await getStoredNormalizedProfile();
      await applyProfileState(storedProfile);
    }
  } else {
    await applyProfileState(null);
  }

  console.log('[BarryGuard] Background worker initialized');
}

async function updateActionIcon(profile: UserProfile | null): Promise<void> {
  try {
    if (profile?.tier === 'pro' || profile?.tier === 'rescue_pass') {
      await chrome.action.setIcon({ path: PAID_ACTION_ICON_PATHS[profile.tier] });
      return;
    }

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
      typedProfile.singleTokenHourlyLimit ?? (tier === 'free' ? FREE_HOURLY_LIMIT : DEFAULT_LIST_REQUEST_LIMIT[tier]),
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

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

function extractCoinMetadataFromHtml(address: string, html: string): TokenMetadata {
  const embeddedMetadata = extractPumpFunEmbeddedMetadata(address, html);

  const headingName = html.match(/<h1[^>]*>([^<]{1,120})<\/h1>/i)?.[1];
  const titleSymbol = html.match(/<title>([A-Z0-9_]{2,20})\s+\$[^<]+<\/title>/i)?.[1];
  const pumpImage = html.match(new RegExp(`https://images\\.pump\\.fun/coin-image/${address}[^"'\\s<]+`, 'i'))?.[0];

  return {
    name: embeddedMetadata.name ? decodeHtml(embeddedMetadata.name) : headingName ? decodeHtml(headingName.trim()) : undefined,
    symbol: embeddedMetadata.symbol?.trim() || titleSymbol?.trim(),
    imageUrl: embeddedMetadata.imageUrl ? decodeHtml(embeddedMetadata.imageUrl) : pumpImage,
  };
}

async function getPumpFunMetadata(address: string): Promise<{ success: boolean; data?: TokenMetadata; error?: string }> {
  try {
    const response = await fetch(`https://pump.fun/coin/${address}`);
    if (!response.ok) {
      return { success: false, error: `Pump.fun metadata request failed with HTTP ${response.status}` };
    }

    const html = await response.text();
    const metadata = extractCoinMetadataFromHtml(address, html);

    if (!metadata.name && !metadata.symbol && !metadata.imageUrl) {
      return { success: false, error: 'No token metadata found on pump.fun.' };
    }

    return { success: true, data: metadata };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Pump.fun metadata lookup failed.',
    };
  }
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

  return profile.singleTokenCooldownSeconds ?? (profile.tier === 'free' ? FREE_COOLDOWN_SECONDS : 0);
}

function getHourlyLimit(profile: UserProfile | null): number {
  if (!profile) {
    return ANONYMOUS_HOURLY_LIMIT;
  }

  return profile.singleTokenHourlyLimit ?? (profile.tier === 'free' ? FREE_HOURLY_LIMIT : DEFAULT_LIST_REQUEST_LIMIT[profile.tier]);
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
  void profile;
  return null;
}

async function markUsageExhausted(profile: UserProfile | null): Promise<void> {
  void profile;
}

async function incrementHourlyUsage(profile: UserProfile | null, amount: number): Promise<void> {
  void profile;
  void amount;
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
      errorType: 'rate_limit',
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
  void profile;
  void requestedUnits;
  return null;
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(value: unknown): value is string {
  return typeof value === 'string' && SOLANA_ADDRESS_RE.test(value);
}

const _inFlightAddresses = new Set<string>();

async function getTokenScore(
  address: string,
  options: {
    skipLocalCache?: boolean;
    preferExistingOnly?: boolean;
  } = {},
) {
  if (_inFlightAddresses.has(address)) {
    return { success: false, error: 'Analysis already in progress for this token.', errorType: 'busy' as const };
  }
  if (!isValidSolanaAddress(address)) {
    return { success: false, error: 'Invalid token address format.', errorType: 'validation' as const };
  }
  _inFlightAddresses.add(address);
  try {
    const normalizedProfile = await refreshProfileStateIfNeeded();
    const tier: TierLevel = normalizedProfile?.tier ?? 'free';

    if (!options.skipLocalCache) {
      const cached = await cache.get(address, tier);
      if (cached) {
        return { success: true, data: { ...cached, cached: true } };
      }
    }

    const existing = await api.getTokenScore(address);
    if (existing.success && existing.data) {
      const normalizedExisting = sanitizeTokenScore(existing.data, { expectedAddress: address });
      if (normalizedExisting) {
        await cache.set(address, normalizedExisting, tier);
        return { success: true, data: { ...normalizedExisting, cached: true } };
      }
    }

    if (options.preferExistingOnly) {
      return mapApiFailure(existing);
    }

    const cooldown = await maybeEnforceSingleCooldown(normalizedProfile);
    if (cooldown) {
      return cooldown;
    }

    const hourlyLimit = await maybeEnforceHourlyLimit(normalizedProfile);
    if (hourlyLimit) {
      return hourlyLimit;
    }

    const fresh = await api.analyzeToken(address);
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

    if (fresh.statusCode === 429) {
      await markUsageExhausted(normalizedProfile);
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

  const hourlyLimit = await maybeEnforceHourlyLimit(normalizedProfile, missingAddresses.length);
  if (hourlyLimit) {
    return hourlyLimit as ApiResponse<TokenListAnalysisData>;
  }

  const response = await api.analyzeTokenList(missingAddresses);
  if (!response.success) {
    if (response.statusCode === 429) {
      await markUsageExhausted(normalizedProfile);
    }
    return mapApiFailure(response) as ApiResponse<TokenListAnalysisData>;
  }

  const networkScores = extractTokenScores(response.data, { allowedAddresses: missingAddresses });
  await incrementHourlyUsage(normalizedProfile, networkScores.length);
  for (const score of networkScores) {
    await cache.set(score.address, score, tier);
    scores.push({ ...score, cached: false });
  }

  return {
    success: true,
    data: {
      scores,
      cachedAddresses,
    },
  };
}

async function openPopupForToken(selectedToken: SelectedToken) {
  const hasMetadata = Boolean(
    selectedToken.metadata?.name
    || selectedToken.metadata?.symbol
    || selectedToken.metadata?.imageUrl,
  );
  const metadataResult = hasMetadata
    ? { success: false as const }
    : await getPumpFunMetadata(selectedToken.address);
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

function getTokenScorePayloadDetails(payload: unknown): {
  address: string | null;
  skipLocalCache: boolean;
  preferExistingOnly: boolean;
} {
  if (typeof payload === 'string') {
    return {
      address: payload,
      skipLocalCache: false,
      preferExistingOnly: false,
    };
  }

  const record = asRecord(payload);
  return {
    address: typeof record?.address === 'string' ? record.address : null,
    skipLocalCache: record?.skipLocalCache === true,
    preferExistingOnly: record?.preferExistingOnly === true,
  };
}

export function initializeBackground(): void {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    // Only accept messages from this extension's own pages (popup, content scripts, background)
    if (sender.id !== chrome.runtime.id) {
      respond({ success: false, error: 'Unauthorized sender' });
      return false;
    }
    (async () => {
      try {
        switch (message.type) {
          case 'GET_TOKEN_SCORE': {
            const payload = getTokenScorePayloadDetails(message.payload);
            respond(await getTokenScore(payload.address ?? '', {
              skipLocalCache: payload.skipLocalCache,
              preferExistingOnly: payload.preferExistingOnly,
            }));
            break;
          }
          case 'GET_TOKEN_SCORE_FRESH': {
            const payload = getTokenScorePayloadDetails(message.payload);
            respond(await getTokenScore(payload.address ?? '', {
              skipLocalCache: true,
              preferExistingOnly: true,
            }));
            break;
          }
          case 'ANALYZE_TOKEN':
            respond(await getTokenScore(message.payload));
            break;
          case 'ANALYZE_TOKEN_LIST':
            respond(await analyzeTokenList((message.payload?.addresses as string[] | undefined) ?? []));
            break;
          case 'GET_TOKEN_METADATA':
            if (!isValidSolanaAddress(message.payload)) {
              respond({ success: false, error: 'Invalid token address format.' });
              break;
            }
            respond(await getPumpFunMetadata(message.payload));
            break;
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
            const profile = await refreshProfileStateIfNeeded(true);
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
          case 'LOGIN': {
            const result = await api.login(message.payload.email, message.payload.password);
            if (result.success && result.data) {
              const normalizedUser = normalizeProfile({
                ...(asRecord(result.data) ?? {}),
                ...(asRecord(result.data.user) ?? {}),
              });
              await chrome.storage.local.set({ [AUTH_KEY]: result.data.token });
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
              await chrome.storage.local.set({ [AUTH_KEY]: result.data.token });
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
            await chrome.storage.local.remove([AUTH_KEY, PROFILE_KEY, PROFILE_SYNC_AT_KEY, HOURLY_USAGE_KEY]);
            await syncHourlyUsageState(null);
            await updateActionIcon(null);
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
