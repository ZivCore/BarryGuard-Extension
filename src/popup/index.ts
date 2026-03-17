import type {
  ApiResponse,
  HourlyUsageState,
  SelectedToken,
  TierLevel,
  TokenMetadata,
  TokenScore,
  UserProfile,
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
import { isTokenScoreLikelyIncomplete } from '../shared/token-score';
import {
  getRiskLevel,
  renderChecks,
  renderReasons,
  renderSubscores,
  renderAnalysisFooter,
} from './render';

type ScreenName = 'loading' | 'token-detail' | 'login' | 'register' | 'account' | 'manual';

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
    scoreCircle: document.getElementById('score-circle'),
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
  };

  targetMap[screen]?.classList.remove('hidden');
  state.currentScreen = screen;

  if (screen === 'account') {
    updateAccountScreen();
  }
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
  if (address.length <= 16) {
    return address;
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
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

function getCurrentUsageBucketKey(tier: TierLevel, audience: 'anonymous' | 'authenticated'): string {
  return `${audience}:${tier}:${Math.floor(Date.now() / 3600000)}`;
}

function getUsageSummary(): { limit: number; used: number; remaining: number; ratio: number } | null {
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

function hasExhaustedUsage(): boolean {
  const summary = getUsageSummary();
  return Boolean(summary && summary.remaining <= 0);
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
  const branding = getPlanBranding(state.userProfile?.tier);
  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = 'BarryGuard token placeholder';
  }
  elements.tokenDetail.tokenName!.textContent = 'No Token Selected';
  elements.tokenDetail.tokenSymbol!.textContent = '';
  updateTokenAddressButton('Browse a supported site or enter a token address', null);
  elements.tokenDetail.scoreValue!.textContent = '--';
  elements.tokenDetail.scoreCircle!.className = 'score-circle';
  elements.tokenDetail.riskLabel!.textContent = 'ANALYZE TOKEN';
  elements.tokenDetail.checksList!.innerHTML = `
    <div class="check-item">
      <div class="check-content">
        <div class="check-label check-label-center">
          Click a token badge on a supported Solana site or use manual entry
        </div>
      </div>
    </div>
  `;
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = '';
  }
}

function renderUsageLimitState(): void {
  const branding = getPlanBranding(state.userProfile?.tier);
  const summary = getUsageSummary();
  const copy = getLimitUpgradeCopy();

  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = 'BarryGuard upgrade recommendation';
  }

  elements.tokenDetail.tokenName!.textContent = 'Hourly Limit Reached';
  elements.tokenDetail.tokenSymbol!.textContent = summary ? `${summary.used}/${summary.limit} USED` : '';
  updateTokenAddressButton(
    summary
      ? 'You have no BarryGuard analyses left in the current hourly window.'
      : 'Your BarryGuard quota is currently exhausted.',
    null,
  );
  elements.tokenDetail.scoreValue!.textContent = '--';
  elements.tokenDetail.scoreCircle!.className = 'score-circle score-medium';
  elements.tokenDetail.riskLabel!.textContent = 'UPGRADE OR WAIT';
  elements.tokenDetail.checksList!.innerHTML = `
    <div class="check-item">
      <div class="check-icon warning">!</div>
      <div class="check-content">
        <div class="check-label">Quota exhausted</div>
        <div class="check-description">Your hourly BarryGuard request budget is fully used.</div>
      </div>
    </div>
    <div class="check-item">
      <div class="check-icon success">+</div>
      <div class="check-content">
        <div class="check-label">Next step</div>
        <div class="check-description">Upgrade your plan for more capacity or wait until the next hourly reset.</div>
      </div>
    </div>
  `;
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = '';
  }
}


function renderAnonDailyLimitState(): void {
  const branding = getPlanBranding(state.userProfile?.tier);
  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = 'BarryGuard daily limit';
  }
  elements.tokenDetail.tokenName!.textContent = 'Daily Scan Limit Reached';
  elements.tokenDetail.tokenSymbol!.textContent = '';
  updateTokenAddressButton("You've reached your 10 free scans for today.", null);
  elements.tokenDetail.scoreValue!.textContent = '--';
  elements.tokenDetail.scoreCircle!.className = 'score-circle';
  elements.tokenDetail.riskLabel!.textContent = 'LIMIT REACHED';
  elements.tokenDetail.checksList!.innerHTML = `
    <div class="check-item">
      <div class="check-content">
        <div class="check-label">You've reached your 10 free scans for today.</div>
        <div class="check-description">Sign up free → 100 scans/day + full history.</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;padding:12px 0;">
      <button id="anon-register-btn" class="btn-primary" style="flex:1;">Create free account</button>
      <button id="anon-login-btn" class="btn-secondary" style="flex:1;">Log in</button>
    </div>
  `;
  document.getElementById('anon-register-btn')?.addEventListener('click', () => {
    setRegisterError(null);
    setStatusMessage(elements.register.message, null);
    showScreen('register');
  });
  document.getElementById('anon-login-btn')?.addEventListener('click', () => {
    showScreen('login');
  });
  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = '';
  }
}

