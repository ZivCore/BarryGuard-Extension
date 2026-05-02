// tests/shared/api-client.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BarryGuardApiClient, REQUEST_TIMEOUT_MS } from '../../src/shared/api-client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Headers(),
    json: async () => ({ message: `HTTP ${status}` }),
  });
}

describe('BarryGuardApiClient', () => {
  let client: BarryGuardApiClient;

  beforeEach(() => {
    client = new BarryGuardApiClient();
    mockFetch.mockReset();
  });

  it('sends GET request to /token/:address with chain and extension source', async () => {
    mockOk({ score: 80, risk: 'low' });
    await client.getTokenScore('abc123');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/token\/solana\/abc123\?/);
    expect(url).toContain('source=content_script');
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('passes telemetry session id on single-token score requests', async () => {
    mockOk({ score: 80, risk: 'low' });
    await client.getTokenScore('abc123', 'solana', 'sess-1');

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('sessionId=sess-1');
  });

  it('posts pair resolution through BarryGuard API with session id', async () => {
    mockOk({ results: [] });
    await client.resolveDexPairs(['pair-1'], 'solana', 'sess-pair');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://barryguard.com/api/resolve/pair',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({
          provider: 'dexscreener',
          chain: 'solana',
          pairs: ['pair-1'],
          sessionId: 'sess-pair',
        }),
      }),
    );
  });

  it('includes telemetrySessionIds on analyze-list requests', async () => {
    mockOk({ scores: [] });
    await client.analyzeTokenList(['addr-1', 'addr-2'], 'solana', false, {
      'addr-1': 'sess-a',
      'addr-2': 'sess-b',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://barryguard.com/api/analyze-list',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({
          addresses: ['addr-1', 'addr-2'],
          chain: 'solana',
          force: false,
          mode: 'light',
          source: 'content_script',
          telemetrySessionIds: {
            'addr-1': 'sess-a',
            'addr-2': 'sess-b',
          },
        }),
      }),
    );
  });

  it('returns success:true on 200 response', async () => {
    mockOk({ score: 80 });
    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ score: 80 });
  });

  it('returns success:false on non-200 response', async () => {
    mockError(500);
    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(false);
    expect(res.error).toBe('HTTP 500');
  });

  it('returns a normal 404 response for token cache misses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: async () => ({ message: 'Token cache miss' }),
    });

    const res = await client.getTokenScore('abc');

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.error).toBe('Token cache miss');
    expect(res.errorType).toBeUndefined();
  });

  it('includes Authorization header when token is set', async () => {
    client.setAuthToken({ access_token: 'mytoken123' });
    mockOk({});
    await client.getUserTier();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mytoken123' }),
      })
    );
  });

  it('stores auth token after successful login', async () => {
    mockOk({ token: { access_token: 'tok' }, user: { email: 'a@b.com', tier: 'free' } });
    await client.login('a@b.com', 'pass');
    expect(client.getAuthToken()?.access_token).toBe('tok');
  });

  it('sends magic link requests to the backend auth endpoint', async () => {
    mockOk({ message: 'Magic link sent.' });
    const res = await client.sendMagicLink('a@b.com');
    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://barryguard.com/api/auth/magic-link',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com' }),
      }),
    );
  });

  it('clears auth token after logout', async () => {
    client.setAuthToken({ access_token: 'tok' });
    mockOk({});
    await client.logout();
    expect(client.getAuthToken()).toBeNull();
  });

  it('includes errorCode from error body when ANON_DAILY_LIMIT is present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(),
      json: async () => ({
        message: 'Daily limit reached',
        code: 'ANON_DAILY_LIMIT',
        limit: 10,
        retryAfter: 'tomorrow',
      }),
    });
    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.errorCode).toBe('ANON_DAILY_LIMIT');
  });

  it('passes through suspicious-bot error types from the API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(),
      json: async () => ({
        error: 'Suspicious bot detected',
        errorType: 'SUSPICIOUS_BOT',
      }),
    });

    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.errorType).toBe('SUSPICIOUS_BOT');
  });

  it.each([
    [503, 'Analysis service is busy. Please retry shortly.'],
    [504, 'Analysis service timed out. Please retry shortly.'],
  ])('keeps %s as a visible temporary service error', async (status, message) => {
    mockError(status);

    const res = await client.getTokenScore('abc');

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(status);
    expect(res.error).toBe(message);
  });

  it('exports the HTTP timeout contract used by popup timeout budgeting', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(12000);
  });

  it('does not set errorCode when error body has no code field', async () => {
    mockError(500);
    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(false);
    expect(res.errorCode).toBeUndefined();
  });

  describe('refreshToken', () => {
    it('returns error if no refresh_token is stored', async () => {
      client.setAuthToken({ access_token: 'old' }); // no refresh_token
      const res = await client.refreshToken();
      expect(res.success).toBe(false);
      expect(res.error).toBe('No refresh token');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('updates authToken on successful refresh', async () => {
      client.setAuthToken({ access_token: 'old', refresh_token: 'ref123' });
      mockOk({ access_token: 'new_access', refresh_token: 'new_refresh' });
      const res = await client.refreshToken();
      expect(res.success).toBe(true);
      expect(client.getAuthToken()?.access_token).toBe('new_access');
    });

    it('leaves existing token intact when refresh fails', async () => {
      client.setAuthToken({ access_token: 'old', refresh_token: 'ref123' });
      mockError(401);
      const res = await client.refreshToken();
      expect(res.success).toBe(false);
      // Token should remain unchanged after failed refresh
      expect(client.getAuthToken()?.access_token).toBe('old');
    });
  });
});
