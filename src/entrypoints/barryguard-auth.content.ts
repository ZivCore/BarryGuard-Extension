import { defineContentScript } from 'wxt/utils/define-content-script';
import { getApiBaseUrl } from '@/shared/runtime-config';

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

      // Content script runs in the page origin — it CAN send cookies.
      // Fetch the session token here and pass it to the background worker.
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/auth/session`, {
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
        if (data?.valid && data?.token?.access_token) {
          chrome.runtime
            .sendMessage({
              type: 'WEBSITE_SESSION_DETECTED',
              payload: {
                token: data.token,
                profile: data,
              },
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

    // Check immediately on page load
    void checkAuth();

    // Re-check periodically (catches login/logout while the page is open)
    setInterval(() => void checkAuth(), 10_000);
  },
});