function renderPrimaryTokenState(): void {
  renderUsageIndicator();

  if (state.selectedToken?.score) {
    renderTokenDetail(state.selectedToken.score);
    return;
  }

  if (hasExhaustedUsage()) {
    renderUsageLimitState();
    return;
  }

  renderEmptyState();
}


function renderTokenDetail(score: TokenScore): void {
  const risk = getRiskLevel(score.score);
  const userTier = getEffectiveViewerTier();
  const branding = getPlanBranding(userTier);

  // v2 API provides tokenName, tokenSymbol, tokenLogoUrl directly
  const tokenName = score.tokenName ?? 'Unknown Token';
  const tokenSymbol = score.tokenSymbol ?? '';
  const tokenLogo = score.tokenLogoUrl || state.selectedToken?.metadata?.imageUrl;

  if (elements.tokenDetail.tokenLogo) {
    elements.tokenDetail.tokenLogo.src = tokenLogo || branding.tokenFallbackLogo;
    elements.tokenDetail.tokenLogo.alt = tokenName;
    elements.tokenDetail.tokenLogo.onerror = () => {
      if (elements.tokenDetail.tokenLogo) {
        elements.tokenDetail.tokenLogo.onerror = null;
        elements.tokenDetail.tokenLogo.src = branding.tokenFallbackLogo;
      }
    };
  }

  elements.tokenDetail.tokenName!.textContent = tokenName;
  elements.tokenDetail.tokenSymbol!.textContent = tokenSymbol;
  updateTokenAddressButton(truncateAddress(score.address), score.address);
  elements.tokenDetail.scoreValue!.textContent = String(score.score);
  elements.tokenDetail.scoreCircle!.className = `score-circle score-${risk}`;
  elements.tokenDetail.riskLabel!.textContent = `${risk.toUpperCase()} RISK`;
  renderUsageIndicator();

  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = score.address;
  }

  // V2 rendering
  renderSubscores(score);
  if (elements.tokenDetail.reasonsContainer && elements.tokenDetail.reasonsList) {
    renderReasons(score, elements.tokenDetail.reasonsContainer, elements.tokenDetail.reasonsList);
  }
  renderAnalysisFooter(score, elements.tokenDetail.analyzedAt, elements.tokenDetail.confidenceBadge);
  if (elements.tokenDetail.checksList) {
    renderChecks(score, elements.tokenDetail.checksList);
  }
}

function updateAccountScreen(): void {
  const user = state.userProfile;
  if (!user) {
    elements.account.email!.textContent = 'Guest';
    elements.account.tierName!.textContent = 'Free Tier';
    elements.account.subscriptionInfo?.classList.add('hidden');
    setTierBadgeClass('free');
    applyPlanBranding();
    renderUsageIndicator();
    return;
  }

  elements.account.email!.textContent = user.email;
  elements.account.tierName!.textContent = formatTier(user.tier);
  setTierBadgeClass(user.tier);
  applyPlanBranding();
  renderUsageIndicator();

  if (user.tier === 'free') {
    elements.account.subscriptionInfo?.classList.add('hidden');
    return;
  }

  elements.account.subscriptionInfo?.classList.remove('hidden');
  elements.account.periodEnd!.textContent = user.currentPeriodEnd
    ? new Date(user.currentPeriodEnd).toLocaleDateString()
    : '--';
}

function handleSelectedTokenUpdate(selectedToken: SelectedToken | null): void {
  if (scoreRefreshAddress !== selectedToken?.address) {
    clearScheduledScoreRefresh();
    scoreRefreshAddress = selectedToken?.address ?? null;
    scoreRefreshAttempts = 0;
  }

  state.selectedToken = selectedToken;
  renderPrimaryTokenState();

  if (selectedToken?.score) {
    void hydrateSelectedTokenMetadata(selectedToken);
    scheduleSelectedTokenScoreRefresh();
  }
}

function clearScheduledScoreRefresh(): void {
  if (scoreRefreshTimeoutId) {
    window.clearTimeout(scoreRefreshTimeoutId);
    scoreRefreshTimeoutId = null;
  }
}

