import { PumpFunPlatform } from '../platforms/pumpfun';
import { PumpSwapPlatform } from '../platforms/pumpswap';
import { RaydiumPlatform } from '../platforms/raydium';
import { LetsBonkPlatform } from '../platforms/letsbonk';
import { MoonshotPlatform } from '../platforms/moonshot';
import { DexScreenerPlatform } from '../platforms/dexscreener';
import { BirdeyePlatform } from '../platforms/birdeye';
import { BagsPlatform } from '../platforms/bags';
import { SolscanPlatform } from '../platforms/solscan';
import { DextoolsPlatform } from '../platforms/dextools';
import { CoinMarketCapDexPlatform } from '../platforms/coinmarketcap-dex';
import { CoinGeckoSolanaPlatform } from '../platforms/coingecko-solana';
import { UniswapPlatform } from '../platforms/uniswap-app';
import { PancakeSwapPlatform } from '../platforms/pancakeswap-app';
import { AerodromePlatform } from '../platforms/aerodrome-app';
import { EtherscanPlatform } from '../platforms/etherscan';
import { BscscanPlatform } from '../platforms/bscscan';
import { BasescanPlatform } from '../platforms/basescan';
import { GoPlusPlatform } from '../platforms/goplus';
import { TokenSnifferPlatform } from '../platforms/tokensniffer';
import { HoneypotIsPlatform } from '../platforms/honeypot-is';
import { GeckoTerminalPlatform } from '../platforms/geckoterminal';
import { AveAiPlatform } from '../platforms/ave-ai';
import { DexViewPlatform } from '../platforms/dexview';
import { SushiSwapPlatform } from '../platforms/sushiswap';
import { OneInchPlatform } from '../platforms/oneinch';
import { MatchaPlatform } from '../platforms/matcha';
import { CowSwapPlatform } from '../platforms/cowswap';
import { ParaswapPlatform } from '../platforms/paraswap';
import { BaseSwapPlatform } from '../platforms/baseswap';
import { FlaunchPlatform } from '../platforms/flaunch';
import { FourMemePlatform } from '../platforms/four-meme';
import { GmgnEvmPlatform } from '../platforms/gmgn-evm';
import { PoocoinPlatform } from '../platforms/poocoin';
import { VirtualsPlatform } from '../platforms/virtuals';
import { DeBankPlatform } from '../platforms/debank';
import { ZerionPlatform } from '../platforms/zerion';
import type { IPlatform } from '../platforms/platform.interface';
import type { ApiResponse, SelectedToken, TierLevel, TokenMetadata, TokenScore } from '../shared/types';

const PLATFORMS: IPlatform[] = [
  new PumpSwapPlatform(),
  new PumpFunPlatform(),
  new RaydiumPlatform(),
  new LetsBonkPlatform(),
  new MoonshotPlatform(),
  new DexScreenerPlatform(),
  new DextoolsPlatform(),
  new BirdeyePlatform(),
  new BagsPlatform(),
  new SolscanPlatform(),
  new CoinMarketCapDexPlatform(),
  new CoinGeckoSolanaPlatform(),
  new UniswapPlatform(),
  new PancakeSwapPlatform(),
  new AerodromePlatform(),
  new EtherscanPlatform(),
  new BscscanPlatform(),
  new BasescanPlatform(),
  new GoPlusPlatform(),
  new TokenSnifferPlatform(),
  new HoneypotIsPlatform(),
  new GeckoTerminalPlatform(),
  new AveAiPlatform(),
  new DexViewPlatform(),
  new SushiSwapPlatform(),
  new OneInchPlatform(),
  new MatchaPlatform(),
  new CowSwapPlatform(),
  new ParaswapPlatform(),
  new BaseSwapPlatform(),
  new FlaunchPlatform(),
  new FourMemePlatform(),
  new GmgnEvmPlatform(),
  new PoocoinPlatform(),
  new VirtualsPlatform(),
  new DeBankPlatform(),
  new ZerionPlatform(),
];
const PROFILE_STORAGE_KEY = 'user_profile';
const SELECTED_TOKEN_STORAGE_KEY = 'selectedToken';
const RETRY_BASE_DELAY_MS = 1500;
const MAX_DETAIL_RETRY_ATTEMPTS = 6;
const STORAGE_RECONCILE_INTERVAL_MS = 1000;
const MAX_STORAGE_RECONCILE_ATTEMPTS = 180;

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  return message.toLowerCase().includes('extension context invalidated');
}

