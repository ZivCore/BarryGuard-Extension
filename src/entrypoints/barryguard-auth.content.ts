import { defineContentScript } from 'wxt/utils/define-content-script';
import { buildWebsiteSessionPayload } from '../shared/website-session';

export default defineContentScript({
  matches: [
    '*://barryguard.com/*',
    '*://www.barryguard.com/*',
    'http://localhost/*',
    'http://localhost:3000/*',
  ],
  runAt: 'document_end',
  main() {
    let lastAuthState: boolean | null = null;

    async function fetchAndDeliverSession(): Promise<void> {
      try {
        const res = await fetch(`${window.location.origin}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!res.ok) {
          chrome.runtime
            .sendMessage({ type: 'WEBSITE_SESSION_DETECTED' })
            .catch(() => {});
          return;
        }

        const data = await res.json();
        const payload = buildWebsiteSessionPayload(data);
        if (payload) {
          chrome.runtime
            .sendMessage({
              type: 'WEBSITE_SESSION_DETECTED',
              payload,
            })
            .catch(() => {});
        } else {
          chrome.runtime
            .sendMessage({ type: 'WEBSITE_SESSION_DETECTED' })
            .catch(() => {});
        }
      } catch {
        chrome.runtime
          .sendMessage({ type: 'WEBSITE_SESSION_DETECTED' })
          .catch(() => {});
      }
    }

    async function checkAuth(): Promise<void> {
      const hasAuth = document.cookie
        .split(';')
        .some((c) => c.trim().startsWith('sb-'));

      if (hasAuth === lastAuthState) return;
      lastAuthState = hasAuth;

      if (!hasAuth) {
        chrome.runtime
          .sendMessage({ type: 'WEBSITE_SESSION_LOST' })
          .catch(() => {});
        return;
      }

      await fetchAndDeliverSession();
    }

    // Check immediately on page load
    void checkAuth();

    // Re-check login/logout state every 10s
    setInterval(() => void checkAuth(), 10_000);

    // Periodically deliver fresh session data (incl. hourlyAnalysesUsed)
    // even when login state hasn't changed, so the background gets
    // up-to-date usage counters from the backend.
    setInterval(() => {
      if (lastAuthState) {
        void fetchAndDeliverSession();
      }
    }, 60_000);
  },
});
