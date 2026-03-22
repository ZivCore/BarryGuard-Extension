import type {
  ApiResponse,
  HourlyUsageState,
  SelectedToken,
  TierLevel,
  TokenMetadata,
  TokenScore,
  UserProfile,
  WatchlistAlert,
  WatchlistStatus,
} from '../shared/types';
import {
  getAccountUrl,
  getForgotPasswordUrl,
  getLoginUrl,
  normalizeOAuthNavigationUrl,
  getPricingUrl,
  sanitizeAppNavigationUrl,
  sanitizeCustomerPortalUrl,
  sanitizeExplorerUrl,
  sanitizeExternalNavigationUrl,
  sanitizeOAuthNavigationUrl,
} from '../shared/runtime-config';
import { shortenAddress } from '../shared/format';
import { isTokenScoreLikelyIncomplete } from '../shared/token-score';
import {
  getRiskLevel,
  renderChecks,
  renderReasons,
  renderSubscores,
  renderAnalysisFooter,
} from './render';

type ScreenName = 'loading' | 'token-detail' | 'login' | 'register' | 'account' | 'manual' | 'no-token';

interface RuntimeMessage {
  type: string;
  payload?: unknown;
}

interface PopupState {
  currentScreen: ScreenName;
  initialized: boolean;
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  selectedToken: SelectedToken | null;
  usageState: HourlyUsageState | null;
  watchlistStatus: WatchlistStatus | null;
  watchlistAlerts: WatchlistAlert[];
}

interface PlanBranding {
  brandLogo: string;
  tokenFallbackLogo: string;
  tierLogo: string;
}


const SCORE_REFRESH_BASE_DELAY_MS = 1500;
const MAX_SCORE_REFRESH_ATTEMPTS = 6;


const state: PopupState = {
  currentScreen: 'loading',
  initialized: false,
  isLoggedIn: false,
  userProfile: null,
  selectedToken: null,
  usageState: null,
  watchlistStatus: null,
  watchlistAlerts: [],
};

let isHydratingSelectedTokenMetadata = false;
let copyToastTimeoutId: number | null = null;
let scoreRefreshTimeoutId: number | null = null;
let scoreRefreshAddress: string | null = null;
let scoreRefreshAttempts = 0;

