import { PumpFunPlatform } from '../platforms/pumpfun';
import type { IPlatform } from '../platforms/platform.interface';
import type { TierLevel, TokenMetadata, TokenScore } from '../shared/types';

type SupportedPlatform = 'pumpfun';

const PLATFORMS: Record<SupportedPlatform, IPlatform> = {
  pumpfun: new PumpFunPlatform(),
};

const PLATFORM_HOSTS: Record<SupportedPlatform, string[]> = {
  pumpfun: ['pump.fun'],
};
const CURRENT_ADDRESS_PATTERN = /^\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})$/;
const PROFILE_STORAGE_KEY = 'user_profile';

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
  callback: (response: any) => void,
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
  score: TokenScore;
  metadata: TokenMetadata;
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
  const host = window.location.hostname;
  for (const [key, patterns] of Object.entries(PLATFORM_HOSTS) as [SupportedPlatform, string[]][]) {
    if (patterns.some((pattern) => host.includes(pattern))) {
      return PLATFORMS[key];
    }
  }

  return null;
}

export function getCurrentPageAddress(pathname: string): string | null {
  const match = pathname.match(CURRENT_ADDRESS_PATTERN);
  return match?.[1] ?? null;
}

export function selectAddressesForTier(addresses: string[], pathname: string, tier: TierLevel): string[] {
  if (tier !== 'free') {
    return addresses;
  }

  const currentAddress = getCurrentPageAddress(pathname);
  if (!currentAddress) {
    return [];
  }

  return addresses.filter((address) => address === currentAddress);
}

export function initializeContentScript(): void {
  const detectedPlatform = detectPlatform();
  if (!detectedPlatform) {
    console.log('[BarryGuard] No supported platform detected');
    return;
  }

  const platform = detectedPlatform;
  console.log(`[BarryGuard] Platform: ${platform.name}`);
  const pending = new Set<string>();
  let lastUrl = window.location.href;
  let currentTier: TierLevel = 'free';

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

  function fetchAndRender(address: string): void {
    if (pending.has(address)) {
      return;
    }

    pending.add(address);
    (platform as PumpFunPlatform).renderLoadingBadge(address);

    sendRuntimeMessage({ type: 'GET_TOKEN_SCORE', payload: address }, (response) => {
      pending.delete(address);
      if (response?.success && response.data) {
        const score = response.data as TokenScore;
        platform.renderScoreBadge(address, score);

        if ((platform as PumpFunPlatform).isCurrentTokenPage(address)) {
          const selectedToken = (platform as PumpFunPlatform).buildSelectedToken(address, score);
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

      (platform as PumpFunPlatform).renderErrorBadge(address);
    });
  }

  function syncVisibleBadges(addresses: string[]): void {
    const visible = new Set(addresses);
    document.querySelectorAll<HTMLElement>('[data-barryguard-badge]').forEach((badge) => {
      const address = badge.dataset.barryguardBadge;
      if (!address || visible.has(address)) {
        return;
      }

      badge.remove();
    });
  }

  function scanAll(): void {
    const addresses = selectAddressesForTier(
      platform.extractTokenAddresses(),
      window.location.pathname,
      currentTier,
    );

    syncVisibleBadges(addresses);
    addresses.forEach(fetchAndRender);
  }

  function handleUrlChange(): void {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) {
      return;
    }

    lastUrl = currentUrl;
    scanAll();
  }

  platform.observeDOMChanges(scanAll);
  withSafeRuntime(() => {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[PROFILE_STORAGE_KEY]) {
        return;
      }

      updateTierFromProfile(changes[PROFILE_STORAGE_KEY].newValue);
      scanAll();
    });
  });
  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('hashchange', handleUrlChange);

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
