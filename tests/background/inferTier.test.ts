// tests/background/inferTier.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock chrome APIs before importing background module
vi.stubGlobal('chrome', {
  storage: {
    local: {
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
  _inferTierForTest: inferTier,
  _normalizeProfileForTest: normalizeProfile,
  _mergeProfileWithFallbackForTest: mergeProfileWithFallback,
} =
  await import('../../src/background/index');

describe('inferTier', () => {
  it('returns free for empty record', () => {
    expect(inferTier({})).toBe('free');
  });

  it('reads explicit tier field', () => {
    expect(inferTier({ tier: 'pro' })).toBe('pro');
    expect(inferTier({ tier: 'rescue_pass' })).toBe('rescue_pass');
    expect(inferTier({ tier: 'free' })).toBe('free');
  });

  it('ignores plan field — only reads explicit tier', () => {
    expect(inferTier({ plan: 'rescue' })).toBe('free');
  });

  it('does NOT upgrade to rescue_pass based on generic status:active field', () => {
    expect(inferTier({ status: 'active' })).toBe('free');
  });

  it('does NOT upgrade based on subscriptionStatus fields', () => {
    expect(inferTier({ subscriptionStatus: 'active' })).toBe('free');
    expect(inferTier({ subscription_status: 'trialing' })).toBe('free');
  });

  it('does NOT upgrade from nested subscription.status', () => {
    expect(inferTier({
      email: 'paid@barryguard.com',
      subscription: {
        status: 'active',
      },
    })).toBe('free');
  });

  it('does NOT infer tier from nested subscription plan names', () => {
    expect(inferTier({
      subscription: {
        product_name: 'BarryGuard Rescue Pass',
      },
    })).toBe('free');
    expect(inferTier({
      subscription: {
        plan_name: 'BarryGuard Pro',
      },
    })).toBe('free');
  });

  it('does NOT upgrade from boolean subscription flags', () => {
    expect(inferTier({ hasSubscription: true })).toBe('free');
    expect(inferTier({ subscriptionActive: true })).toBe('free');
    expect(inferTier({ isPro: true })).toBe('free');
  });

  it('does NOT read tier from nested user object', () => {
    expect(inferTier({ user: { tier: 'pro' } })).toBe('free');
  });

  it('ignores deeply nested fields', () => {
    const deep = { data: { data: { data: { data: { subscriptionStatus: 'active' } } } } };
    expect(inferTier(deep)).toBe('free');
  });
});

describe('normalizeProfile', () => {
  it('always has a tier field', () => {
    const result = normalizeProfile({ email: 'a@b.com' });
    expect(['free', 'rescue_pass', 'pro']).toContain(result.tier);
  });

  it('sets tokenListAnalysis capability to false for free tier', () => {
    const result = normalizeProfile({ tier: 'free', email: 'a@b.com' });
    expect(result.capabilities?.tokenListAnalysis).toBe(false);
  });

  it('sets tokenListAnalysis capability to true for paid tier', () => {
    const result = normalizeProfile({ tier: 'rescue_pass', email: 'a@b.com' });
    expect(result.capabilities?.tokenListAnalysis).toBe(true);
  });

  it('drops untrusted customer portal URLs from normalized profiles', () => {
    const result = normalizeProfile({
      tier: 'pro',
      email: 'a@b.com',
      customerPortalUrl: 'https://evil.example/portal',
    });
    expect(result.customerPortalUrl).toBeUndefined();
  });

  it('preserves the stored paid tier when session data omits tier fields', () => {
    const result = mergeProfileWithFallback(
      { id: 'user_1', email: 'paid@barryguard.com' },
      normalizeProfile({
        id: 'user_1',
        email: 'paid@barryguard.com',
        tier: 'pro',
        capabilities: {
          singleTokenAnalysis: true,
          tokenListAnalysis: true,
        },
        listRequestLimit: 2000,
        singleTokenHourlyLimit: 2000,
      }),
    );

    expect(result.tier).toBe('pro');
    expect(result.capabilities?.tokenListAnalysis).toBe(true);
    expect(result.listRequestLimit).toBe(2000);
  });

  it('reads hourly usage values from backend profile fields', () => {
    const result = normalizeProfile({
      email: 'paid@barryguard.com',
      tier: 'pro',
      analyses_this_hour: 7,
      remaining_analyses_this_hour: 993,
      max_analyses_per_hour: 1000,
    });

    expect(result.hourlyAnalysesUsed).toBe(7);
    expect(result.hourlyAnalysesRemaining).toBe(993);
    expect(result.hourlyAnalysesLimit).toBe(1000);
  });

  it('reads hourly usage values from nested usage objects and derives the limit', () => {
    const result = normalizeProfile({
      email: 'paid@barryguard.com',
      tier: 'pro',
      usage: {
        used_in_last_hour: 7,
        analyses_remaining_this_hour: 993,
      },
    });

    expect(result.hourlyAnalysesUsed).toBe(7);
    expect(result.hourlyAnalysesRemaining).toBe(993);
    expect(result.hourlyAnalysesLimit).toBe(1000);
  });

  it('reads hourly usage values from nested data.limits.hourly objects', () => {
    const result = normalizeProfile({
      email: 'paid@barryguard.com',
      tier: 'pro',
      data: {
        limits: {
          hourly: {
            used: 7,
            remaining: 993,
            max: 1000,
          },
        },
      },
    });

    expect(result.hourlyAnalysesUsed).toBe(7);
    expect(result.hourlyAnalysesRemaining).toBe(993);
    expect(result.hourlyAnalysesLimit).toBe(1000);
  });
});
