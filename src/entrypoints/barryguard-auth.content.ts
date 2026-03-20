import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: [
    '*://barryguard.com/*',
    '*://www.barryguard.com/*',
  ],
  runAt: 'document_end',
  main() {
    let lastAuthState: boolean | null = null;

    function checkAuth(): void {
      const hasAuth = document.cookie
        .split(';')
        .some((c) => c.trim().startsWith('sb-'));

      if (hasAuth !== lastAuthState) {
        lastAuthState = hasAuth;
        chrome.runtime
          .sendMessage({
            type: hasAuth ? 'WEBSITE_SESSION_DETECTED' : 'WEBSITE_SESSION_LOST',
          })
          .catch(() => {
            // Extension context may not be ready — safe to ignore
          });
      }
    }

    // Check immediately on page load
    checkAuth();

    // Re-check periodically (catches login/logout while the page is open)
    setInterval(checkAuth, 10_000);
  },
});