const elements = {
  screens: {
    loading: document.getElementById('loading'),
    tokenDetail: document.getElementById('token-detail-screen'),
    login: document.getElementById('login-screen'),
    register: document.getElementById('register-screen'),
    account: document.getElementById('account-screen'),
    manual: document.getElementById('manual-entry-screen'),
    noToken: document.getElementById('no-token-screen'),
  },
  brand: {
    logo: document.getElementById('brand-logo') as HTMLImageElement | null,
    usageIndicator: document.getElementById('usage-indicator'),
    usageDonut: document.getElementById('usage-donut'),
    usageRemaining: document.getElementById('usage-remaining'),
    usageLabel: document.getElementById('usage-label'),
    usageMeta: document.getElementById('usage-meta'),
  },
  tokenDetail: {
    tokenLogo: document.getElementById('token-logo') as HTMLImageElement | null,
    tokenName: document.getElementById('token-name'),
    tokenSymbol: document.getElementById('token-symbol'),
    tokenAddress: document.getElementById('token-address') as HTMLButtonElement | null,
    copyToast: document.getElementById('copy-toast'),
    scoreDonut: document.getElementById('score-donut'),
    scoreDonutRing: document.getElementById('score-donut-ring'),
    scoreValue: document.getElementById('score-value'),
    riskLabel: document.getElementById('risk-label'),
    checksList: document.getElementById('checks-list'),
    manualEntryBtn: document.getElementById('manual-entry-btn'),
    accountBtn: document.getElementById('account-btn'),
    viewExplorer: document.getElementById('view-explorer'),
    // V2 elements
    subscoresContainer: document.getElementById('subscores-container'),
    reasonsContainer: document.getElementById('reasons-container'),
    reasonsList: document.getElementById('reasons-list'),
    analyzedAt: document.getElementById('analyzed-at'),
    confidenceBadge: document.getElementById('confidence-badge'),
    refreshBtn: document.getElementById('refresh-btn'),
    viewFullAnalysis: document.getElementById('view-full-analysis'),
    watchlistToggleBtn: document.getElementById('watchlist-toggle-btn') as HTMLButtonElement | null,
    watchlistBadge: document.getElementById('watchlist-badge'),
    watchlistError: document.getElementById('watchlist-error'),
    watchlistAlertsSection: document.getElementById('watchlist-alerts-section'),
    watchlistAlertsList: document.getElementById('watchlist-alerts-list'),
  },
  login: {
    email: document.getElementById('email') as HTMLInputElement | null,
    password: document.getElementById('password') as HTMLInputElement | null,
    loginBtn: document.getElementById('login-btn') as HTMLButtonElement | null,
    magicLinkBtn: document.getElementById('magic-link-btn') as HTMLButtonElement | null,
    message: document.getElementById('login-message'),
    googleBtn: document.getElementById('google-login-btn'),
    backBtn: document.getElementById('login-back-btn'),
    forgotPassword: document.getElementById('forgot-password-link'),
    registerLink: document.getElementById('register-link'),
  },
  register: {
    email: document.getElementById('register-email') as HTMLInputElement | null,
    password: document.getElementById('register-password') as HTMLInputElement | null,
    passwordConfirm: document.getElementById('register-password-confirm') as HTMLInputElement | null,
    registerBtn: document.getElementById('register-btn') as HTMLButtonElement | null,
    termsCheckbox: document.getElementById('terms-checkbox') as HTMLInputElement | null,
    magicLinkBtn: document.getElementById('register-magic-link-btn') as HTMLButtonElement | null,
    message: document.getElementById('register-message'),
    googleBtn: document.getElementById('register-google-btn'),
    backBtn: document.getElementById('register-back-btn'),
    toLoginLink: document.getElementById('to-login-link'),
    error: document.getElementById('register-error'),
  },
  account: {
    email: document.getElementById('account-email'),
    tierBadge: document.getElementById('tier-badge'),
    tierLogo: document.getElementById('account-tier-logo') as HTMLImageElement | null,
    tierName: document.getElementById('tier-name'),
    periodEnd: document.getElementById('period-end'),
    subscriptionInfo: document.getElementById('subscription-info'),
    manageBtn: document.getElementById('manage-subscription-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    backBtn: document.getElementById('account-back-btn'),
  },
  manual: {
    addressInput: document.getElementById('token-address-input') as HTMLInputElement | null,
    analyzeBtn: document.getElementById('analyze-btn') as HTMLButtonElement | null,
    backBtn: document.getElementById('manual-back-btn'),
    error: document.getElementById('manual-error'),
  },
  noToken: {
    screen: document.getElementById('no-token-screen'),
    manualBtn: document.getElementById('no-token-manual-btn'),
  },
};

function getPlanBranding(tier: TierLevel | null | undefined): PlanBranding {
  switch (tier) {
    case 'pro':
      return {
        brandLogo: '/gold256.png',
        tokenFallbackLogo: '/gold256.png',
        tierLogo: '/gold256.png',
      };
    case 'rescue_pass':
      return {
        brandLogo: '/silver256.png',
        tokenFallbackLogo: '/silver256.png',
        tierLogo: '/silver256.png',
      };
    case 'free':
    default:
      return {
        brandLogo: '/logo.png',
        tokenFallbackLogo: '/logo128.png',
        tierLogo: '/logo128.png',
      };
  }
}

function applyPlanBranding(): void {
  const branding = getPlanBranding(state.userProfile?.tier);

  if (elements.brand.logo) {
    elements.brand.logo.src = branding.brandLogo;
  }

  if (elements.account.tierLogo) {
    elements.account.tierLogo.src = branding.tierLogo;
  }
}

function openExternal(url: string): boolean {
  const safeUrl = sanitizeExternalNavigationUrl(url);
  if (!safeUrl) {
    console.warn('[BarryGuard] Blocked unsafe external URL:', url);
    return false;
  }

  if (chrome.tabs?.create) {
    chrome.tabs.create({ url: safeUrl });
    return true;
  }

  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}

function updateTokenAddressButton(displayValue: string, fullAddress: string | null): void {
  const button = elements.tokenDetail.tokenAddress;
  if (!button) {
    return;
  }

  button.textContent = displayValue;
  button.dataset.fullAddress = fullAddress ?? '';
  button.disabled = !fullAddress;
  button.classList.toggle('is-empty', !fullAddress);
  button.title = fullAddress ? 'Click to copy address' : '';
}

function showCopyToast(message = 'Copied'): void {
  const toast = elements.tokenDetail.copyToast;
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.remove('hidden');

  if (copyToastTimeoutId) {
    window.clearTimeout(copyToastTimeoutId);
  }

  copyToastTimeoutId = window.setTimeout(() => {
    toast.classList.add('hidden');
    copyToastTimeoutId = null;
  }, 1200);
}

async function handleTokenAddressCopy(): Promise<void> {
  const fullAddress = elements.tokenDetail.tokenAddress?.dataset.fullAddress?.trim();
  if (!fullAddress) {
    return;
  }

  const copied = await copyTextToClipboard(fullAddress);
  showCopyToast(copied ? 'Copied' : 'Copy failed');
}

function handleUpgradeFlow(): void {
  const trustedPortalUrl = state.userProfile?.customerPortalUrl
    ? sanitizeCustomerPortalUrl(state.userProfile.customerPortalUrl)
    : null;

  if (state.userProfile?.tier === 'pro') {
    openExternal(trustedPortalUrl ?? getAccountUrl());
    return;
  }

  if (state.userProfile?.tier === 'rescue_pass' && trustedPortalUrl) {
    openExternal(trustedPortalUrl);
    return;
  }

  openExternal(getPricingUrl());
}

function showScreen(screen: ScreenName): void {
  Object.values(elements.screens).forEach((element) => element?.classList.add('hidden'));

  const targetMap: Record<ScreenName, HTMLElement | null> = {
    loading: elements.screens.loading,
    'token-detail': elements.screens.tokenDetail,
    login: elements.screens.login,
    register: elements.screens.register,
    account: elements.screens.account,
    manual: elements.screens.manual,
    'no-token': elements.screens.noToken,
  };

  const targetEl = targetMap[screen];
  targetEl?.classList.remove('hidden');
  state.currentScreen = screen;

  if (screen === 'account') {
    updateAccountScreen();
  }

  // H-9: Focus management — move focus into the newly-shown screen
  (targetEl?.querySelector('h1, [autofocus], input') as HTMLElement | null)?.focus();
}

function setManualError(message: string | null): void {
  if (!elements.manual.error) {
    return;
  }

  if (!message) {
    elements.manual.error.classList.add('hidden');
    elements.manual.error.textContent = '';
    return;
  }

  elements.manual.error.textContent = message;
  elements.manual.error.classList.remove('hidden');
}

function setRegisterError(message: string | null): void {
  if (!elements.register.error) {
    return;
  }

  if (!message) {
    elements.register.error.classList.add('hidden');
    elements.register.error.textContent = '';
    return;
  }

  elements.register.error.textContent = message;
  elements.register.error.classList.remove('hidden');
}

function setStatusMessage(element: HTMLElement | null | undefined, message: string | null): void {
  if (!element) {
    return;
  }

  if (!message) {
    element.classList.add('hidden');
    element.textContent = '';
    return;
  }

  element.textContent = message;
  element.classList.remove('hidden');
}

function getTierRank(tier: TierLevel): number {
  const rank: Record<TierLevel, number> = {
    free: 0,
    rescue_pass: 1,
    pro: 2,
  };

  return rank[tier];
}

function canAccessTier(userTier: TierLevel, requiredTier: TierLevel): boolean {
  return getTierRank(userTier) >= getTierRank(requiredTier);
}


function truncateAddress(address: string): string {
  return shortenAddress(address, 8, 6);
}

function formatTier(tier: TierLevel): string {
  switch (tier) {
    case 'free':
      return 'Free Tier';
    case 'rescue_pass':
      return 'Rescue Pass';
    case 'pro':
      return 'Pro';
  }
}

function getEffectiveViewerTier(): TierLevel {
  return state.userProfile?.tier ?? 'free';
}

function scoreHasLockedChecks(score: TokenScore): boolean {
  return Object.values(score.checks ?? {}).some(
    (check) => Boolean(check && typeof check === 'object' && check.locked === true),
  );
}

function getUsageSummary(): { limit: number; used: number; remaining: number; ratio: number } | null {
  // Prefer local hourly usage state tracked by the background service worker.
  // It is incremented after every analysis and is more current than the profile
  // data which only updates on API sync.
  const local = state.usageState;
  if (local && local.limit > 0) {
    const currentHourEpoch = String(Math.floor(Date.now() / 3600000));
    if (local.bucketKey.endsWith(`:${currentHourEpoch}`)) {
      const used = Math.max(0, Math.min(local.used, local.limit));
      const remaining = Math.max(0, local.limit - used);
      return {
        limit: local.limit,
        used,
        remaining,
        ratio: used / local.limit,
      };
    }
  }

  // Fall back to backend profile data (may be stale)
  const backendLimit = state.userProfile?.hourlyAnalysesLimit;
  const backendUsed = state.userProfile?.hourlyAnalysesUsed;
  const backendRemaining = state.userProfile?.hourlyAnalysesRemaining;
  if (
    typeof backendLimit === 'number'
    && Number.isFinite(backendLimit)
    && backendLimit > 0
    && (
      (typeof backendUsed === 'number' && Number.isFinite(backendUsed))
      || (typeof backendRemaining === 'number' && Number.isFinite(backendRemaining))
    )
  ) {
    const used = typeof backendUsed === 'number' && Number.isFinite(backendUsed)
      ? Math.max(0, Math.min(backendUsed, backendLimit))
      : Math.max(0, backendLimit - Math.max(0, backendRemaining ?? 0));
    const remaining = typeof backendRemaining === 'number' && Number.isFinite(backendRemaining)
      ? Math.max(0, Math.min(backendRemaining, backendLimit))
      : Math.max(0, backendLimit - used);

    return {
      limit: backendLimit,
      used,
      remaining,
      ratio: used / backendLimit,
    };
  }
  return null;
}

function isQuotaExhaustedForUi(): boolean {
  const summary = getUsageSummary();
  if (!summary || summary.remaining > 0) {
    return false;
  }

  const profile = state.userProfile;
  if (
    profile
    && typeof profile.hourlyAnalysesLimit === 'number'
    && Number.isFinite(profile.hourlyAnalysesLimit)
    && profile.hourlyAnalysesLimit > 0
  ) {
    const profileRemaining = profile.hourlyAnalysesRemaining;
    const profileUsed = profile.hourlyAnalysesUsed;

    if (typeof profileRemaining === 'number' && Number.isFinite(profileRemaining) && profileRemaining > 0) {
      return false;
    }

    if (
      typeof profileUsed === 'number'
      && Number.isFinite(profileUsed)
      && profileUsed < profile.hourlyAnalysesLimit
    ) {
      return false;
    }
  }

  return true;
}

function syncProfileUsageFromState(): void {
  const local = state.usageState;
  const profile = state.userProfile;
  if (!local || !profile || local.audience !== 'authenticated') {
    return;
  }

  const currentBucketKey = `authenticated:${profile.tier}:${Math.floor(Date.now() / 3600000)}`;
  if (local.bucketKey !== currentBucketKey || local.limit <= 0) {
    return;
  }

  const used = Math.max(0, Math.min(local.used, local.limit));
  profile.hourlyAnalysesUsed = used;
  profile.hourlyAnalysesLimit = local.limit;
  profile.hourlyAnalysesRemaining = Math.max(0, local.limit - used);
}

function hasExhaustedUsage(): boolean {
  return isQuotaExhaustedForUi();
}

function renderUsageIndicator(): void {
  const summary = getUsageSummary();
  const indicator = elements.brand.usageIndicator;
  const donut = elements.brand.usageDonut;
  const remaining = elements.brand.usageRemaining;
  const label = elements.brand.usageLabel;
  const meta = elements.brand.usageMeta;

  if (!indicator || !donut || !remaining || !label || !meta) {
    return;
  }

  if (!summary) {
    indicator.classList.add('hidden');
    return;
  }

  indicator.classList.remove('hidden');
  donut.style.setProperty('--usage-fill', `${Math.round(summary.ratio * 360)}deg`);
  remaining.textContent = String(summary.remaining);
  label.textContent = `${summary.remaining} left`;
  meta.textContent = `${summary.used}/${summary.limit} used this hour`;
}

function setWatchlistError(message: string | null): void {
  const errorEl = elements.tokenDetail.watchlistError;
  if (!errorEl) {
    return;
  }

  if (!message) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    return;
  }

  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function renderWatchlistAlerts(): void {
  const section = elements.tokenDetail.watchlistAlertsSection;
  const list = elements.tokenDetail.watchlistAlertsList;
  const currentAddress = state.selectedToken?.address;
  if (!section || !list || !currentAddress) {
    section?.classList.add('hidden');
    return;
  }

  const relevantAlerts = state.watchlistAlerts
    .filter((alert) => alert.token_address === currentAddress)
    .slice(0, 3);

  if (relevantAlerts.length === 0) {
    section.classList.add('hidden');
    list.textContent = '';
    return;
  }

  section.classList.remove('hidden');
  list.textContent = '';

  for (const alert of relevantAlerts) {
    const item = document.createElement('div');
    item.className = `mini-alert ${alert.read_at ? 'is-read' : 'is-unread'}`;

    const title = document.createElement('div');
    title.className = 'mini-alert-title';
    title.textContent = alert.title;

    const message = document.createElement('div');
    message.className = 'mini-alert-message';
    message.textContent = alert.message;

    const actions = document.createElement('div');
    actions.className = 'mini-alert-actions';

    const openLink = document.createElement('a');
    openLink.href = `https://barryguard.com/check/${alert.token_address}`;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Open full check';
    actions.appendChild(openLink);

    if (!alert.read_at) {
      const markReadBtn = document.createElement('button');
      markReadBtn.type = 'button';
      markReadBtn.textContent = 'Mark read';
      markReadBtn.addEventListener('click', () => {
        void handleWatchlistAlertRead(alert.id);
      });
      actions.appendChild(markReadBtn);
    }

    item.append(title, message, actions);
    list.appendChild(item);
  }
}

function renderWatchlistState(): void {
  const button = elements.tokenDetail.watchlistToggleBtn;
  const badge = elements.tokenDetail.watchlistBadge;
  if (!button || !badge) {
    return;
  }

  const setButtonState = (input: {
    disabled: boolean;
    title: string;
    active?: boolean;
    attention?: boolean;
    badgeText?: string | null;
  }) => {
    button.disabled = input.disabled;
    button.title = input.title;
    button.setAttribute('aria-label', input.title);
    button.classList.toggle('is-active', Boolean(input.active));
    button.classList.toggle('is-attention', Boolean(input.attention));

    const badgeText = input.badgeText?.trim() ?? '';
    if (badgeText) {
      badge.textContent = badgeText;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  };

  const currentAddress = state.selectedToken?.address;
  if (!currentAddress) {
    setButtonState({ disabled: true, title: 'Watchlist unavailable' });
    setWatchlistError(null);
    renderWatchlistAlerts();
    return;
  }

  if (!state.isLoggedIn || !state.userProfile) {
    setButtonState({ disabled: false, title: 'Sign in to use watchlist' });
    setWatchlistError(null);
    renderWatchlistAlerts();
    return;
  }

  if (state.watchlistStatus && !state.watchlistStatus.hasAccess) {
    setButtonState({ disabled: false, title: 'Upgrade for watchlist access' });
    setWatchlistError(null);
    renderWatchlistAlerts();
    return;
  }

  if (!state.watchlistStatus) {
    setButtonState({ disabled: true, title: 'Loading watchlist state' });
    setWatchlistError(null);
    renderWatchlistAlerts();
    return;
  }

  const unread = state.watchlistStatus.unreadAlerts;

  setButtonState({
    disabled: false,
    title: state.watchlistStatus.saved ? 'Remove from watchlist' : 'Save to watchlist',
    active: state.watchlistStatus.saved,
    attention: unread > 0,
    badgeText: unread > 0 ? `${Math.min(unread, 9)}${unread > 9 ? '+' : ''}` : null,
  });
  renderWatchlistAlerts();
}

async function refreshWatchlistForSelectedToken(): Promise<void> {
  const currentAddress = state.selectedToken?.address;
  if (!currentAddress) {
    state.watchlistStatus = null;
    state.watchlistAlerts = [];
    renderWatchlistState();
    return;
  }

  if (!state.isLoggedIn || !state.userProfile) {
    state.watchlistStatus = null;
    state.watchlistAlerts = [];
    renderWatchlistState();
    return;
  }

  state.watchlistStatus = null;
  renderWatchlistState();

  const [statusResponse, alertsResponse] = await Promise.all([
    sendMessage<WatchlistStatus>({ type: 'GET_WATCHLIST_STATUS', payload: currentAddress }, 5000),
    sendMessage<{ alerts: WatchlistAlert[]; unreadAlerts: number; hasAccess: boolean }>({ type: 'GET_WATCHLIST_ALERTS' }, 5000),
  ]);

  if (statusResponse.success && statusResponse.data) {
    state.watchlistStatus = statusResponse.data;
  } else if (statusResponse.statusCode === 401) {
    state.watchlistStatus = null;
  } else {
    state.watchlistStatus = {
      saved: false,
      hasAccess: state.userProfile.tier === 'rescue_pass' || state.userProfile.tier === 'pro',
      unreadAlerts: 0,
      entry: null,
    };
    setWatchlistError(statusResponse.error ?? null);
  }

  if (alertsResponse.success && alertsResponse.data) {
    state.watchlistAlerts = alertsResponse.data.alerts ?? [];
    if (state.watchlistStatus) {
      state.watchlistStatus.unreadAlerts = state.watchlistStatus.saved
        ? (state.watchlistAlerts.filter((alert) => alert.token_address === currentAddress && !alert.read_at).length)
        : 0;
    }
  } else {
    state.watchlistAlerts = [];
  }

  renderWatchlistState();
}

async function handleWatchlistToggle(): Promise<void> {
  const currentAddress = state.selectedToken?.address;
  if (!currentAddress) {
    return;
  }

  if (!state.isLoggedIn || !state.userProfile) {
    showScreen('login');
    return;
  }

  if (state.watchlistStatus && !state.watchlistStatus.hasAccess) {
    openExternal(getPricingUrl());
    return;
  }

  const button = elements.tokenDetail.watchlistToggleBtn;
  if (button) {
    button.disabled = true;
    button.title = 'Updating watchlist...';
    button.setAttribute('aria-label', 'Updating watchlist...');
  }
  setWatchlistError(null);

  try {
    const response = state.watchlistStatus?.saved
      ? await sendMessage<{ success: boolean }>({ type: 'REMOVE_FROM_WATCHLIST', payload: currentAddress }, 5000)
      : await sendMessage<WatchlistStatus>({ type: 'ADD_TO_WATCHLIST', payload: currentAddress }, 5000);

    if (!response.success) {
      if (response.statusCode === 401) {
        showScreen('login');
        return;
      }

      if (response.errorType === 'plan_gate' || response.statusCode === 403) {
        openExternal(getPricingUrl());
        return;
      }

      setWatchlistError(response.error ?? 'Watchlist update failed.');
      return;
    }

    await refreshWatchlistForSelectedToken();
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

async function handleWatchlistAlertRead(id: string): Promise<void> {
  const response = await sendMessage<{ success: boolean }>({ type: 'MARK_WATCHLIST_ALERT_READ', payload: id }, 5000);
  if (!response.success) {
    return;
  }

  state.watchlistAlerts = state.watchlistAlerts.map((alert) => (
    alert.id === id
      ? { ...alert, read_at: new Date().toISOString() }
      : alert
  ));
  if (state.watchlistStatus?.saved && state.selectedToken?.address) {
    state.watchlistStatus.unreadAlerts = state.watchlistAlerts.filter(
      (alert) => alert.token_address === state.selectedToken?.address && !alert.read_at,
    ).length;
  }
  renderWatchlistState();
}

function getLimitUpgradeCopy(): { title: string; body: string; buttonLabel: string } {
  switch (state.userProfile?.tier) {
    case 'rescue_pass':
      return {
        title: 'Upgrade to Pro',
        body: 'Increase your hourly quota and keep scanning more tokens without waiting.',
        buttonLabel: 'Upgrade',
      };
    case 'pro':
      return {
        title: 'Hourly quota exhausted',
        body: 'Your Pro quota resets automatically next hour. You can review your plan in Account.',
        buttonLabel: 'Manage',
      };
    case 'free':
    default:
      return {
        title: 'Upgrade to Rescue Pass',
        body: 'Get more hourly scans and unlock list scanning directly on supported platforms.',
        buttonLabel: 'Upgrade',
      };
  }
}


function setTierBadgeClass(tier: TierLevel): void {
  const badge = elements.account.tierBadge;
  if (!badge) {
    return;
  }

  badge.classList.remove('free', 'rescue-pass', 'pro');
  badge.classList.add(tier === 'rescue_pass' ? 'rescue-pass' : tier);
}

function renderEmptyState(): void {
  const rugBanner = document.getElementById('rug-warning-banner');
  if (rugBanner) rugBanner.remove();

  const branding = getPlanBranding(state.userProfile?.tier);
  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = 'BarryGuard token placeholder';
  }
  if (elements.tokenDetail.tokenName) elements.tokenDetail.tokenName.textContent = 'No Token Selected';
  if (elements.tokenDetail.tokenSymbol) elements.tokenDetail.tokenSymbol.textContent = '';
  updateTokenAddressButton('Browse a supported site or enter a token address', null);
  if (elements.tokenDetail.scoreValue) elements.tokenDetail.scoreValue.textContent = '--';
  if (elements.tokenDetail.scoreDonut) {
    elements.tokenDetail.scoreDonut.className = 'score-donut';
    if (elements.tokenDetail.scoreDonutRing) {
      elements.tokenDetail.scoreDonutRing.style.setProperty('--score-deg', '0deg');
    }
  }
  if (elements.tokenDetail.riskLabel) {
    elements.tokenDetail.riskLabel.textContent = 'ANALYZE TOKEN';
    elements.tokenDetail.riskLabel.className = 'risk-label';
  }
  // H-8: Safe DOM construction instead of innerHTML
  if (elements.tokenDetail.checksList) {
    elements.tokenDetail.checksList.textContent = '';
    const item = document.createElement('div');
    item.className = 'check-item';
    const content = document.createElement('div');
    content.className = 'check-content';
    const label = document.createElement('div');
    label.className = 'check-label check-label-center';
    label.textContent = 'Click a token badge on a supported Solana site or use manual entry';
    content.appendChild(label);
    item.appendChild(content);
    elements.tokenDetail.checksList.appendChild(item);
  }
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = '';
  }
  renderWatchlistState();
}

function renderUsageLimitState(): void {
  const rugBanner = document.getElementById('rug-warning-banner');
  if (rugBanner) rugBanner.remove();

  const branding = getPlanBranding(state.userProfile?.tier);
  const summary = getUsageSummary();
  const copy = getLimitUpgradeCopy();
  const tokenAddress = state.selectedToken?.address ?? null;
  const tokenName = state.selectedToken?.metadata?.name;
  const tokenSymbol = state.selectedToken?.metadata?.symbol;
  const shortAddress = tokenAddress
    ? shortenAddress(tokenAddress, 8, 6)
    : null;

  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = 'BarryGuard upgrade recommendation';
  }

  if (elements.tokenDetail.tokenName) elements.tokenDetail.tokenName.textContent = tokenName ?? 'Hourly Limit Reached';
  if (elements.tokenDetail.tokenSymbol) elements.tokenDetail.tokenSymbol.textContent = tokenSymbol
    ? `${tokenSymbol} — LIMIT REACHED`
    : summary ? `${summary.used}/${summary.limit} USED` : '';
  updateTokenAddressButton(
    shortAddress ?? (summary
      ? 'You have no BarryGuard analyses left in the current hourly window.'
      : 'Your BarryGuard quota is currently exhausted.'),
    tokenAddress,
  );
  if (elements.tokenDetail.scoreValue) elements.tokenDetail.scoreValue.textContent = '--';
  if (elements.tokenDetail.scoreDonut) {
    elements.tokenDetail.scoreDonut.className = 'score-donut score-moderate';
    if (elements.tokenDetail.scoreDonutRing) {
      elements.tokenDetail.scoreDonutRing.style.setProperty('--score-deg', '0deg');
    }
  }
  if (elements.tokenDetail.riskLabel) {
    elements.tokenDetail.riskLabel.textContent = 'LIMIT REACHED';
    elements.tokenDetail.riskLabel.className = 'risk-label';
  }

  // H-10: Compute minutes until next hour reset
  const msUntilReset = 3600000 - (Date.now() % 3600000);
  const minsUntilReset = Math.ceil(msUntilReset / 60000);

  // H-8: Safe DOM construction instead of innerHTML
  if (elements.tokenDetail.checksList) {
    elements.tokenDetail.checksList.textContent = '';

    // Quota exhausted row
    const item1 = document.createElement('div');
    item1.className = 'check-item';
    const icon1 = document.createElement('div');
    icon1.className = 'check-icon warning';
    icon1.textContent = '!';
    const content1 = document.createElement('div');
    content1.className = 'check-content';
    const label1 = document.createElement('div');
    label1.className = 'check-label';
    label1.textContent = 'Quota exhausted';
    const desc1 = document.createElement('div');
    desc1.className = 'check-description';
    desc1.textContent = summary
      ? `${summary.used}/${summary.limit} analyses used this hour. Resets in ~${minsUntilReset}m`
      : `Your hourly BarryGuard request budget is fully used. Resets in ~${minsUntilReset}m`;
    content1.appendChild(label1);
    content1.appendChild(desc1);
    item1.appendChild(icon1);
    item1.appendChild(content1);
    elements.tokenDetail.checksList.appendChild(item1);

    // Upgrade row
    const item2 = document.createElement('div');
    item2.className = 'check-item';
    const icon2 = document.createElement('div');
    icon2.className = 'check-icon success';
    icon2.textContent = '+';
    const content2 = document.createElement('div');
    content2.className = 'check-content';
    const label2 = document.createElement('div');
    label2.className = 'check-label';
    label2.textContent = copy.title;
    const desc2 = document.createElement('div');
    desc2.className = 'check-description';
    desc2.textContent = copy.body;
    content2.appendChild(label2);
    content2.appendChild(desc2);
    item2.appendChild(icon2);
    item2.appendChild(content2);
    elements.tokenDetail.checksList.appendChild(item2);

    // M-13: Upgrade button
    const btnWrap = document.createElement('div');
    btnWrap.style.padding = '12px 0';
    const upgradeBtn = document.createElement('button');
    upgradeBtn.id = 'limit-upgrade-btn';
    upgradeBtn.className = 'btn-primary btn-full';
    upgradeBtn.textContent = copy.buttonLabel;
    btnWrap.appendChild(upgradeBtn);
    elements.tokenDetail.checksList.appendChild(btnWrap);

    document.getElementById('limit-upgrade-btn')?.addEventListener('click', () => handleUpgradeFlow());
  }
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = tokenAddress ?? '';
  }
  renderWatchlistState();
}


