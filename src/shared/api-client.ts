// src/shared/api-client.ts
import type { ApiResponse, AuthToken, TokenScore, UserProfile } from './types';
import { getApiBaseUrl } from './runtime-config';

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

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        return { success: true, data: await res.json() as T, statusCode: res.status };
      }

      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as {
        error?: string;
        message?: string;
        code?: string;
        errorCode?: string;
      };
      const errorCode = err.code ?? err.errorCode;
      return {
        success: false,
        error: err.error ?? err.message ?? `HTTP ${res.status}`,
        statusCode: res.status,
        ...(errorCode ? { errorCode } : {}),
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Network error',
        errorType: 'network',
      };
    }
  }

  analyzeToken(address: string, chain = 'solana'): Promise<ApiResponse<TokenScore>> {
    return this.request<TokenScore>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ address, chain }),
    });
  }

  getTokenScore(address: string, chain = 'solana'): Promise<ApiResponse<TokenScore>> {
    return this.request<TokenScore>(`/token/${address}?chain=${chain}`);
  }

  analyzeTokenList(addresses: string[], chain = 'solana', force = false): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('/analyze-list', {
      method: 'POST',
      body: JSON.stringify({ addresses, chain, force }),
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
    return this.request<TokenScore>(`/token/${address}/refresh`, {
      method: 'POST',
      headers: { 'X-Chain': chain },
    });
  }
}
