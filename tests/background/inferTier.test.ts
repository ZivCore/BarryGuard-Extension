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

const { _inferTierForTest: inferTier, _normalizeProfileForTest: normalizeProfile } =
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

  it('reads plan field as alias', () => {
    expect(inferTier({ plan: 'rescue' })).toBe('rescue_pass');
  });

  it('does NOT upgrade to rescue_pass based on generic status:active field', () => {
    // This was the spoofing vector — fixed by removing "status" from pickString keys
    expect(inferTier({ status: 'active' })).toBe('free');
  });

  it('upgrades to rescue_pass based on subscriptionStatus:active', () => {
    expect(inferTier({ subscriptionStatus: 'active' })).toBe('rescue_pass');
    expect(inferTier({ subscription_status: 'trialing' })).toBe('rescue_pass');
  });

  it('reads tier from nested user object', () => {
    expect(inferTier({ user: { tier: 'pro' } })).toBe('pro');
  });

  it('stops recursing at depth 3 — deep status:active not reached', () => {
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
    expect(result.capabilities.tokenListAnalysis).toBe(false);
  });

  it('sets tokenListAnalysis capability to true for paid tier', () => {
    const result = normalizeProfile({ tier: 'rescue_pass', email: 'a@b.com' });
    expect(result.capabilities.tokenListAnalysis).toBe(true);
  });
});