function renderAnonDailyLimitState(): void {
  const rugBanner = document.getElementById('rug-warning-banner');
  if (rugBanner) rugBanner.remove();

  const branding = getPlanBranding(state.userProfile?.tier);
  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = 'BarryGuard daily limit';
  }
  if (elements.tokenDetail.tokenName) elements.tokenDetail.tokenName.textContent = 'Daily Scan Limit Reached';
  if (elements.tokenDetail.tokenSymbol) elements.tokenDetail.tokenSymbol.textContent = '';
  updateTokenAddressButton("You've reached your 10 free scans for today.", null);
  if (elements.tokenDetail.scoreValue) elements.tokenDetail.scoreValue.textContent = '--';
  if (elements.tokenDetail.scoreDonut) {
    elements.tokenDetail.scoreDonut.className = 'score-donut';
    if (elements.tokenDetail.scoreDonutRing) {
      elements.tokenDetail.scoreDonutRing.style.setProperty('--score-deg', '0deg');
    }
  }
  if (elements.tokenDetail.riskLabel) {
    elements.tokenDetail.riskLabel.textContent = 'LIMIT REACHED';
    elements.tokenDetail.riskLabel.className = 'risk-label';
  }
  // H-8: Safe DOM construction instead of innerHTML
  if (elements.tokenDetail.checksList) {
    elements.tokenDetail.checksList.textContent = '';

    const item = document.createElement('div');
    item.className = 'check-item';
    const content = document.createElement('div');
    content.className = 'check-content';
    const label = document.createElement('div');
    label.className = 'check-label';
    label.textContent = "You've reached your 10 free scans for today.";
    const desc = document.createElement('div');
    desc.className = 'check-description';
    // M-18: Updated anon daily limit copy
    desc.textContent = 'Sign up free for 30 scans/hour and full analysis history.';
    content.appendChild(label);
    content.appendChild(desc);
    item.appendChild(content);
    elements.tokenDetail.checksList.appendChild(item);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.padding = '12px 0';
    const registerBtn = document.createElement('button');
    registerBtn.id = 'anon-register-btn';
    registerBtn.className = 'btn-primary';
    registerBtn.style.flex = '1';
    registerBtn.textContent = 'Create free account';
    const loginBtn = document.createElement('button');
    loginBtn.id = 'anon-login-btn';
    loginBtn.className = 'btn-secondary';
    loginBtn.style.flex = '1';
    loginBtn.textContent = 'Log in';
    btnRow.appendChild(registerBtn);
    btnRow.appendChild(loginBtn);
    elements.tokenDetail.checksList.appendChild(btnRow);

    registerBtn.addEventListener('click', () => {
      setRegisterError(null);
      setStatusMessage(elements.register.message, null);
      showScreen('register');
    });
    loginBtn.addEventListener('click', () => {
      showScreen('login');
    });
  }
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = '';
  }
  renderWatchlistState();
}

