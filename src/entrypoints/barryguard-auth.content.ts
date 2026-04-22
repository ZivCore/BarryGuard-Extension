import { defineContentScript } from 'wxt/utils/define-content-script';
import { buildWebsiteSessionPayload } from '../shared/website-session';

// Production origin guard lives inside main() (see below). Module-level code
// must stay side-effect-free because WXT's `prepare` step imports this file in
// a Node/vite-node context where `window` is undefined.

/**
 * Verifies that the JWT issuer claim matches the expected Supabase project host.
 * Tokens without a valid `iss` claim pointing to the correct project are rejected.
 */
function isValidSupabaseToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload || typeof payload !== 'object') return false;
    const iss: unknown = payload.iss;
    if (typeof iss !== 'string') return false;
    // Accept any token issued by a Supabase project (*.supabase.co)
    const issHost = new URL(iss).hostname;
    return issHost.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export default defineContentScript({
  matches: [
    '*://barryguard.com/*',
    '*://www.barryguard.com/*',
    // Localhost entries are injected only in dev builds via wxt.config.ts
  ],
  runAt: 'document_end',
  main() {
    // Dev-only secondary guard inside main() body — belt-and-suspenders
    if (import.meta.env.MODE !== 'development') {
      const allowed = new Set(['barryguard.com', 'www.barryguard.com']);
      if (!allowed.has(window.location.hostname)) return;
    }

    let lastAuthState: boolean | null = null;

    async function fetchAndDeliverSession(): Promise<void> {
      try {
        const extensionVersion = chrome.runtime?.getManifest?.().version;
        const res = await fetch(`${window.location.origin}/api/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(extensionVersion ? { 'X-Extension-Version': extensionVersion } : {}),
          },
          credentials: 'include',
        });

        if (!res.ok) {
          chrome.runtime
            .sendMessage({ type: 'WEBSITE_SESSION_DETECTED' })
            .catch(() => {});
          return;
        }

        const data = await res.json();
        let payload = buildWebsiteSessionPayload(data);

        // JWT issuer check: reject tokens whose iss does not point to a valid Supabase project.
        // This prevents accepting tokens from untrusted issuers (e.g. localhost imposters).
        if (payload?.token && typeof (payload.token as Record<string, unknown>)?.access_token === 'string') {
          const accessToken = (payload.token as Record<string, unknown>).access_token as string;
          if (!isValidSupabaseToken(accessToken)) {
            payload = { profile: payload.profile }; // strip token but keep profile
          }
        }

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
