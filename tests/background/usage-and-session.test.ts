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

    expect(storageMock.hourly_usage_state).toBeUndefined();
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
        json: async () => ({ subscription: { status: 'active', product_name: 'BarryGuard Rescue Pass' } }),
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