function renderLoadingTokenState(address: string): void {
  const rugBanner = document.getElementById('rug-warning-banner');
  if (rugBanner) rugBanner.remove();

  const branding = getPlanBranding(state.userProfile?.tier);
  const short = shortenAddress(address, 8, 6);

  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.classList.add('hidden');
    const logoPlaceholder = document.getElementById('token-logo-placeholder');
    const logoLoading = document.getElementById('token-logo-loading');
    logoLoading?.classList.remove('hidden');
    logoPlaceholder?.classList.add('hidden');
  }

  if (elements.tokenDetail.tokenName) elements.tokenDetail.tokenName.textContent = 'Analyzing…';
  if (elements.tokenDetail.tokenSymbol) elements.tokenDetail.tokenSymbol.textContent = '';
  updateTokenAddressButton(short, address);
  if (elements.tokenDetail.scoreValue) elements.tokenDetail.scoreValue.textContent = '…';
  if (elements.tokenDetail.scoreDonut) {
    elements.tokenDetail.scoreDonut.className = 'score-donut';
    if (elements.tokenDetail.scoreDonutRing) {
      elements.tokenDetail.scoreDonutRing.style.setProperty('--score-deg', '0deg');
    }
  }
  if (elements.tokenDetail.riskLabel) {
    elements.tokenDetail.riskLabel.textContent = 'LOADING';
    elements.tokenDetail.riskLabel.className = 'risk-label';
  }
  // H-8: Safe DOM construction instead of innerHTML
  if (elements.tokenDetail.checksList) {
    elements.tokenDetail.checksList.textContent = '';
    const item = document.createElement('div');
    item.className = 'check-item';
    const content = document.createElement('div');
    content.className = 'check-content';
    const label = document.createElement('div');
    label.className = 'check-label check-label-center';
    label.textContent = 'Fetching on-chain data…';
    content.appendChild(label);
    item.appendChild(content);
    elements.tokenDetail.checksList.appendChild(item);
  }
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = address;
  }
  renderWatchlistState();
}

