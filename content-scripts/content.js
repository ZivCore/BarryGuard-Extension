// src/content/index.ts
import { PumpFunPlatform } from '../platforms/pumpfun';
const PLATFORMS = {
    pumpfun: new PumpFunPlatform(),
};
const PLATFORM_HOSTS = {
    pumpfun: ['pump.fun'],
};
function detectPlatform() {
    const host = window.location.hostname;
    for (const [key, patterns] of Object.entries(PLATFORM_HOSTS)) {
        if (patterns.some(p => host.includes(p)))
            return PLATFORMS[key];
    }
    return null;
}
const platform = detectPlatform();
if (!platform) {
    console.log('[BarryGuard] No supported platform detected');
}
else {
    console.log(`[BarryGuard] Platform: ${platform.name}`);
    const pending = new Set();
    async function fetchAndRender(address) {
        if (pending.has(address))
            return;
        pending.add(address);
        platform.renderLoadingBadge(address);
        chrome.runtime.sendMessage({ type: 'GET_TOKEN_SCORE', payload: address }, (res) => {
            pending.delete(address);
            if (res?.success && res.data) {
                platform.renderScoreBadge(address, res.data);
            }
            else {
                platform.renderErrorBadge(address);
            }
        });
    }
    function scanAll() {
        platform.extractTokenAddresses().forEach(fetchAndRender);
    }
    platform.observeDOMChanges(scanAll);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanAll);
    }
    else {
        scanAll();
    }
}
//# sourceMappingURL=index.js.map