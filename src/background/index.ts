import { BarryGuardApiClient } from '../shared/api-client';
import { TokenCache } from '../shared/cache';
import type { AuthToken, UserProfile, TierLevel } from '../shared/types';

const api = new BarryGuardApiClient();
const cache = new TokenCache();

const AUTH_KEY = 'auth_token';
const PROFILE_KEY = 'user_profile';
const RATE_WINDOW_MS = 1000;
const MAX_CALLS_PER_SECOND = 10;

const callTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const recent = callTimestamps.filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_CALLS_PER_SECOND) {
    await new Promise(r => setTimeout(r, 100));
    return waitForRateLimit();
  }
  callTimestamps.push(Date.now());
}

async function getStoredToken(): Promise<AuthToken | null> {
  const s = await chrome.storage.local.get(AUTH_KEY);
  return s[AUTH_KEY] ?? null;
}

async function getStoredProfile(): Promise<UserProfile | null> {
  const s = await chrome.storage.local.get(PROFILE_KEY);
  return s[PROFILE_KEY] ?? null;
}

async function initialize(): Promise<void> {
  await cache.init();
  const token = await getStoredToken();
  if (token) {
    api.setAuthToken(token);
    const res = await api.validateSession();
    if (res.success && res.data) {
      await chrome.storage.local.set({ [PROFILE_KEY]: res.data });
    } else {
      await chrome.storage.local.remove([AUTH_KEY, PROFILE_KEY]);
      api.clearAuthToken();
    }
  }
  console.log('[BarryGuard] Background worker initialized');
}

async function getTokenScore(address: string) {
  const profile = await getStoredProfile();
  const tier: TierLevel = (profile?.tier as TierLevel) ?? 'free';

  const cached = await cache.get(address, tier);
  if (cached) return { success: true, data: { ...cached, cached: true } };

  await waitForRateLimit();

  const cached2 = await api.getTokenScore(address);
  if (cached2.success && cached2.data) {
    await cache.set(address, cached2.data, tier);
    return { success: true, data: { ...cached2.data, cached: true } };
  }

  const fresh = await api.analyzeToken(address);
  if (fresh.success && fresh.data) {
    await cache.set(address, fresh.data, tier);
    return { success: true, data: { ...fresh.data, cached: false } };
  }

  return fresh;
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'GET_TOKEN_SCORE':   respond(await getTokenScore(msg.payload)); break;
        case 'ANALYZE_TOKEN':     respond(await getTokenScore(msg.payload)); break;
        case 'GET_USER_TIER': {
          const profile = await getStoredProfile();
          if (profile) { respond({ success: true, data: profile }); break; }
          const res = await api.getUserTier();
          if (res.success && res.data) await chrome.storage.local.set({ [PROFILE_KEY]: res.data });
          respond(res);
          break;
        }
        case 'LOGIN': {
          const res = await api.login(msg.payload.email, msg.payload.password);
          if (res.success && res.data) {
            await chrome.storage.local.set({ [AUTH_KEY]: res.data.token, [PROFILE_KEY]: res.data.user });
          }
          respond(res.success ? { success: true, data: res.data?.user } : res);
          break;
        }
        case 'REGISTER': {
          const res = await api.register(msg.payload.email, msg.payload.password);
          if (res.success && res.data) {
            await chrome.storage.local.set({ [AUTH_KEY]: res.data.token, [PROFILE_KEY]: res.data.user });
          }
          respond(res.success ? { success: true, data: res.data?.user } : res);
          break;
        }
        case 'OAUTH_LOGIN': {
          respond(await api.oauthLogin(msg.payload));
          break;
        }
        case 'LOGOUT': {
          await api.logout();
          await chrome.storage.local.remove([AUTH_KEY, PROFILE_KEY]);
          respond({ success: true });
          break;
        }
        default: respond({ success: false, error: 'Unknown message type' });
      }
    } catch (e) {
      respond({ success: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
initialize();
