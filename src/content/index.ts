// src/content/index.ts
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
    if (patterns.some(p => host.includes(p))) return PLATFORMS[key];
  }
  return null;
}

const platform = detectPlatform();
if (!platform) {
  console.log('[BarryGuard] No supported platform detected');
} else {
  console.log(`[BarryGuard] Platform: ${platform.name}`);

  const pending = new Set<string>();

  async function fetchAndRender(address: string): Promise<void> {
    if (pending.has(address)) return;
    pending.add(address);

    (platform as PumpFunPlatform).renderLoadingBadge(address);

    chrome.runtime.sendMessage({ type: 'GET_TOKEN_SCORE', payload: address }, (res) => {
      pending.delete(address);
      if (res?.success && res.data) {
        platform!.renderScoreBadge(address, res.data as TokenScore);
      } else {
        (platform as PumpFunPlatform).renderErrorBadge(address);
      }
    });
  }

  function scanAll(): void {
    platform!.extractTokenAddresses().forEach(fetchAndRender);
  }

  platform.observeDOMChanges(scanAll);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll);
  } else {
    scanAll();
  }
}
