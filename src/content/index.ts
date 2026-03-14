import { PumpFunPlatform } from '../platforms/pumpfun';
import type { IPlatform } from '../platforms/platform.interface';
import type { TokenScore } from '../shared/types';

type SupportedPlatform = 'pumpfun';

const PLATFORMS: Record<SupportedPlatform, IPlatform> = {
  pumpfun: new PumpFunPlatform(),
};

const PLATFORM_HOSTS: Record<SupportedPlatform, string[]> = {
  pumpfun: ['pump.fun'],
};

function detectPlatform(): IPlatform | null {
  const host = window.location.hostname;
  for (const [key, patterns] of Object.entries(PLATFORM_HOSTS) as [SupportedPlatform, string[]][]) {
    if (patterns.some((pattern) => host.includes(pattern))) {
      return PLATFORMS[key];
    }
  }

  return null;
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

  function fetchAndRender(address: string): void {
    if (pending.has(address)) {
      return;
    }

    pending.add(address);
    (platform as PumpFunPlatform).renderLoadingBadge(address);

    chrome.runtime.sendMessage({ type: 'GET_TOKEN_SCORE', payload: address }, (response) => {
      pending.delete(address);
      if (response?.success && response.data) {
        const score = response.data as TokenScore;
        platform.renderScoreBadge(address, score);

        if ((platform as PumpFunPlatform).isCurrentTokenPage(address)) {
          void chrome.storage.local.set({
            selectedToken: (platform as PumpFunPlatform).buildSelectedToken(address, score),
          });
        }

        return;
      }

      (platform as PumpFunPlatform).renderErrorBadge(address);
    });
  }

  function scanAll(): void {
    platform.extractTokenAddresses().forEach(fetchAndRender);
  }

  function handleUrlChange(): void {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) {
      return;
    }

    lastUrl = currentUrl;
    scanAll();
  }

  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<History['pushState']>) => {
    originalPushState(...args);
    handleUrlChange();
  }) as History['pushState'];

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    originalReplaceState(...args);
    handleUrlChange();
  }) as History['replaceState'];

  platform.observeDOMChanges(scanAll);
  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('hashchange', handleUrlChange);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll, { once: true });
  } else {
    scanAll();
  }
}
