import { BarryGuardApiClient } from '../shared/api-client';
import { TokenCache } from '../shared/cache';
import type { AuthToken, SelectedToken, TokenMetadata, UserProfile, TierLevel } from '../shared/types';

const api = new BarryGuardApiClient();
const cache = new TokenCache();

const AUTH_KEY = 'auth_token';
const PROFILE_KEY = 'user_profile';
const RATE_WINDOW_MS = 1000;
const MAX_CALLS_PER_SECOND = 10;

const callTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const recent = callTimestamps.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= MAX_CALLS_PER_SECOND) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return waitForRateLimit();
  }

  callTimestamps.push(Date.now());
}

async function getStoredToken(): Promise<AuthToken | null> {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  return stored[AUTH_KEY] ?? null;
}

async function getStoredProfile(): Promise<UserProfile | null> {
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  return stored[PROFILE_KEY] ?? null;
}

async function initialize(): Promise<void> {
  await cache.init();

  const token = await getStoredToken();
  if (token) {
    api.setAuthToken(token);
    const session = await api.validateSession();
    if (session.success && session.data) {
      await chrome.storage.local.set({ [PROFILE_KEY]: session.data });
    } else {
      await chrome.storage.local.remove([AUTH_KEY, PROFILE_KEY]);
      api.clearAuthToken();
    }
  }

  console.log('[BarryGuard] Background worker initialized');
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function getPumpFunMetadata(address: string): Promise<{ success: boolean; data?: TokenMetadata; error?: string }> {
  try {
    const response = await fetch(`https://pump.fun/coin/${address}`);
    if (!response.ok) {
      return { success: false, error: `Pump.fun metadata request failed with HTTP ${response.status}` };
    }

    const html = await response.text();
    const name = html.match(/<h1[^>]*>([^<]{1,120})<\/h1>/i)?.[1];
    const symbol = html.match(/<title>([A-Z0-9_]{2,20})\s+\$[^<]+<\/title>/i)?.[1];
    const imageUrl = html.match(new RegExp(`https://images\\.pump\\.fun/coin-image/${address}[^"'\\s<]+`, 'i'))?.[0];

    const metadata: TokenMetadata = {
      name: name ? decodeHtml(name.trim()) : undefined,
      symbol: symbol?.trim(),
      imageUrl,
    };

    if (!metadata.name && !metadata.symbol && !metadata.imageUrl) {
      return { success: false, error: 'No token metadata found on pump.fun.' };
    }

    return { success: true, data: metadata };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Pump.fun metadata lookup failed.',
    };
  }
}

async function getTokenScore(address: string) {
  const profile = await getStoredProfile();
  const tier: TierLevel = profile?.tier ?? 'free';

  const cached = await cache.get(address, tier);
  if (cached) {
    return { success: true, data: { ...cached, cached: true } };
  }

  await waitForRateLimit();

  const existing = await api.getTokenScore(address);
  if (existing.success && existing.data) {
    await cache.set(address, existing.data, tier);
    return { success: true, data: { ...existing.data, cached: true } };
  }

  const fresh = await api.analyzeToken(address);
  if (fresh.success && fresh.data) {
    await cache.set(address, fresh.data, tier);
    return { success: true, data: { ...fresh.data, cached: false } };
  }

  return fresh;
}

async function openPopupForToken(selectedToken: SelectedToken) {
  await chrome.storage.local.set({ selectedToken });

  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  }

  return { success: true };
}

export function initializeBackground(): void {
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    (async () => {
      try {
        switch (message.type) {
          case 'GET_TOKEN_SCORE':
            respond(await getTokenScore(message.payload));
            break;
          case 'ANALYZE_TOKEN':
            respond(await getTokenScore(message.payload));
            break;
          case 'GET_TOKEN_METADATA':
            respond(await getPumpFunMetadata(message.payload));
            break;
          case 'OPEN_POPUP_FOR_TOKEN':
            respond(await openPopupForToken(message.payload as SelectedToken));
            break;
          case 'GET_USER_TIER': {
            const profile = await getStoredProfile();
            if (profile) {
              respond({ success: true, data: profile });
              break;
            }

            const result = await api.getUserTier();
            if (result.success && result.data) {
              await chrome.storage.local.set({ [PROFILE_KEY]: result.data });
            }
            respond(result);
            break;
          }
          case 'LOGIN': {
            const result = await api.login(message.payload.email, message.payload.password);
            if (result.success && result.data) {
              await chrome.storage.local.set({
                [AUTH_KEY]: result.data.token,
                [PROFILE_KEY]: result.data.user,
              });
            }
            respond(result.success ? { success: true, data: result.data?.user } : result);
            break;
          }
          case 'REGISTER': {
            const result = await api.register(message.payload.email, message.payload.password);
            if (result.success && result.data) {
              await chrome.storage.local.set({
                [AUTH_KEY]: result.data.token,
                [PROFILE_KEY]: result.data.user,
              });
            }
            respond(result.success ? { success: true, data: result.data?.user } : result);
            break;
          }
          case 'OAUTH_LOGIN':
            respond(await api.oauthLogin(message.payload));
            break;
          case 'LOGOUT':
            await api.logout();
            await chrome.storage.local.remove([AUTH_KEY, PROFILE_KEY]);
            respond({ success: true });
            break;
          default:
            respond({ success: false, error: 'Unknown message type' });
        }
      } catch (error) {
        respond({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();

    return true;
  });

  chrome.runtime.onInstalled.addListener(() => {
    void initialize();
  });
  chrome.runtime.onStartup.addListener(() => {
    void initialize();
  });
  void initialize();
}
