import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock: Record<string, unknown> = {};
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: storageMock[key] })),
      set: vi.fn(async (values: Record<string, unknown>) => {
        Object.assign(storageMock, values);
      }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((entry) => delete storageMock[entry]);
      }),
    },
    session: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
  },
  action: { setIcon: vi.fn(async () => {}) },
  runtime: {
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    id: 'test-ext-id',
  },
});

const {
  _getCooldownSecondsForTest: getCooldownSeconds,
  _incrementHourlyUsageForTest: incrementHourlyUsage,
  _refreshProfileStateIfNeededForTest: refreshProfileStateIfNeeded,
  _syncHourlyUsageStateForTest: syncHourlyUsageState,
  _getTokenScoreForTest: getTokenScore,
  _isUnauthorizedResponseForTest: isUnauthorizedResponse,
} = await import('../../src/background/index');

describe('background guest protection', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
    mockFetch.mockReset();
  });

  it('applies the free cooldown to anonymous users', () => {
    expect(getCooldownSeconds(null)).toBe(10);
  });

  it('tracks anonymous hourly usage in storage', async () => {
    await syncHourlyUsageState(null);
    await incrementHourlyUsage(null, 1);

    const state = storageMock.hourly_usage_state as { used: number; audience: string } | undefined;
    expect(state).toBeDefined();
    expect(state?.used).toBe(1);
    expect(state?.audience).toBe('anonymous');
  });
});

describe('background session invalidation', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
    mockFetch.mockReset();
  });

  it('only invalidates sessions for explicit unauthorized responses', () => {
    expect(isUnauthorizedResponse({ success: false, statusCode: 401 })).toBe(true);
    expect(isUnauthorizedResponse({ success: false, statusCode: 500 })).toBe(false);
    expect(isUnauthorizedResponse({ success: false, errorType: 'network' })).toBe(false);
  });

  it('hydrates the extension profile from a cookie-backed website session', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'user_1', email: 'paid@barryguard.com' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tier: 'rescue_pass', subscription: { status: 'active', product_name: 'BarryGuard Rescue Pass' } }),
      });

    const profile = await refreshProfileStateIfNeeded(true);

    expect(profile?.email).toBe('paid@barryguard.com');
    expect(profile?.tier).toBe('rescue_pass');
    expect(storageMock.user_profile).toMatchObject({
      email: 'paid@barryguard.com',
      tier: 'rescue_pass',
    });
  });

  it('clears stale local profile data when the backend reports no active session', async () => {
    storageMock.user_profile = {
      id: 'user_1',
      email: 'paid@barryguard.com',
      tier: 'pro',
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    const profile = await refreshProfileStateIfNeeded(true);

    expect(profile).toBeNull();
    expect(storageMock.user_profile).toBeUndefined();
  });
});

describe('background token score lookup', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
    mockFetch.mockReset();
  });

  it('treats token cache 404 as a miss and falls through to fresh analysis', async () => {
    const address = 'So11111111111111111111111111111111111111112';
    const freshScore = {
      address,
      chain: 'solana',
      score: 88,
      risk: 'low',
      checks: {},
      reasons: [],
      analyzedAt: '2026-05-02T12:00:00.000Z',
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Token not found in cache', code: 'NOT_FOUND' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => freshScore,
      });

    const result = await getTokenScore(address, 'solana');

    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      success: true,
      data: { address, cached: false },
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(String(mockFetch.mock.calls[1][0])).toContain(`/token/solana/${address}`);
    expect(String(mockFetch.mock.calls[2][0])).toContain('/analyze');
  });
});
