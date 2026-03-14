import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock: Record<string, unknown> = {};

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
  _syncHourlyUsageStateForTest: syncHourlyUsageState,
  _isUnauthorizedResponseForTest: isUnauthorizedResponse,
} = await import('../../src/background/index');

describe('background guest protection', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
  });

  it('applies the free cooldown to anonymous users', () => {
    expect(getCooldownSeconds(null)).toBe(10);
  });

  it('tracks anonymous hourly usage in storage', async () => {
    await syncHourlyUsageState(null);
    await incrementHourlyUsage(null, 1);

    expect(storageMock.hourly_usage_state).toMatchObject({
      audience: 'anonymous',
      tier: 'free',
      limit: 10,
      used: 1,
    });
  });
});

describe('background session invalidation', () => {
  it('only invalidates sessions for explicit unauthorized responses', () => {
    expect(isUnauthorizedResponse({ success: false, statusCode: 401 })).toBe(true);
    expect(isUnauthorizedResponse({ success: false, statusCode: 500 })).toBe(false);
    expect(isUnauthorizedResponse({ success: false, errorType: 'network' })).toBe(false);
  });
});