function shouldKeepRefreshingScore(score: TokenScore): boolean {
  return score.cached === false || isTokenScoreLikelyIncomplete(score);
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
    return false;
  }

  state.isLoggedIn = true;
  state.userProfile = response.data;
  applyPlanBranding();
  renderUsageIndicator();
  return true;
}

async function handleAccountOpen(): Promise<void> {
  if (!state.isLoggedIn) {
    showScreen('login');
    return;
  }

  await loadUserProfile();
  showScreen(state.isLoggedIn ? 'account' : 'login');
}

async function loadUsageState(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get('hourly_usage_state');
    state.usageState = (stored.hourly_usage_state as HourlyUsageState | undefined) ?? null;
  } catch {
    state.usageState = null;
  }

  renderUsageIndicator();
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

  const shouldBypassLocalCache = shouldKeepRefreshingScore(selectedToken.score);
  const response = await sendMessage<TokenScore>({
    type: shouldBypassLocalCache ? 'GET_TOKEN_SCORE_FRESH' : 'GET_TOKEN_SCORE',
    payload: shouldBypassLocalCache
      ? {
          address: selectedToken.address,
          skipLocalCache: true,
          preferExistingOnly: true,
        }
      : selectedToken.address,
  }, 5000);

  if (!response.success || !response.data) {
    if (shouldRetryScoreRefresh(response)) {
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
  scheduleSelectedTokenScoreRefresh();
}


async function handleLogin(): Promise<void> {
  const email = elements.login.email?.value.trim() ?? '';
  const password = elements.login.password?.value ?? '';
  setStatusMessage(elements.login.message, null);

  if (!email || !password) {
    window.alert('Please enter email and password.');
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
      window.alert(response.error ?? 'Login failed.');
      return;
    }

    state.isLoggedIn = true;
    state.userProfile = response.data;
    applyPlanBranding();
    renderUsageIndicator();
    await refreshSelectedTokenScore();
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

      if (response.errorType === 'rate_limit') {
        setManualError(null);
        renderPrimaryTokenState();
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
    showScreen('token-detail');
  } finally {
    elements.manual.analyzeBtn.disabled = false;
    elements.manual.analyzeBtn.textContent = 'Analyze Token';
  }
}

async function handleRefreshToken(): Promise<void> {
  const selectedToken = state.selectedToken;
  if (!selectedToken?.address) return;

  const tier = getEffectiveViewerTier();
  if (tier === 'free') {
    window.alert('Upgrade to Rescue Pass to refresh token analysis on demand.');
    return;
  }

  const btn = elements.tokenDetail.refreshBtn as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

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
    } else if (response.errorType === 'plan_gate') {
      window.alert('Refresh is available on Rescue Pass and Pro plans.');
    }
  } finally {
    if (btn) btn.disabled = false;
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

  window.alert(response.error ?? 'Google login is currently unavailable.');
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

    if (changes.user_profile) {
      const previousTier = state.userProfile?.tier ?? null;
      state.userProfile = (changes.user_profile.newValue as UserProfile | undefined) ?? null;
      applyPlanBranding();
      renderUsageIndicator();
      if (state.currentScreen === 'account') {
        updateAccountScreen();
      }
      renderPrimaryTokenState();
      if (previousTier !== (state.userProfile?.tier ?? null)) {
        void refreshSelectedTokenScore();
      }
    }

    if (changes.hourly_usage_state) {
      state.usageState = (changes.hourly_usage_state.newValue as HourlyUsageState | undefined) ?? null;
      renderUsageIndicator();
      if (!state.selectedToken) {
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

  elements.tokenDetail.refreshBtn?.addEventListener('click', () => {
    void handleRefreshToken();
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
  });
  elements.register.registerBtn?.addEventListener('click', () => {
    void handleRegister();
  });
  elements.register.magicLinkBtn?.addEventListener('click', () => {
    void handleMagicLink('register');
  });
  elements.register.googleBtn?.addEventListener('click', () => {
    void handleOAuth();
  });

  elements.account.backBtn?.addEventListener('click', () => showScreen('token-detail'));
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

  elements.manual.backBtn?.addEventListener('click', () => showScreen('token-detail'));
  elements.manual.analyzeBtn?.addEventListener('click', () => {
    void handleAnalyze();
  });
  elements.manual.addressInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleAnalyze();
    }
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
    await loadUsageState();
    await loadSelectedToken();
    await refreshSelectedTokenScore();
  } catch (error) {
    console.error('[BarryGuard] Popup initialization failed:', error);
    renderPrimaryTokenState();
  } finally {
    applyPlanBranding();
    renderUsageIndicator();
    showScreen('token-detail');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  }, { once: true });
} else {
  void init();
}
