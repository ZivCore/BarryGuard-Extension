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

  platform.observeDOMChanges(scanAll);
  window.addEventListener('popstate', scanAll);
  window.addEventListener('hashchange', scanAll);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll, { once: true });
  } else {
    scanAll();
  }
}
