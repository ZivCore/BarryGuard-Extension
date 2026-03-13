/**
 * Background Service Worker
 * Handles API calls and caching
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    // TODO: Call BarryGuard API
    // TODO: Cache results
    // TODO: Send response back to content script

    sendResponse({ status: 'not_implemented' });
  }

  return true; // Keep message channel open for async response
});

console.log('[BarryGuard] Background service worker started');
