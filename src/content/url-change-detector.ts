/**
 * Passive URL-change detection for SPA navigation (E-M9).
 *
 * Replaces history.pushState / history.replaceState patching with a passive
 * MutationObserver on document.body (title/root changes signal navigation)
 * plus a popstate listener. The existing setInterval(handleUrlChange, 500)
 * fallback in content/index.ts remains as the final safety net.
 *
 * This approach avoids modifying the host page's History API prototype,
 * which is an unexpected side-effect and violates the Extension/Backend Boundary
 * spirit (ADR-007: extension = display + DOM + local cache only).
 */

/**
 * Registers passive URL-change observers and calls `callback` whenever the URL
 * appears to have changed. Does NOT patch any global APIs.
 *
 * The callback is debounced at 0ms (next microtask) to batch rapid mutations.
 *
 * @returns A cleanup function that disconnects the observer and removes listeners.
 */
export function watchUrlChanges(callback: () => void): () => void {
  let lastUrl = window.location.href;
  let scheduled = false;

  function maybeNotify(): void {
    const current = window.location.href;
    if (current === lastUrl) return;
    lastUrl = current;
    if (scheduled) return;
    scheduled = true;
    // Defer slightly so the DOM has time to settle after the navigation.
    setTimeout(() => {
      scheduled = false;
      callback();
    }, 0);
  }

  // popstate fires on browser back/forward and on pushState calls made AFTER
  // our script loads (when the framework didn't capture pushState before us).
  window.addEventListener('popstate', maybeNotify);

  // hashchange fires on hash-only navigations.
  window.addEventListener('hashchange', maybeNotify);

  // MutationObserver on document.documentElement detects DOM-level changes that
  // accompany SPA navigations (new route renders, title updates, root re-renders).
  // This catches frameworks that call pushState before our content script loaded.
  const observer = new MutationObserver(maybeNotify);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: false, // only top-level children (html > head/body)
    characterData: false,
    attributes: false,
  });

  return () => {
    window.removeEventListener('popstate', maybeNotify);
    window.removeEventListener('hashchange', maybeNotify);
    observer.disconnect();
  };
}