function renderPrimaryTokenState(): void {
  renderUsageIndicator();

  if (state.selectedToken?.score) {
    renderTokenDetail(state.selectedToken.score);
    return;
  }

  // Token address present but no score — user navigated to a token while rate limited.
  if (state.selectedToken?.address && hasExhaustedUsage()) {
    showScreen('token-detail');
    renderUsageLimitState();
    return;
  }

  if (hasExhaustedUsage()) {
    renderUsageLimitState();
    return;
  }

  // Token address present but score not yet loaded — show loading state
  if (state.selectedToken?.address) {
    showScreen('token-detail');
    renderLoadingTokenState(state.selectedToken.address);
    return;
  }

  renderEmptyState();
}


function renderTokenDetail(score: TokenScore): void {
  const risk = getRiskLevel(score.score);
  const userTier = getEffectiveViewerTier();
  const branding = getPlanBranding(userTier);

  // Show refresh button only for paid tiers (rescue_pass, pro)
  const refreshBtn = elements.tokenDetail.refreshBtn as HTMLElement | null;
  if (refreshBtn) {
    const tier = getEffectiveViewerTier();
    refreshBtn.style.display = (tier === 'rescue_pass' || tier === 'pro') ? '' : 'none';
  }

  // v2 API provides tokenName, tokenSymbol, tokenLogoUrl directly; fall back to platform metadata
  // The backend returns "Token XXXX...XXXX" as a fallback name — prefer platform metadata over that
  const meta = state.selectedToken?.metadata;
  const isFallbackName = score.tokenName?.startsWith('Token ') && score.tokenName?.includes('...');
  const isFallbackSymbol = score.tokenSymbol && /^[A-Z0-9]{4}$/.test(score.tokenSymbol) && score.address?.toUpperCase().startsWith(score.tokenSymbol);
  const tokenName = (!isFallbackName && score.tokenName) || meta?.name || score.tokenName || 'Unknown Token';
  const tokenSymbol = (!isFallbackSymbol && score.tokenSymbol) || meta?.symbol || score.tokenSymbol || '';
  const tokenLogo = score.tokenLogoUrl || meta?.imageUrl;

  if (elements.tokenDetail.tokenLogo) {
    const logoPlaceholder = document.getElementById('token-logo-placeholder');
    const logoLoading = document.getElementById('token-logo-loading');
    const initial = tokenName.charAt(0).toUpperCase() || '?';

    // If logo is already visible with a loaded image, don't touch it on re-renders without logo data
    const alreadyLoaded = !elements.tokenDetail.tokenLogo.classList.contains('hidden')
      && elements.tokenDetail.tokenLogo.naturalWidth > 0;
    if (!tokenLogo && alreadyLoaded) {
      // Keep current logo, just update alt
      elements.tokenDetail.tokenLogo.alt = tokenName;
    } else if (tokenLogo) {
      // Only reload if src actually changed
      if (elements.tokenDetail.tokenLogo.src !== tokenLogo) {
        elements.tokenDetail.tokenLogo.classList.add('hidden');
        logoPlaceholder?.classList.add('hidden');
        logoLoading?.classList.remove('hidden');

        elements.tokenDetail.tokenLogo.onload = () => {
          elements.tokenDetail.tokenLogo!.classList.remove('hidden');
          logoLoading?.classList.add('hidden');
          logoPlaceholder?.classList.add('hidden');
        };
        elements.tokenDetail.tokenLogo.onerror = () => {
          if (!elements.tokenDetail.tokenLogo) return;
          elements.tokenDetail.tokenLogo.onerror = null;
          elements.tokenDetail.tokenLogo.classList.add('hidden');
          logoLoading?.classList.add('hidden');
          if (logoPlaceholder) {
            logoPlaceholder.textContent = initial;
            logoPlaceholder.classList.remove('hidden');
          }
        };
        elements.tokenDetail.tokenLogo.src = tokenLogo;
      }
      elements.tokenDetail.tokenLogo.alt = tokenName;
    } else {
      // No logo URL and nothing loaded — show placeholder
      elements.tokenDetail.tokenLogo.classList.add('hidden');
      logoLoading?.classList.add('hidden');
      if (logoPlaceholder) {
        logoPlaceholder.textContent = initial;
        logoPlaceholder.classList.remove('hidden');
      }
    }
  }

  if (elements.tokenDetail.tokenName) elements.tokenDetail.tokenName.textContent = tokenName;
  if (elements.tokenDetail.tokenSymbol) elements.tokenDetail.tokenSymbol.textContent = tokenSymbol;
  updateTokenAddressButton(shortenAddress(score.address, 8, 6), score.address);
  if (elements.tokenDetail.scoreValue) elements.tokenDetail.scoreValue.textContent = String(score.score);
  if (elements.tokenDetail.scoreDonut) {
    const colorMap: Record<string, string> = {
      danger: '#c5392f', high: '#d4722a', caution: '#b88946', moderate: '#5a9a6b', low: '#2d7a4f',
    };
    const c = colorMap[risk] ?? '#c5392f';
    const deg = Math.round((score.score / 100) * 360);
    elements.tokenDetail.scoreDonut.className = `score-donut score-${risk}`;
    elements.tokenDetail.scoreDonut.style.setProperty('--score-color', c);
    elements.tokenDetail.scoreDonut.style.setProperty('--score-deg', `${deg}deg`);

    // Risk label inside donut
    const donutRiskLabel = document.getElementById('score-donut-risk-label');
    if (donutRiskLabel) {
      const RISK_SHORT: Record<string, string> = {
        danger: 'DANGER', high: 'HIGH', caution: 'CAUTION', moderate: 'MODERATE', low: 'LOW',
      };
      donutRiskLabel.textContent = RISK_SHORT[risk] ?? '';
    }
  }
  if (elements.tokenDetail.riskLabel) {
    const RISK_LABELS: Record<string, string> = {
      danger: 'DANGER',
      high: 'HIGH RISK',
      caution: 'CAUTION',
      moderate: 'MODERATE',
      low: 'LOW RISK',
      // Backward compatibility
      critical: 'CRITICAL RISK',
      safe: 'VERY LOW RISK',
    };
    elements.tokenDetail.riskLabel.textContent = RISK_LABELS[risk] ?? `${risk.toUpperCase()} RISK`;
    elements.tokenDetail.riskLabel.className = `risk-label risk-${risk}`;
  }

  // Rug warning banner
  const existingBanner = document.getElementById('rug-warning-banner');
  if (existingBanner) existingBanner.remove();

  if (risk === 'danger') {
    const banner = document.createElement('div');
    banner.id = 'rug-warning-banner';
    banner.className = 'rug-warning-banner';

    const icon = document.createElement('span');
    icon.textContent = '\u26A0';
    icon.className = 'rug-warning-icon';

    const text = document.createElement('span');
    const reasons = score.reasons ?? [];
    const rugIndicators = reasons.some(r => /rug|dump|crash|scam/i.test(r));
    text.textContent = rugIndicators
      ? 'LIKELY RUGGED \u2014 Exercise extreme caution'
      : 'DANGER \u2014 Multiple critical risk factors detected';

    banner.append(icon, text);

    // Insert after score-container
    const scoreContainer = document.getElementById('score-container');
    scoreContainer?.parentNode?.insertBefore(banner, scoreContainer.nextSibling);
  }

  renderUsageIndicator();

  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = score.address;
  }

  // Solscan link — dynamically set href based on current token address
  const solscanLink = document.getElementById('solscan-link') as HTMLAnchorElement | null;
  if (solscanLink && score.address) {
    solscanLink.href = `https://solscan.io/token/${score.address}`;
    solscanLink.style.display = '';
  } else if (solscanLink) {
    solscanLink.style.display = 'none';
  }

  // Full analysis link — dynamically set href
  const fullAnalysisLink = document.getElementById('view-full-analysis') as HTMLAnchorElement | null;
  if (fullAnalysisLink && score.address) {
    fullAnalysisLink.href = `https://barryguard.com/check/${score.address}`;
  }

  // V2 rendering
  renderSubscores(score);
  if (elements.tokenDetail.reasonsContainer && elements.tokenDetail.reasonsList) {
    renderReasons(score, elements.tokenDetail.reasonsContainer, elements.tokenDetail.reasonsList);
  }
  renderAnalysisFooter(score, elements.tokenDetail.analyzedAt, elements.tokenDetail.confidenceBadge);
  if (elements.tokenDetail.checksList) {
    renderChecks(score, elements.tokenDetail.checksList, getEffectiveViewerTier());
  }
  renderWatchlistState();
}

