// src/shared/api-client.ts
import type { ApiErrorType, ApiResponse, AuthToken, TokenScore, UserProfile, WatchlistAlert, WatchlistStatus } from './types';
import { getApiBaseUrl } from './runtime-config';

export const REQUEST_TIMEOUT_MS = 12000;

export class BarryGuardApiClient {
  private authToken: AuthToken | null = null;

  setAuthToken(token: AuthToken): void {
    this.authToken = token;
  }

  getAuthToken(): AuthToken | null {
    return this.authToken;
  }

  clearAuthToken(): void {
    this.authToken = null;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const baseUrl = getApiBaseUrl();
    const extensionVersion = (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.()?.version) ?? '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extensionVersion ? { 'X-Extension-Version': extensionVersion } : {}),
      ...(options.headers as Record<string, string>),
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken.access_token}`;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        credentials: 'include',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = null;
      if (res.ok) {
        const data = await res.json() as T;
        return data === null
          ? { success: true, statusCode: res.status }
          : { success: true, data, statusCode: res.status };
      }

      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as {
        error?: string;
        message?: string;
        code?: string;
        errorCode?: string;
        errorType?: string;
        details?: string;
        retryAfterSeconds?: number;
        limit?: number;
        used?: number;
        remaining?: number;
      };
      const errorCode = err.code ?? err.errorCode;
      const errorType = err.errorType as ApiErrorType | undefined;
      const details = typeof err.details === 'string' && err.details.trim() ? err.details : undefined;
      const limit = typeof err.limit === 'number' && Number.isFinite(err.limit) ? err.limit : undefined;
      const used = typeof err.used === 'number' && Number.isFinite(err.used) ? err.used : undefined;
      const remaining = typeof err.remaining === 'number' && Number.isFinite(err.remaining) ? err.remaining : undefined;
      let retryAfterSeconds = typeof err.retryAfterSeconds === 'number' && Number.isFinite(err.retryAfterSeconds)
        ? err.retryAfterSeconds
        : undefined;

      // L-6: Extract Retry-After header for 429 responses
      if (res.status === 429 && retryAfterSeconds === undefined) {
        const retryAfterHeader = res.headers.get('Retry-After');
        if (retryAfterHeader) {
          const parsed = Number(retryAfterHeader);
          if (Number.isFinite(parsed) && parsed > 0) {
            retryAfterSeconds = parsed;
          }
        }
      }

      // L-7: Map 502/503 to specific error messages
      let errorMessage = err.error ?? err.message ?? `HTTP ${res.status}`;
      if (res.status === 502) {
        errorMessage = 'Blockchain data temporarily unavailable. Try again in a moment.';
      } else if (res.status === 503) {
        errorMessage = 'Analysis service is busy. Please retry shortly.';
      } else if (res.status === 504) {
        errorMessage = 'Analysis service timed out. Please retry shortly.';
      }

      return {
        success: false,
        error: errorMessage,
        statusCode: res.status,
        ...(errorCode ? { errorCode } : {}),
        ...(errorType ? { errorType } : {}),
        ...(details ? { details } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(used !== undefined ? { used } : {}),
        ...(remaining !== undefined ? { remaining } : {}),
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please try again.',
          errorType: 'network',
        };
      }
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Network error',
        errorType: 'network',
      };
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  analyzeToken(address: string, chain = 'solana', sessionId?: string): Promise<ApiResponse<TokenScore>> {
    return this.request<TokenScore>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ address, chain, mode: 'full', source: 'content_script', ...(sessionId ? { sessionId } : {}) }),
    });
  }

  getTokenScore(address: string, chain = 'solana', sessionId?: string): Promise<ApiResponse<TokenScore>> {
    const params = new URLSearchParams({ source: 'content_script' });
    if (sessionId) {
      params.set('sessionId', sessionId);
    }
    return this.request<TokenScore>(`/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}?${params.toString()}`);
  }

  resolveDexPairs(pairs: string[], chain = 'solana', sessionId?: string): Promise<ApiResponse<{ results: Array<{ pairAddress: string; tokenAddress: string }> }>> {
    return this.request<{ results: Array<{ pairAddress: string; tokenAddress: string }> }>('/resolve/pair', {
      method: 'POST',
      body: JSON.stringify({ provider: 'dexscreener', chain, pairs, ...(sessionId ? { sessionId } : {}) }),
    });
  }

  analyzeTokenList(addresses: string[], chain = 'solana', force = false, telemetrySessionIds?: Record<string, string>): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('/analyze-list', {
      method: 'POST',
      body: JSON.stringify({
        addresses,
        chain,
        force,
        mode: 'light',
        source: 'content_script',
        ...(telemetrySessionIds && Object.keys(telemetrySessionIds).length > 0 ? { telemetrySessionIds } : {}),
      }),
    });
  }

  getUserTier(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('/user/tier');
  }

  async login(email: string, password: string): Promise<ApiResponse<{ token: AuthToken; user: UserProfile }>> {
    const res = await this.request<{ token: AuthToken; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success && res.data) this.authToken = res.data.token;
    return res;
  }

  async register(email: string, password: string): Promise<ApiResponse<{ token: AuthToken; user: UserProfile }>> {
    const res = await this.request<{ token: AuthToken; user: UserProfile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success && res.data) this.authToken = res.data.token;
    return res;
  }

  sendMagicLink(email: string): Promise<ApiResponse<{ message?: string }>> {
    return this.request<{ message?: string }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  oauthLogin(provider: string): Promise<ApiResponse<{ url: string }>> {
    return this.request<{ url: string }>(`/auth/oauth/${provider}`, { method: 'POST' });
  }

  async logout(): Promise<ApiResponse<void>> {
    const res = await this.request<void>('/auth/logout', { method: 'POST' });
    this.authToken = null;
    return res;
  }

  async validateSession(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('/auth/session', { method: 'POST' });
  }

  async refreshToken(): Promise<ApiResponse<AuthToken>> {
    if (!this.authToken?.refresh_token) return { success: false, error: 'No refresh token' };
    const res = await this.request<AuthToken>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: this.authToken.refresh_token }),
    });
    if (res.success && res.data) this.authToken = res.data;
    return res;
  }

  refreshTokenScore(address: string, chain = 'solana'): Promise<ApiResponse<TokenScore>> {
    return this.request<TokenScore>(`/token/${encodeURIComponent(address)}/refresh`, {
      method: 'POST',
      headers: { 'X-Chain': chain },
    });
  }

  getWatchlistStatus(address: string, chain = 'solana'): Promise<ApiResponse<WatchlistStatus>> {
    return this.request<WatchlistStatus>(`/watchlist/${encodeURIComponent(address)}?chain=${encodeURIComponent(chain)}`);
  }

  addToWatchlist(address: string, chain = 'solana'): Promise<ApiResponse<{ success: boolean; entry: WatchlistStatus['entry'] }>> {
    return this.request<{ success: boolean; entry: WatchlistStatus['entry'] }>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ address, chain }),
    });
  }

  removeFromWatchlist(address: string, chain = 'solana'): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(`/watchlist/${encodeURIComponent(address)}?chain=${encodeURIComponent(chain)}`, {
      method: 'DELETE',
    });
  }

  getWatchlistAlerts(): Promise<ApiResponse<{ alerts: WatchlistAlert[]; unreadAlerts: number; hasAccess: boolean }>> {
    return this.request<{ alerts: WatchlistAlert[]; unreadAlerts: number; hasAccess: boolean }>('/watchlist/alerts');
  }

  markWatchlistAlertRead(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(`/watchlist/alerts/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  }
}
