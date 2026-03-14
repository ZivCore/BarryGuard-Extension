// tests/shared/api-client.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BarryGuardApiClient } from '../../src/shared/api-client';

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
    json: async () => ({ message: `HTTP ${status}` }),
  });
}

describe('BarryGuardApiClient', () => {
  let client: BarryGuardApiClient;

  beforeEach(() => {
    client = new BarryGuardApiClient();
    mockFetch.mockReset();
  });

  it('sends GET request to /token/:address', async () => {
    mockOk({ score: 80, risk: 'low' });
    await client.getTokenScore('abc123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.barryguard.com/api/token/abc123?chain=solana',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Object),
      })
    );
  });

  it('returns success:true on 200 response', async () => {
    mockOk({ score: 80 });
    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ score: 80 });
  });

  it('returns success:false on non-200 response', async () => {
    mockError(429);
    const res = await client.getTokenScore('abc');
    expect(res.success).toBe(false);
    expect(res.error).toBe('HTTP 429');
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
      'https://www.barryguard.com/api/auth/magic-link',
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