function updateAccountScreen(): void {
  const user = state.userProfile;
  if (!user) {
    if (elements.account.email) elements.account.email.textContent = 'Guest';
    if (elements.account.tierName) elements.account.tierName.textContent = 'Free Tier';
    elements.account.subscriptionInfo?.classList.add('hidden');
    setTierBadgeClass('free');
    applyPlanBranding();
    renderUsageIndicator();
    return;
  }

  if (elements.account.email) elements.account.email.textContent = user.email;
  if (elements.account.tierName) elements.account.tierName.textContent = formatTier(user.tier);
  setTierBadgeClass(user.tier);
  applyPlanBranding();
  renderUsageIndicator();

  if (user.tier === 'free') {
    elements.account.subscriptionInfo?.classList.add('hidden');
    return;
  }

  elements.account.subscriptionInfo?.classList.remove('hidden');
  if (elements.account.periodEnd) elements.account.periodEnd.textContent = user.currentPeriodEnd
    ? new Date(user.currentPeriodEnd).toLocaleDateString()
    : '--';
}

function handleSelectedTokenUpdate(selectedToken: SelectedToken | null): void {
  if (scoreRefreshAddress !== selectedToken?.address) {
    clearScheduledScoreRefresh();
    scoreRefreshAddress = selectedToken?.address ?? null;
    scoreRefreshAttempts = 0;
  }

  // Preserve existing score/metadata if the incoming update has less info.
  // Content scripts frequently persist { address } on detail pages while a score
  // is still loading or being reconciled; that must not wipe the popup state.
  if (selectedToken && state.selectedToken?.address === selectedToken.address) {
    selectedToken = {
      ...state.selectedToken,
      ...selectedToken,
      ...(state.selectedToken.metadata || selectedToken.metadata
        ? {
            metadata: {
              ...(state.selectedToken.metadata ?? {}),
              ...(selectedToken.metadata ?? {}),
            },
          }
        : {}),
      score: selectedToken.score ?? state.selectedToken.score,
    };
  }

  state.selectedToken = selectedToken;

  if (!selectedToken && state.initialized) {
    showScreen('no-token');
    return;
  }

  if (selectedToken && state.currentScreen === 'no-token') {
    showScreen('token-detail');
  }

  renderPrimaryTokenState();
  void refreshWatchlistForSelectedToken();

  if (selectedToken?.score) {
    void hydrateSelectedTokenMetadata(selectedToken);
    scheduleSelectedTokenScoreRefresh();
  } else if (selectedToken?.address) {
    // No score yet — popup fetches it directly instead of waiting for content script
    void refreshSelectedTokenScore();
  }
}

function clearScheduledScoreRefresh(): void {
  if (scoreRefreshTimeoutId) {
    window.clearTimeout(scoreRefreshTimeoutId);
    scoreRefreshTimeoutId = null;
  }
}

function shouldKeepRefreshingScore(score: TokenScore): boolean {
  const viewerTier = getEffectiveViewerTier();
  const staleLockedScoreForPaidViewer = viewerTier !== 'free' && scoreHasLockedChecks(score);
  return score.cached === false || isTokenScoreLikelyIncomplete(score) || staleLockedScoreForPaidViewer;
}

function shouldRetryScoreRefresh(response: ApiResponse<TokenScore>): boolean {
  if (response.success) {
    return false;
  }

  if (response.errorType === 'plan_gate') {
    return false;
  }

  if (response.statusCode === 403) {
    return false;
  }

  if (response.errorType === 'busy' || response.errorType === 'network') {
    return true;
  }

  return response.statusCode === 404
    || response.statusCode === 408
    || response.statusCode === 425
    || response.statusCode === 500
    || response.statusCode === 502
    || response.statusCode === 503
    || response.statusCode === 504;
}

function scheduleSelectedTokenScoreRefresh(): void {
  const selectedToken = state.selectedToken;
  if (!selectedToken?.score || !shouldKeepRefreshingScore(selectedToken.score)) {
    clearScheduledScoreRefresh();
    return;
  }

  if (scoreRefreshTimeoutId || scoreRefreshAttempts >= MAX_SCORE_REFRESH_ATTEMPTS) {
    return;
  }

  scoreRefreshAttempts += 1;
  const delayMs = SCORE_REFRESH_BASE_DELAY_MS * scoreRefreshAttempts;
  scoreRefreshTimeoutId = window.setTimeout(() => {
    scoreRefreshTimeoutId = null;
    void refreshSelectedTokenScore();
  }, delayMs);
}

async function hydrateSelectedTokenMetadata(selectedToken: SelectedToken): Promise<void> {
  if (selectedToken.metadata?.name && selectedToken.metadata?.symbol && selectedToken.metadata?.imageUrl) {
    return;
  }

  if (isHydratingSelectedTokenMetadata) {
    return;
  }

  isHydratingSelectedTokenMetadata = true;

  try {
    const response = await sendMessage<TokenMetadata>({
      type: 'GET_TOKEN_METADATA',
      payload: selectedToken.address,
    }, 5000);

    if (!response.success || !response.data) {
      return;
    }

    const mergedToken: SelectedToken = {
      ...selectedToken,
      metadata: {
        ...(selectedToken.metadata ?? {}),
        ...response.data,
      },
    };

    const before = JSON.stringify(selectedToken.metadata ?? {});
    const after = JSON.stringify(mergedToken.metadata ?? {});
    if (before === after) {
      return;
    }

    state.selectedToken = mergedToken;
    if (mergedToken.score) {
      renderTokenDetail(mergedToken.score);
    }
    await chrome.storage.local.set({ selectedToken: mergedToken });
  } finally {
    isHydratingSelectedTokenMetadata = false;
  }
}

function showCurrentOrEmptyToken(): void {
  renderPrimaryTokenState();
}

function getRuntimeErrorMessage(): string | null {
  if (!chrome.runtime?.lastError) {
    return null;
  }

  return chrome.runtime.lastError.message || 'Runtime error';
}

function sendMessage<T>(message: RuntimeMessage, timeoutMs = 2500): Promise<ApiResponse<T>> {
  // H-11: Offline detection
  if (!navigator.onLine) {
    return Promise.resolve({
      success: false,
      error: 'You appear to be offline. Check your connection and try again.',
      errorType: 'network',
    } as ApiResponse<T>);
  }

  return new Promise((resolve) => {
    let finished = false;
    const timeoutId = window.setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      resolve({ success: false, error: 'BarryGuard background did not respond in time.' });
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response: ApiResponse<T> | undefined) => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timeoutId);

        const runtimeError = getRuntimeErrorMessage();
        if (runtimeError) {
          resolve({ success: false, error: runtimeError });
          return;
        }

        resolve(response ?? { success: false, error: 'No response from BarryGuard background.' });
      });
    } catch (error) {
      if (finished) {
        return;
      }

      finished = true;
      window.clearTimeout(timeoutId);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected popup messaging error.',
      });
    }
  });
}

async function loadUserProfile(): Promise<boolean> {
  const response = await sendMessage<UserProfile>({ type: 'GET_USER_TIER' });
  if (!response.success || !response.data) {
  state.isLoggedIn = false;
  state.userProfile = null;
  applyPlanBranding();
  renderUsageIndicator();
  state.watchlistStatus = null;
  state.watchlistAlerts = [];
  renderWatchlistState();
  return false;
  }

  state.isLoggedIn = true;
  state.userProfile = response.data;
  applyPlanBranding();
  renderUsageIndicator();
  await refreshWatchlistForSelectedToken();
  return true;
}

async function handleAccountOpen(): Promise<void> {
  if (!state.isLoggedIn) {
    showScreen('login');
    return;
  }

  await loadUserProfile();
  await sendMessage({ type: 'REFRESH_USAGE' }, 3000).catch(() => {});
  await loadUsageState();
  updateAccountScreen();
  showScreen(state.isLoggedIn ? 'account' : 'login');
}

