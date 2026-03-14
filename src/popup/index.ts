import type {
  ApiResponse,
  CheckResult,
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
  getOAuthUrl,
  getPricingUrl,
} from '../shared/runtime-config';

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

const SCORE_THRESHOLDS = {
  high: 30,
  medium: 60,
} as const;

const CHECK_ORDER = [
  'mintAuthority',
  'freezeAuthority',
  'liquidityLocked',
  'topHolderConcentration',
  'tokenAge',
  'holderCount',
] as const;

const CHECK_FALLBACK_TIERS: Record<string, TierLevel> = {
  mintAuthority: 'free',
  freezeAuthority: 'free',
  liquidityLocked: 'free',
  topHolderConcentration: 'rescue_pass',
  tokenAge: 'rescue_pass',
  holderCount: 'rescue_pass',
};

const state: PopupState = {
  currentScreen: 'loading',
  initialized: false,
  isLoggedIn: false,
  userProfile: null,
  selectedToken: null,
  usageState: null,
};

let isHydratingSelectedTokenMetadata = false;

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
    tokenAddress: document.getElementById('token-address'),
    scoreCircle: document.getElementById('score-circle'),
    scoreValue: document.getElementById('score-value'),
    riskLabel: document.getElementById('risk-label'),
    checksList: document.getElementById('checks-list'),
    upgradeBanner: document.getElementById('upgrade-banner'),
    upgradeBannerTitle: document.getElementById('upgrade-banner-title'),
    upgradeBannerBody: document.getElementById('upgrade-banner-body'),
    manualEntryBtn: document.getElementById('manual-entry-btn'),
    accountBtn: document.getElementById('account-btn'),
    upgradeBtn: document.getElementById('upgrade-btn'),
    viewExplorer: document.getElementById('view-explorer'),
  },
  login: {
    email: document.getElementById('email') as HTMLInputElement | null,
    password: document.getElementById('password') as HTMLInputElement | null,
    loginBtn: document.getElementById('login-btn') as HTMLButtonElement | null,
    googleBtn: document.getElementById('google-login-btn'),
    githubBtn: document.getElementById('github-login-btn'),
    backBtn: document.getElementById('login-back-btn'),
    forgotPassword: document.getElementById('forgot-password-link'),
    registerLink: document.getElementById('register-link'),
  },
  register: {
    email: document.getElementById('register-email') as HTMLInputElement | null,
    password: document.getElementById('register-password') as HTMLInputElement | null,
    passwordConfirm: document.getElementById('register-password-confirm') as HTMLInputElement | null,
    registerBtn: document.getElementById('register-btn') as HTMLButtonElement | null,
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

function openExternal(url: string): void {
  if (chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function handleUpgradeFlow(): void {
  if (state.userProfile?.tier === 'pro') {
    openExternal(state.userProfile.customerPortalUrl ?? getAccountUrl());
    return;
  }

  if (state.userProfile?.tier === 'rescue_pass' && state.userProfile.customerPortalUrl) {
    openExternal(state.userProfile.customerPortalUrl);
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

function getRiskLevel(score: number): 'high' | 'medium' | 'low' {
  if (score <= SCORE_THRESHOLDS.high) {
    return 'high';
  }

  if (score <= SCORE_THRESHOLDS.medium) {
    return 'medium';
  }

  return 'low';
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

function getCurrentUsageBucketKey(tier: TierLevel, audience: 'anonymous' | 'authenticated'): string {
  return `${audience}:${tier}:${Math.floor(Date.now() / 3600000)}`;
}

function getUsageSummary(): { limit: number; used: number; remaining: number; ratio: number } | null {
  const tier = state.userProfile?.tier ?? state.usageState?.tier ?? 'free';
  const audience: 'anonymous' | 'authenticated' = state.userProfile ? 'authenticated' : 'anonymous';
  const usageState = state.usageState;
  const limit = state.userProfile?.singleTokenHourlyLimit ?? usageState?.limit ?? 0;
  if (limit <= 0) {
    return null;
  }

  const activeBucketKey = getCurrentUsageBucketKey(tier, audience);
  const used =
    usageState &&
    usageState.bucketKey === activeBucketKey &&
    usageState.tier === tier &&
    usageState.audience === audience
      ? Math.min(usageState.used, limit)
      : 0;

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    ratio: used / limit,
  };
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

function updateUpgradeBanner(
  visible: boolean,
  copy?: { title: string; body: string; buttonLabel: string },
): void {
  if (!elements.tokenDetail.upgradeBanner) {
    return;
  }

  if (!visible || !copy) {
    elements.tokenDetail.upgradeBanner.classList.add('hidden');
    return;
  }

  elements.tokenDetail.upgradeBanner.classList.remove('hidden');
  if (elements.tokenDetail.upgradeBannerTitle) {
    elements.tokenDetail.upgradeBannerTitle.textContent = copy.title;
  }
  if (elements.tokenDetail.upgradeBannerBody) {
    elements.tokenDetail.upgradeBannerBody.textContent = copy.body;
  }
  if (elements.tokenDetail.upgradeBtn instanceof HTMLButtonElement) {
    elements.tokenDetail.upgradeBtn.textContent = copy.buttonLabel;
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
  elements.tokenDetail.tokenAddress!.textContent = 'Browse pump.fun or enter a token address';
  elements.tokenDetail.scoreValue!.textContent = '--';
  elements.tokenDetail.scoreCircle!.className = 'score-circle';
  elements.tokenDetail.riskLabel!.textContent = 'ANALYZE TOKEN';
  elements.tokenDetail.checksList!.innerHTML = `
    <div class="check-item">
      <div class="check-content">
        <div class="check-label check-label-center">
          Click a token badge on pump.fun or use manual entry
        </div>
      </div>
    </div>
  `;
  updateUpgradeBanner(false);
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
  elements.tokenDetail.tokenAddress!.textContent = summary
    ? 'You have no BarryGuard analyses left in the current hourly window.'
    : 'Your BarryGuard quota is currently exhausted.';
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
  updateUpgradeBanner(true, copy);
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

function renderChecks(score: TokenScore): void {
  const list = elements.tokenDetail.checksList;
  if (!list) {
    return;
  }

  const userTier = state.userProfile?.tier ?? 'free';
  list.innerHTML = '';

  for (const checkKey of CHECK_ORDER) {
    const check = score.checks[checkKey] as CheckResult | undefined;
    if (!check) {
      continue;
    }

    const requiredTier = check.tier ?? CHECK_FALLBACK_TIERS[checkKey] ?? 'free';
    const locked = check.locked === true || !canAccessTier(userTier, requiredTier);
    const item = document.createElement('div');
    item.className = `check-item${locked ? ' locked' : ''}`;

    if (locked) {
      item.innerHTML = `
        <div class="check-icon locked-icon">LOCK</div>
        <div class="check-content">
          <div class="check-label">${check.label}</div>
          <div class="check-locked">Upgrade to ${formatTier(requiredTier)}</div>
        </div>
      `;
    } else {
      const statusClass =
        check.status === 'success'
          ? 'success'
          : check.status === 'warning'
            ? 'warning'
            : 'danger';
      const statusLabel =
        check.status === 'success'
          ? 'OK'
          : check.status === 'warning'
            ? '!'
            : 'X';

      item.innerHTML = `
        <div class="check-icon ${statusClass}">${statusLabel}</div>
        <div class="check-content">
          <div class="check-label">${check.label}</div>
          <div class="check-description">${check.description}</div>
        </div>
      `;
    }

    list.appendChild(item);
  }
}

function renderTokenDetail(score: TokenScore): void {
  const risk = getRiskLevel(score.score);
  const userTier = state.userProfile?.tier ?? 'free';
  const branding = getPlanBranding(userTier);
  const tokenMetadata: TokenMetadata = {
    ...(score.token ?? {}),
    ...(state.selectedToken?.metadata ?? {}),
  };
  const tokenName = tokenMetadata?.name ?? 'Unknown Token';
  const tokenSymbol = tokenMetadata?.symbol ?? '';
  const tokenLogo = tokenMetadata?.imageUrl;

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
  elements.tokenDetail.tokenAddress!.textContent = truncateAddress(score.address);
  elements.tokenDetail.scoreValue!.textContent = String(score.score);
  elements.tokenDetail.scoreCircle!.className = `score-circle score-${risk}`;
  elements.tokenDetail.riskLabel!.textContent = `${risk.toUpperCase()} RISK`;
  renderUsageIndicator();
  updateUpgradeBanner(
    userTier === 'free',
    userTier === 'free'
      ? {
          title: 'Upgrade to Rescue Pass',
          body: 'Unlock all 6 risk checks',
          buttonLabel: 'Upgrade',
        }
      : undefined,
  );

  if (elements.tokenDetail.viewExplorer instanceof HTMLAnchorElement) {
    elements.tokenDetail.viewExplorer.dataset.address = score.address;
  }

  renderChecks(score);
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
  state.selectedToken = selectedToken;
  renderPrimaryTokenState();

  if (selectedToken?.score) {
    void hydrateSelectedTokenMetadata(selectedToken);
  }
}

async function hydrateSelectedTokenMetadata(selectedToken: SelectedToken): Promise<void> {
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
    renderTokenDetail(mergedToken.score);
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

async function loadUserProfile(): Promise<void> {
  const response = await sendMessage<UserProfile>({ type: 'GET_USER_TIER' });
  if (!response.success || !response.data) {
    state.isLoggedIn = false;
    state.userProfile = null;
    applyPlanBranding();
    renderUsageIndicator();
    return;
  }

  state.isLoggedIn = true;
  state.userProfile = response.data;
  applyPlanBranding();
  renderUsageIndicator();
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

async function handleLogin(): Promise<void> {
  const email = elements.login.email?.value.trim() ?? '';
  const password = elements.login.password?.value ?? '';

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
    showCurrentOrEmptyToken();
    showScreen('token-detail');
  } finally {
    elements.login.loginBtn.disabled = false;
    elements.login.loginBtn.textContent = 'Login';
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
    showCurrentOrEmptyToken();
    showScreen('token-detail');
  } finally {
    elements.register.registerBtn.disabled = false;
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

async function handleOAuth(provider: 'google' | 'github'): Promise<void> {
  const response = await sendMessage<{ url: string }>({
    type: 'OAUTH_LOGIN',
    payload: provider,
  });

  if (response.success && response.data?.url) {
    openExternal(response.data.url);
    window.close();
    return;
  }

  openExternal(getOAuthUrl(provider));
  window.close();
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
      state.userProfile = (changes.user_profile.newValue as UserProfile | undefined) ?? null;
      applyPlanBranding();
      renderUsageIndicator();
      if (state.currentScreen === 'account') {
        updateAccountScreen();
      }
      renderPrimaryTokenState();
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
    showScreen(state.isLoggedIn ? 'account' : 'login');
  });

  elements.tokenDetail.upgradeBtn?.addEventListener('click', () => {
    handleUpgradeFlow();
  });

  elements.tokenDetail.viewExplorer?.addEventListener('click', (event) => {
    event.preventDefault();
    const address = (event.currentTarget as HTMLAnchorElement).dataset.address;
    if (address) {
      openExternal(`https://solscan.io/token/${address}`);
    }
  });

  elements.login.backBtn?.addEventListener('click', () => showScreen('token-detail'));
  elements.login.loginBtn?.addEventListener('click', () => {
    void handleLogin();
  });
  elements.login.googleBtn?.addEventListener('click', () => {
    void handleOAuth('google');
  });
  elements.login.githubBtn?.addEventListener('click', () => {
    void handleOAuth('github');
  });
  elements.login.forgotPassword?.addEventListener('click', (event) => {
    event.preventDefault();
    openExternal(getForgotPasswordUrl());
  });
  elements.login.registerLink?.addEventListener('click', (event) => {
    event.preventDefault();
    setRegisterError(null);
    showScreen('register');
  });

  elements.register.backBtn?.addEventListener('click', () => showScreen('login'));
  elements.register.toLoginLink?.addEventListener('click', (event) => {
    event.preventDefault();
    showScreen('login');
  });
  elements.register.registerBtn?.addEventListener('click', () => {
    void handleRegister();
  });
  elements.register.googleBtn?.addEventListener('click', () => {
    void handleOAuth('google');
  });

  elements.account.backBtn?.addEventListener('click', () => showScreen('token-detail'));
  elements.account.manageBtn?.addEventListener('click', () => {
    if (state.userProfile?.customerPortalUrl) {
      openExternal(state.userProfile.customerPortalUrl);
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