function hasExtensionRuntime(): boolean {
  return Boolean(chrome?.runtime?.id);
}

function withSafeRuntime<T>(action: () => T): T | undefined {
  if (!hasExtensionRuntime()) {
    return undefined;
  }

  try {
    return action();
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return undefined;
    }

    throw error;
  }
}

function sendRuntimeMessage(
  message: { type: string; payload?: unknown },
  callback: (response: { success: boolean; data?: unknown; error?: string }) => void,
): void {
  withSafeRuntime(() => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError?.message;
      if (runtimeError && isExtensionContextInvalidatedError(runtimeError)) {
        return;
      }

      callback(response);
    });
  });
}

function persistSelectedToken(selectedToken: {
  address: string;
  score?: TokenScore;
  metadata?: TokenMetadata;
}): void {
  withSafeRuntime(() => {
    void chrome.storage.local.set({ selectedToken }).catch((error: unknown) => {
      if (!isExtensionContextInvalidatedError(error)) {
        console.error('[BarryGuard] Failed to persist selected token:', error);
      }
    });
  });
}

function detectPlatform(): IPlatform | null {
  for (const platform of PLATFORMS) {
    if (platform.matchesLocation(window.location)) {
      return platform;
    }
  }

  return null;
}

export function getCurrentPageAddress(pathOrUrl: string): string | null {
  const preferredKeys = ['outputMint', 'tokenAddress', 'mint', 'baseMint', 'address', 'inputMint', 'quoteMint'];
  for (const key of preferredKeys) {
    const queryMatch = pathOrUrl.match(new RegExp(`[?&]${key}=([1-9A-HJ-NP-Za-km-z]{32,44})`, 'i'));
    if (queryMatch?.[1]) {
      return queryMatch[1];
    }
  }

  const pathMatch = pathOrUrl.match(/\/(?:coin|token|trade|swap|coins?)\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i)
    ?? pathOrUrl.match(/(?:^|\/)([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/)
    ?? pathOrUrl.match(/^\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/);

  return pathMatch?.[1] ?? null;
}


export function selectAddressesForTier(
  addresses: string[],
  currentAddress: string | null,
  tier: TierLevel,
): { active: string[] } {
  return selectAddressesForContext(addresses, currentAddress, tier);
}

export function selectAddressesForContext(
  addresses: string[],
  currentAddress: string | null,
  tier: TierLevel,
): { active: string[] } {
  if (currentAddress) {
    return { active: addresses.filter((address) => address === currentAddress) };
  }

  return { active: addresses };
}

export function shouldRetryTokenScoreFetch(
  currentPageAddress: string | null,
  address: string,
  response: ApiResponse<TokenScore> | undefined,
): boolean {
  if (currentPageAddress !== address) {
    return false;
  }

  if (!response || response.success) {
    return false;
  }

  if (response.statusCode === 400 || response.statusCode === 401 || response.statusCode === 403) {
    return false;
  }

  if (response.errorType === 'plan_gate' || response.errorType === 'validation') {
    return false;
  }

  if (response.errorType === 'rate_limit' || response.errorType === 'cooldown') {
    return false;
  }

  return true;
}

export function shouldApplySelectedTokenScore(
  currentPageAddress: string | null,
  selectedToken: SelectedToken | undefined,
): selectedToken is SelectedToken & { score: TokenScore } {
  return Boolean(
    currentPageAddress
    && selectedToken?.score
    && selectedToken.address === currentPageAddress,
  );
}

export function initializeContentScript(): void {
  const detectedPlatform = detectPlatform();
  if (!detectedPlatform) {
    console.log('[BarryGuard] No supported platform detected');
    return;
  }

  const platform = detectedPlatform;
  console.log(`[BarryGuard] Platform: ${platform.name}`);
  const HEALTH_EVENT_KINDS = ['anchor_not_found', 'injection_failed', 'scan_zero_tokens'] as const;
  type HealthEventKind = typeof HEALTH_EVENT_KINDS[number];

  const ZERO_SCAN_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
  const ZERO_SCAN_MIN_CONSECUTIVE = 3;
  const zeroScanState = new Map<string, { lastSentAt: number; consecutive: number }>();
  let lastZeroScanKey: string | null = null;

  function reportHealth(eventKind: HealthEventKind): void {
    if (eventKind === 'scan_zero_tokens') {
      const pathname = window.location.pathname ?? '/';
      const key = `${platform.id}:${pathname}:${eventKind}`;

      // Reset consecutive counter when key changes (e.g. navigation)
      if (lastZeroScanKey !== key) {
        if (lastZeroScanKey) {
          zeroScanState.delete(lastZeroScanKey);
        }
        lastZeroScanKey = key;
      }

      const now = Date.now();
      const state = zeroScanState.get(key) ?? { lastSentAt: 0, consecutive: 0 };
      const nextConsecutive = state.consecutive + 1;

      zeroScanState.set(key, {
        lastSentAt: state.lastSentAt,
        consecutive: nextConsecutive,
      });

      // Soft-dedupe: only emit after N consecutive empty scans, and not more often than the window.
      if (nextConsecutive < ZERO_SCAN_MIN_CONSECUTIVE) {
        return;
      }
      if (now - state.lastSentAt < ZERO_SCAN_DEDUPE_WINDOW_MS) {
        return;
      }

      zeroScanState.set(key, { lastSentAt: now, consecutive: nextConsecutive });
    } else {
      // Any "real" failure should reset the empty-scan counter so follow-up events can still fire.
      if (lastZeroScanKey) {
        zeroScanState.delete(lastZeroScanKey);
        lastZeroScanKey = null;
      }
    }

    sendRuntimeMessage(
      {
        type: 'REPORT_EXTENSION_HEALTH',
        payload: {
          platformId: platform.id,
          eventKind,
        },
      },
      () => {},
    );
  }
  const pending = new Set<string>();
  const resolvedScores = new Map<string, TokenScore>();
  const retryAttempts = new Map<string, number>();
  const retryTimers = new Map<string, number>();
  const renderRetryAttempts = new Map<string, number>();
  const renderRetryTimers = new Map<string, number>();
  const storageReconcileAttempts = new Map<string, number>();
  const storageReconcileTimers = new Map<string, number>();
  let lastUrl = window.location.href;
  let currentTier: TierLevel = 'free';

  function hasRenderedBadge(address: string): boolean {
    return Boolean(document.querySelector(`[data-barryguard-badge="${address}"]`));
  }

  function hasResolvedBadge(address: string): boolean {
    return resolvedScores.has(address) && hasRenderedBadge(address);
  }

  function clearRetry(address: string): void {
    retryAttempts.delete(address);
    const timerId = retryTimers.get(address);
    if (timerId) {
      window.clearTimeout(timerId);
      retryTimers.delete(address);
    }
  }

  function clearRenderRetry(address: string): void {
    renderRetryAttempts.delete(address);
    const timerId = renderRetryTimers.get(address);
    if (timerId) {
      window.clearTimeout(timerId);
      renderRetryTimers.delete(address);
    }
  }

  function clearStorageReconcile(address: string): void {
    storageReconcileAttempts.delete(address);
    const timerId = storageReconcileTimers.get(address);
    if (timerId) {
      window.clearTimeout(timerId);
      storageReconcileTimers.delete(address);
    }
  }

  function clearAddressState(address: string): void {
    clearRetry(address);
    clearRenderRetry(address);
    clearStorageReconcile(address);
    pending.delete(address);
    resolvedScores.delete(address);
  }

  function shouldRetryScoreFetch(address: string, response: ApiResponse<TokenScore> | undefined): boolean {
    return shouldRetryTokenScoreFetch(platform.getCurrentPageAddress(), address, response);
  }

  function scheduleRetry(address: string): void {
    if (retryTimers.has(address)) {
      return;
    }

    const nextAttempt = (retryAttempts.get(address) ?? 0) + 1;
    if (nextAttempt > MAX_DETAIL_RETRY_ATTEMPTS) {
      return;
    }

    retryAttempts.set(address, nextAttempt);
    const delayMs = RETRY_BASE_DELAY_MS * nextAttempt;
    const timerId = window.setTimeout(() => {
      retryTimers.delete(address);
      fetchAndRender(address);
    }, delayMs);
    retryTimers.set(address, timerId);
  }

  function scheduleRenderRetry(address: string): void {
    if (renderRetryTimers.has(address)) {
      return;
    }

    const score = resolvedScores.get(address);
    if (!score || platform.getCurrentPageAddress() !== address) {
      return;
    }

    const nextAttempt = (renderRetryAttempts.get(address) ?? 0) + 1;
    if (nextAttempt > 20) {
      reportHealth('injection_failed');
      return;
    }

    renderRetryAttempts.set(address, nextAttempt);
    const delayMs = Math.min(500 * nextAttempt, 2000);
    const timerId = window.setTimeout(() => {
      renderRetryTimers.delete(address);
      const latestScore = resolvedScores.get(address);
      if (!latestScore) {
        return;
      }

      platform.renderScoreBadge(address, latestScore);
      if (!hasRenderedBadge(address)) {
        scheduleRenderRetry(address);
        return;
      }

      clearRenderRetry(address);
    }, delayMs);
    renderRetryTimers.set(address, timerId);
  }

  function applySelectedTokenScore(selectedToken: SelectedToken | undefined): boolean {
    if (!shouldApplySelectedTokenScore(platform.getCurrentPageAddress(), selectedToken)) {
      return false;
    }

    resolvedScores.set(selectedToken.address, selectedToken.score);
    clearRetry(selectedToken.address);
    pending.delete(selectedToken.address);
    platform.renderScoreBadge(selectedToken.address, selectedToken.score);
    if (!hasRenderedBadge(selectedToken.address)) {
      scheduleRenderRetry(selectedToken.address);
    } else {
      clearRenderRetry(selectedToken.address);
      clearStorageReconcile(selectedToken.address);
    }

    return true;
  }

  function reconcileSelectedTokenFromStorage(address: string): void {
    withSafeRuntime(() => {
      void chrome.storage.local.get(SELECTED_TOKEN_STORAGE_KEY).then((stored) => {
        const selectedToken = stored[SELECTED_TOKEN_STORAGE_KEY] as SelectedToken | undefined;
        if (!applySelectedTokenScore(selectedToken) && platform.getCurrentPageAddress() === address && !hasResolvedBadge(address)) {
          scheduleStorageReconcile(address);
        }
      }).catch((error: unknown) => {
        if (!isExtensionContextInvalidatedError(error) && platform.getCurrentPageAddress() === address && !hasResolvedBadge(address)) {
          scheduleStorageReconcile(address);
        }
      });
    });
  }

  function scheduleStorageReconcile(address: string): void {
    if (storageReconcileTimers.has(address) || platform.getCurrentPageAddress() !== address || hasResolvedBadge(address)) {
      return;
    }

    const nextAttempt = (storageReconcileAttempts.get(address) ?? 0) + 1;
    if (nextAttempt > MAX_STORAGE_RECONCILE_ATTEMPTS) {
      return;
    }

    storageReconcileAttempts.set(address, nextAttempt);
    const timerId = window.setTimeout(() => {
      storageReconcileTimers.delete(address);
      reconcileSelectedTokenFromStorage(address);
    }, STORAGE_RECONCILE_INTERVAL_MS);
    storageReconcileTimers.set(address, timerId);
  }

  function updateTierFromProfile(profile: unknown): void {
    const maybeTier = (profile as { tier?: TierLevel } | undefined)?.tier;
    currentTier = maybeTier === 'rescue_pass' || maybeTier === 'pro' ? maybeTier : 'free';
  }

  function loadUserTier(): void {
    sendRuntimeMessage({ type: 'GET_USER_TIER' }, (response) => {
      if (!response?.success || !response.data) {
        currentTier = 'free';
        scanAll();
        return;
      }

      updateTierFromProfile(response.data);
      scanAll();
    });
  }

  function isRateLimitResponse(response: ApiResponse<TokenScore> | undefined): boolean {
    return Boolean(
      response
      && !response.success
      && (response.errorType === 'rate_limit' || response.errorType === 'cooldown' || response.errorType === 'anon_daily_limit'),
    );
  }

  function fetchAndRender(address: string): void {
    if (pending.has(address)) {
      return;
    }

    pending.add(address);
    platform.renderLoadingBadge(address);
    if (!hasRenderedBadge(address)) {
      reportHealth('anchor_not_found');
    }

    const chain = (platform.detectChainFromUrl?.(window.location.href) ?? platform.chains?.[0]) ?? 'solana';
    sendRuntimeMessage({ type: 'GET_TOKEN_SCORE', payload: { address, chain } }, (response) => {
      pending.delete(address);
      if (response?.success && response.data) {
        clearRetry(address);
        const score = response.data as TokenScore;
        resolvedScores.set(address, score);
        platform.renderScoreBadge(address, score);
        if (!hasRenderedBadge(address)) {
          scheduleRenderRetry(address);
        } else {
          clearRenderRetry(address);
        }

        if (platform.getCurrentPageAddress() === address) {
          const selectedToken = platform.buildSelectedToken(address, score);

          // Persist score immediately so the popup can show it right away
          persistSelectedToken(selectedToken);

          // Metadata is fetched separately and persisted as an update
          sendRuntimeMessage({ type: 'GET_TOKEN_METADATA', payload: address }, (metadataResponse) => {
            const metadata = {
              ...(selectedToken.metadata ?? {}),
              ...((metadataResponse?.success ? metadataResponse.data : {}) as TokenMetadata | undefined),
            };

            persistSelectedToken({
              ...selectedToken,
              metadata,
            });
          });
        }

        return;
      }

      const rateLimited = isRateLimitResponse(response as ApiResponse<TokenScore> | undefined);

      // Bug fix: on rate limit, show lock badge instead of question mark
      if (rateLimited) {
        platform.renderLockedBadge(address);
      } else {
        platform.renderErrorBadge(address);
      }

      // Persist selectedToken on detail page even without focus so
      // the popup always reflects the current token state
      if (platform.getCurrentPageAddress() === address) {
        if (rateLimited) {
          persistSelectedToken({ address });
        } else {
          scheduleStorageReconcile(address);
        }
      }

      if (!rateLimited && shouldRetryScoreFetch(address, response as ApiResponse<TokenScore> | undefined)) {
        scheduleRetry(address);
      }
    });
  }

  function syncVisibleBadges(addresses: string[]): void {
    const visible = new Set(addresses);
    document.querySelectorAll<HTMLElement>('[data-barryguard-badge]').forEach((badge) => {
      const address = badge.dataset.barryguardBadge;
      if (!address || visible.has(address)) {
        return;
      }

      clearAddressState(address);
      badge.remove();
    });
  }

  function scanAll(): void {
    const currentPageAddress = platform.getCurrentPageAddress();
    const { active } = selectAddressesForContext(
      platform.extractTokenAddresses(),
      currentPageAddress,
      currentTier,
    );
    const visibleAddresses = [...active];

    syncVisibleBadges(visibleAddresses);
    if (visibleAddresses.length === 0) {
      reportHealth('scan_zero_tokens');
    } else if (lastZeroScanKey) {
      // Reset the zero-scan state once we successfully detect at least one address again.
      zeroScanState.delete(lastZeroScanKey);
      lastZeroScanKey = null;
    }

    // Detail page: immediately persist selectedToken with address so the popup
    // always shows the current page's token (even before score resolves).
    // Try to include a cached score from a previous visit via the extension cache.
    if (currentPageAddress && document.hasFocus() && !resolvedScores.has(currentPageAddress)) {
      sendRuntimeMessage({ type: 'GET_CACHED_SCORE', payload: currentPageAddress }, (cachedResponse) => {
        if (cachedResponse?.success && cachedResponse.data) {
          const cachedScore = cachedResponse.data as TokenScore;
          const selectedToken = platform.buildSelectedToken(currentPageAddress, cachedScore);
          persistSelectedToken(selectedToken);
        } else {
          persistSelectedToken({ address: currentPageAddress });
        }
      });
    }

    if (currentPageAddress) {
      scheduleStorageReconcile(currentPageAddress);
    }

    // Re-render already resolved scores
    active.forEach((address) => {
      const resolvedScore = resolvedScores.get(address);
      if (resolvedScore) {
        platform.renderScoreBadge(address, resolvedScore);
        if (!hasRenderedBadge(address)) {
          scheduleRenderRetry(address);
        }
      }
    });

    // Separate addresses that need fetching from those already resolved/pending
    const needsFetch = active.filter((address) => !resolvedScores.has(address) && !pending.has(address));

    if (needsFetch.length === 0) {
      return;
    }

    // Single address (detail page) — use individual GET
    if (needsFetch.length === 1) {
      fetchAndRender(needsFetch[0]);
      return;
    }

    // Multiple addresses (list view) — use batch if paid tier, individual for free
    if (currentTier === 'rescue_pass' || currentTier === 'pro') {
      // Show loading badges for all
      needsFetch.forEach((address) => {
        pending.add(address);
        platform.renderLoadingBadge(address);
      });

      sendRuntimeMessage(
        { type: 'ANALYZE_TOKEN_LIST', payload: { addresses: needsFetch } },
        (response) => {
          needsFetch.forEach((address) => pending.delete(address));

          const responseData = response?.data as Record<string, unknown> | undefined
          if (response?.success && responseData?.scores) {
            const scores = responseData.scores as import('../shared/types').TokenScore[];

            for (const score of scores) {
              if (score.score != null && score.risk && score.address) {
                resolvedScores.set(score.address, score);
                clearRetry(score.address);
                platform.renderScoreBadge(score.address, score);
                if (!hasRenderedBadge(score.address)) {
                  scheduleRenderRetry(score.address);
                }
              } else {
                platform.renderErrorBadge(score.address);
              }
            }
          } else {
            // Batch failed — fall back to individual fetches
            needsFetch.forEach((address) => fetchAndRender(address));
          }
        },
      );
    } else {
      // Free tier — individual fetches (batch not available)
      needsFetch.forEach((address) => fetchAndRender(address));
    }
  }

  let badgeVerifyTimer: ReturnType<typeof setInterval> | null = null;

  function handleUrlChange(): void {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) {
      return;
    }

    lastUrl = currentUrl;

    // Clear resolved scores so stale badges don't persist across navigations
    for (const address of resolvedScores.keys()) {
      clearAddressState(address);
    }

    // Stop any previous badge verification loop
    if (badgeVerifyTimer) {
      clearInterval(badgeVerifyTimer);
      badgeVerifyTimer = null;
    }

    scanAll();

    // React/Next.js re-renders the entire page after SPA navigation (3-5s).
    // We must keep re-inserting the badge until React settles.
    // Retry at increasing intervals, then verify periodically.
    setTimeout(scanAll, 200);
    setTimeout(scanAll, 600);
    setTimeout(scanAll, 1500);
    setTimeout(scanAll, 3000);
    setTimeout(scanAll, 5000);

    // After initial retries, verify every 2s for 30s that badge still exists
    let verifyCount = 0;
    badgeVerifyTimer = setInterval(() => {
      verifyCount++;
      if (verifyCount > 15) {
        if (badgeVerifyTimer) clearInterval(badgeVerifyTimer);
        badgeVerifyTimer = null;
        return;
      }
      const addr = platform.getCurrentPageAddress();
      if (addr && !hasRenderedBadge(addr)) {
        scanAll();
      }
    }, 2000);
  }

  platform.observeDOMChanges(scanAll);

  // Listen for messages from the background script
  withSafeRuntime(() => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PING') {
        sendResponse({ pong: true });
        return;
      }
      if (message?.type === 'TAB_URL_CHANGED') {
        handleUrlChange();
        setTimeout(handleUrlChange, 200);
        setTimeout(handleUrlChange, 800);
      }
    });
  });

  withSafeRuntime(() => {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[PROFILE_STORAGE_KEY]) {
        if (areaName !== 'local' || !changes[SELECTED_TOKEN_STORAGE_KEY]) {
          return;
        }

        const selectedToken = changes[SELECTED_TOKEN_STORAGE_KEY].newValue as SelectedToken | undefined;
        if (!applySelectedTokenScore(selectedToken)) {
          return;
        }
        return;
      }

      updateTierFromProfile(changes[PROFILE_STORAGE_KEY].newValue);
      scanAll();
    });
  });
  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('hashchange', handleUrlChange);
  window.addEventListener('focus', scanAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scanAll();
    }
  });

  // Intercept SPA navigation (pushState/replaceState do not fire popstate)
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = (...args) => {
    originalPushState(...args);
    setTimeout(handleUrlChange, 0);
  };
  history.replaceState = (...args) => {
    originalReplaceState(...args);
    setTimeout(handleUrlChange, 0);
  };

  // Fallback: poll for URL changes every 500ms.
  // Catches SPA frameworks that save a reference to pushState before our
  // content script runs, or that use the Navigation API.
  setInterval(handleUrlChange, 500);

  // Detect link clicks that may trigger navigation — schedule scans after click
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest?.('a[href]');
    if (!link) return;
    setTimeout(handleUrlChange, 50);
    setTimeout(handleUrlChange, 200);
    setTimeout(handleUrlChange, 600);
    setTimeout(handleUrlChange, 1200);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAll();
      loadUserTier();
    }, { once: true });
  } else {
    scanAll();
    loadUserTier();
  }
}