async function loadUsageState(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get('hourly_usage_state');
    state.usageState = (stored.hourly_usage_state as HourlyUsageState | undefined) ?? null;
  } catch {
    state.usageState = null;
  }

  syncProfileUsageFromState();
  renderUsageIndicator();
  if (state.selectedToken?.address) {
    renderPrimaryTokenState();
  }
}

async function loadSelectedToken(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get('selectedToken');
    const selectedToken = stored.selectedToken as SelectedToken | undefined;
    handleSelectedTokenUpdate(selectedToken ?? null);
  } catch {
    handleSelectedTokenUpdate(null);
  }
}

async function refreshSelectedTokenScore(): Promise<void> {
  const selectedToken = state.selectedToken;
  if (!selectedToken?.address) {
    return;
  }

  const currentScore = selectedToken.score;

  // If score is missing, fetch it (content script may not have persisted it yet)
  const needsInitialFetch = !currentScore;

  // If score exists, only refresh if it's still worth refreshing
  if (currentScore && !shouldKeepRefreshingScore(currentScore)) {
    return;
  }

  const response = await sendMessage<TokenScore>({
    type: 'GET_TOKEN_SCORE',
    payload: selectedToken.address,
  }, 5000);

  if (!response.success || !response.data) {
    if (needsInitialFetch || shouldRetryScoreRefresh(response)) {
      scheduleSelectedTokenScoreRefresh();
    }
    return;
  }

  if (state.selectedToken?.address !== selectedToken.address) {
    return;
  }

  const nextToken: SelectedToken = {
    ...selectedToken,
    score: response.data,
  };

  state.selectedToken = nextToken;
  renderTokenDetail(response.data);
  await chrome.storage.local.set({ selectedToken: nextToken });
  await refreshWatchlistForSelectedToken();
  scheduleSelectedTokenScoreRefresh();
}


async function handleLogin(): Promise<void> {
  const email = elements.login.email?.value.trim() ?? '';
  const password = elements.login.password?.value ?? '';
  setStatusMessage(elements.login.message, null);

  if (!email || !password) {
    setStatusMessage(elements.login.message, 'Please enter email and password.');
    return;
  }

  if (!elements.login.loginBtn) {
    return;
  }

  elements.login.loginBtn.disabled = true;
  elements.login.loginBtn.textContent = 'Logging in...';

  try {
    const response = await sendMessage<UserProfile>({
      type: 'LOGIN',
      payload: { email, password },
    });

    if (!response.success || !response.data) {
      setStatusMessage(elements.login.message, response.error ?? 'Login failed.');
      return;
    }

    state.isLoggedIn = true;
    state.userProfile = response.data;
    applyPlanBranding();
    renderUsageIndicator();
    await refreshSelectedTokenScore();
    await refreshWatchlistForSelectedToken();
    showCurrentOrEmptyToken();
    showScreen('token-detail');
  } finally {
    elements.login.loginBtn.disabled = false;
    elements.login.loginBtn.textContent = 'Login';
  }
}

async function handleMagicLink(source: 'login' | 'register'): Promise<void> {
  const email = source === 'login'
    ? elements.login.email?.value.trim() ?? ''
    : elements.register.email?.value.trim() ?? '';
  const button = source === 'login' ? elements.login.magicLinkBtn : elements.register.magicLinkBtn;
  const messageElement = source === 'login' ? elements.login.message : elements.register.message;

  setStatusMessage(messageElement, null);
  if (source === 'register') {
    setRegisterError(null);
  }

  if (!email) {
    setStatusMessage(messageElement, 'Enter your email first.');
    return;
  }

  if (!button) {
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const response = await sendMessage<{ message?: string }>({
      type: 'SEND_MAGIC_LINK',
      payload: { email },
    });

    if (!response.success) {
      setStatusMessage(messageElement, response.error ?? 'Magic link could not be sent.');
      return;
    }

    setStatusMessage(messageElement, response.data?.message ?? 'Magic link sent. Check your email.');
  } finally {
    button.disabled = false;
    button.textContent = 'Send Magic Link';
  }
}

async function handleRegister(): Promise<void> {
  const email = elements.register.email?.value.trim() ?? '';
  const password = elements.register.password?.value ?? '';
  const passwordConfirm = elements.register.passwordConfirm?.value ?? '';

  setRegisterError(null);

  if (!email || !password) {
    setRegisterError('Please enter email and password.');
    return;
  }

  if (password.length < 8) {
    setRegisterError('Password must be at least 8 characters.');
    return;
  }
  if (!/[A-Z]/.test(password)) {
    setRegisterError('Password must contain at least one uppercase letter.');
    return;
  }
  if (!/[a-z]/.test(password)) {
    setRegisterError('Password must contain at least one lowercase letter.');
    return;
  }
  if (!/[0-9]/.test(password)) {
    setRegisterError('Password must contain at least one digit.');
    return;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    setRegisterError('Password must contain at least one special character.');
    return;
  }

  if (password !== passwordConfirm) {
    setRegisterError('Passwords do not match.');
    return;
  }

  if (!elements.register.registerBtn) {
    return;
  }

  elements.register.registerBtn.disabled = true;
  elements.register.registerBtn.textContent = 'Creating account...';

  try {
    const response = await sendMessage<UserProfile>({
      type: 'REGISTER',
      payload: { email, password },
    });

    if (!response.success || !response.data) {
      setRegisterError(response.error ?? 'Registration failed.');
      return;
    }

    state.isLoggedIn = true;
    state.userProfile = response.data;
    applyPlanBranding();
    renderUsageIndicator();
    await refreshSelectedTokenScore();
    await refreshWatchlistForSelectedToken();
    showCurrentOrEmptyToken();
    showScreen('token-detail');
  } finally {
    const termsChecked = elements.register.termsCheckbox?.checked ?? false;
    elements.register.registerBtn.disabled = !termsChecked;
    elements.register.registerBtn.textContent = 'Create Account';
  }
}

async function handleLogout(): Promise<void> {
  await sendMessage<void>({ type: 'LOGOUT' });
  state.isLoggedIn = false;
  state.userProfile = null;
  state.usageState = null;
  state.watchlistStatus = null;
  state.watchlistAlerts = [];
  applyPlanBranding();
  renderUsageIndicator();
  showCurrentOrEmptyToken();
  showScreen('token-detail');
}

async function handleAnalyze(): Promise<void> {
  const address = elements.manual.addressInput?.value.trim() ?? '';
  if (!address) {
    setManualError('Please enter a token address.');
    return;
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    setManualError('Invalid Solana address format.');
    return;
  }

  setManualError(null);

  if (!elements.manual.analyzeBtn) {
    return;
  }

  elements.manual.analyzeBtn.disabled = true;
  elements.manual.analyzeBtn.textContent = 'Analyzing...';

  try {
    const response = await sendMessage<TokenScore>({
      type: 'ANALYZE_TOKEN',
      payload: address,
    }, 5000);

    if (!response.success || !response.data) {
      if (response.errorType === 'anon_daily_limit') {
        setManualError(null);
        renderAnonDailyLimitState();
        showScreen('token-detail');
        return;
      }

      if (response.errorType === 'cooldown') {
        setManualError(response.error ?? 'Please wait a few seconds before analyzing another token.');
        return;
      }

      if (response.errorType === 'rate_limit') {
        setManualError(null);
        await sendMessage({ type: 'REFRESH_USAGE' }, 3000).catch(() => {});
        await loadUsageState();
        if (!isQuotaExhaustedForUi()) {
          renderPrimaryTokenState();
          showScreen('token-detail');
          return;
        }
        state.selectedToken = {
          address,
          score: undefined,
          metadata: state.selectedToken?.address === address ? state.selectedToken.metadata : undefined,
        };
        renderUsageLimitState();
        showScreen('token-detail');
        return;
      }

      setManualError(response.error ?? 'Analysis failed.');
      return;
    }

    const metadataResponse = await sendMessage<TokenMetadata>({
      type: 'GET_TOKEN_METADATA',
      payload: address,
    }, 5000);
    const metadata = {
      ...response.data.token,
      ...(metadataResponse.success ? metadataResponse.data : {}),
    };

    state.selectedToken = {
      address,
      score: response.data,
      metadata,
    };
    await chrome.storage.local.set({ selectedToken: state.selectedToken });
    renderTokenDetail(response.data);
    await refreshWatchlistForSelectedToken();
    showScreen('token-detail');
  } finally {
    elements.manual.analyzeBtn.disabled = false;
    elements.manual.analyzeBtn.textContent = 'Analyze Token';
  }
}

