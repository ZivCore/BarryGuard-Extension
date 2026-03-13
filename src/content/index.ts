/**
 * Content Script for Pump.fun
 * Detects tokens and renders score badges
 */

import { PumpFunPlatform } from '../platforms/pumpfun';

const platform = new PumpFunPlatform();

// Initial scan
function scanTokens() {
  const addresses = platform.extractTokenAddresses();
  console.log(`[BarryGuard] Found ${addresses.length} tokens`);

  // TODO: Send to background for analysis
  // TODO: Render badges when results arrive
}

// Observe DOM changes
platform.observeDOMChanges(scanTokens);

// Run initial scan when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanTokens);
} else {
  scanTokens();
}

console.log('[BarryGuard] Content script loaded on Pump.fun');