async function handleRefreshToken(): Promise<void> {
  const selectedToken = state.selectedToken;
  if (!selectedToken?.address) return;

  // M-12: Store original risk label text before overwriting
  const originalText = elements.tokenDetail.riskLabel?.textContent ?? '';

  const tier = getEffectiveViewerTier();
  if (tier === 'free') {
    if (elements.tokenDetail?.riskLabel) {
      elements.tokenDetail.riskLabel.textContent = 'Upgrade to Rescue Pass to refresh on demand.';
      setTimeout(() => { if (elements.tokenDetail?.riskLabel) elements.tokenDetail.riskLabel.textContent = originalText; }, 3000);
    }
    return;
  }

  const btn = elements.tokenDetail.refreshBtn as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-refreshing');
  }

  try {
    const response = await sendMessage<TokenScore>({
      type: 'REFRESH_TOKEN_SCORE',
      payload: { address: selectedToken.address, chain: 'solana' },
    }, 10000);

    if (response.success && response.data) {
      const nextToken: SelectedToken = { ...selectedToken, score: response.data };
      state.selectedToken = nextToken;
      renderTokenDetail(response.data);
      await chrome.storage.local.set({ selectedToken: nextToken });
      await refreshWatchlistForSelectedToken();
    } else if (response.errorType === 'plan_gate') {
      if (elements.tokenDetail?.riskLabel) {
        elements.tokenDetail.riskLabel.textContent = 'Refresh requires Rescue Pass or Pro.';
        setTimeout(() => { if (elements.tokenDetail?.riskLabel) elements.tokenDetail.riskLabel.textContent = originalText; }, 3000);
      }
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-refreshing');
    }
  }
}

async function handleOAuth(): Promise<void> {
  const response = await sendMessage<{ url: string }>({
    type: 'OAUTH_LOGIN',
    payload: 'google',
  });

  const trustedOAuthUrl = response.success && response.data?.url
    ? normalizeOAuthNavigationUrl(response.data.url, 'google')
    : null;
  if (trustedOAuthUrl) {
    openExternal(trustedOAuthUrl);
    window.close();
    return;
  }

  const loginUrl = getLoginUrl();
  const fallbackUrl = sanitizeAppNavigationUrl(loginUrl);
  if (fallbackUrl) {
    openExternal(fallbackUrl);
    window.close();
    return;
  }

  setStatusMessage(elements.login.message, response.error ?? 'Google login is currently unavailable.');
}

function setupEventListeners(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    if (changes.selectedToken) {
      const selectedToken = changes.selectedToken.newValue as SelectedToken | undefined;
      handleSelectedTokenUpdate(selectedToken ?? null);
    }

    if (changes.activePageToken) {
      const active = changes.activePageToken.newValue as { address?: string; score?: TokenScore; updatedAt?: number } | undefined;
      if (active?.address && active?.score) {
        handleSelectedTokenUpdate({ address: active.address, score: active.score });
      }
    }

    if (changes.user_profile) {
      const previousTier = state.userProfile?.tier ?? null;
      state.userProfile = (changes.user_profile.newValue as UserProfile | undefined) ?? null;
      state.isLoggedIn = Boolean(state.userProfile);
      applyPlanBranding();
      renderUsageIndicator();
      if (state.currentScreen === 'account') {
        updateAccountScreen();
      }
      renderPrimaryTokenState();
      void refreshWatchlistForSelectedToken();
      if (previousTier !== (state.userProfile?.tier ?? null)) {
        void refreshSelectedTokenScore();
      }
    }

    if (changes.hourly_usage_state) {
      state.usageState = (changes.hourly_usage_state.newValue as HourlyUsageState | undefined) ?? null;
      syncProfileUsageFromState();
      renderUsageIndicator();
      if (state.currentScreen === 'account') {
        updateAccountScreen();
      }
      if (state.selectedToken?.address || state.currentScreen === 'token-detail') {
        renderPrimaryTokenState();
      }
    }
  });

  elements.tokenDetail.manualEntryBtn?.addEventListener('click', () => {
    setManualError(null);
    showScreen('manual');
  });

  elements.tokenDetail.accountBtn?.addEventListener('click', () => {
    void handleAccountOpen();
  });

  document.getElementById('header-account-btn')?.addEventListener('click', () => {
    void handleAccountOpen();
  });

  elements.tokenDetail.refreshBtn?.addEventListener('click', () => {
    void handleRefreshToken();
  });
  elements.tokenDetail.watchlistToggleBtn?.addEventListener('click', () => {
    void handleWatchlistToggle();
  });

  elements.tokenDetail.viewFullAnalysis?.addEventListener('click', (event) => {
    event.preventDefault();
    const address = state.selectedToken?.address;
    if (address) {
      openExternal(`https://barryguard.com/check/${address}`);
    }
  });

  elements.tokenDetail.tokenAddress?.addEventListener('click', () => {
    void handleTokenAddressCopy();
  });

  elements.tokenDetail.viewExplorer?.addEventListener('click', (event) => {
    event.preventDefault();
    const address = (event.currentTarget as HTMLAnchorElement).dataset.address;
    if (address) {
      const explorerUrl = sanitizeExplorerUrl(`https://solscan.io/token/${address}`);
      if (explorerUrl) {
        openExternal(explorerUrl);
      }
    }
  });

  elements.login.backBtn?.addEventListener('click', () => showScreen('token-detail'));
  elements.login.loginBtn?.addEventListener('click', () => {
    void handleLogin();
  });
  // M-16: Enter-to-submit on login
  elements.login.password?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void handleLogin(); }
  });
  elements.login.magicLinkBtn?.addEventListener('click', () => {
    void handleMagicLink('login');
  });
  elements.login.googleBtn?.addEventListener('click', () => {
    void handleOAuth();
  });
  elements.login.forgotPassword?.addEventListener('click', (event) => {
    event.preventDefault();
    openExternal(getForgotPasswordUrl());
  });
  elements.login.registerLink?.addEventListener('click', (event) => {
    event.preventDefault();
    setRegisterError(null);
    setStatusMessage(elements.register.message, null);
    showScreen('register');
  });

  elements.register.backBtn?.addEventListener('click', () => showScreen('login'));
  elements.register.toLoginLink?.addEventListener('click', (event) => {
    event.preventDefault();
    showScreen('login');
  });
  elements.register.termsCheckbox?.addEventListener('change', () => {
    const checked = elements.register.termsCheckbox?.checked ?? false;
    if (elements.register.registerBtn) elements.register.registerBtn.disabled = !checked;
    if (elements.register.magicLinkBtn) elements.register.magicLinkBtn.disabled = !checked;
    if (elements.register.googleBtn instanceof HTMLButtonElement) elements.register.googleBtn.disabled = !checked;
    const hint = document.getElementById('register-terms-hint');
    if (hint) hint.style.display = checked ? 'none' : '';
  });
  elements.register.registerBtn?.addEventListener('click', () => {
    void handleRegister();
  });
  // M-16: Enter-to-submit on register
  elements.register.passwordConfirm?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void handleRegister(); }
  });
  elements.register.magicLinkBtn?.addEventListener('click', () => {
    void handleMagicLink('register');
  });
  elements.register.googleBtn?.addEventListener('click', () => {
    void handleOAuth();
  });

  elements.account.backBtn?.addEventListener('click', () => {
    showCurrentOrEmptyToken();
    showScreen('token-detail');
  });
  elements.account.manageBtn?.addEventListener('click', () => {
    const trustedPortalUrl = state.userProfile?.customerPortalUrl
      ? sanitizeCustomerPortalUrl(state.userProfile.customerPortalUrl)
      : null;
    if (trustedPortalUrl) {
      openExternal(trustedPortalUrl);
      return;
    }

    openExternal(state.userProfile?.tier === 'free'
      ? getPricingUrl()
      : getAccountUrl());
  });
  elements.account.logoutBtn?.addEventListener('click', () => {
    void handleLogout();
  });

  elements.manual.backBtn?.addEventListener('click', () => showScreen(state.selectedToken ? 'token-detail' : 'no-token'));
  elements.manual.analyzeBtn?.addEventListener('click', () => {
    void handleAnalyze();
  });
  elements.manual.addressInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleAnalyze();
    }
  });

  elements.noToken.manualBtn?.addEventListener('click', () => {
    setManualError(null);
    showScreen('manual');
  });
  // L-11: Account access from no-token screen
  document.getElementById('no-token-account-btn')?.addEventListener('click', () => {
    void handleAccountOpen();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.close();
    }
  });
}

async function init(): Promise<void> {
  if (state.initialized) {
    return;
  }

  state.initialized = true;
  setupEventListeners();

  try {
    await loadUserProfile();
    // Ask background worker to correct stale usage before reading it
    await sendMessage({ type: 'REFRESH_USAGE' }, 3000).catch(() => {});
    await loadUsageState();
    await loadSelectedToken();
    await refreshSelectedTokenScore();
  } catch (error) {
    console.error('[BarryGuard] Popup initialization failed:', error);
    renderPrimaryTokenState();
  } finally {
    applyPlanBranding();
    renderUsageIndicator();
    if (!state.isLoggedIn && !state.selectedToken) {
      showScreen('login');
    } else if (!state.selectedToken) {
      showScreen('no-token');
    } else {
      showScreen('token-detail');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  }, { once: true });
} else {
  void init();
}
