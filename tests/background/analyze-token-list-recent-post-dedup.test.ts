/**
 * analyze-token-list-recent-post-dedup.test.ts
 *
 * Tests for the 60-second recent-post dedup logic inside `analyzeTokenList`.
 * Covers: active dedup window, expiry after 60 001 ms, service-worker restart,
 * and cache-miss while dedup stamp is still active.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Global stubs — must be set before the module is imported
// ---------------------------------------------------------------------------

const storageMock: Record<string, unknown> = {};
const sessionMock: Record<string, unknown> = {};
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
        keys.forEach((k) => delete storageMock[k]);
      }),
    },
    session: {
      get: vi.fn(async (key: string) => ({ [key]: sessionMock[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(sessionMock, obj); }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => delete sessionMock[k]);
      }),
    },
  },
  action: { setIcon: vi.fn(async () => {}) },
  runtime: {
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    id: 'test-ext-id',
    getManifest: vi.fn(() => ({ version: '0.0.0-test' })),
  },
});

const {
  _analyzeTokenListForTest: analyzeTokenList,
  __testHooks,
} = await import('../../src/background/index');

const { getInflightSet, setInflightSet, getRecentPosts, setRecentPosts, cache } = __testHooks;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADDR_A = 'So11111111111111111111111111111111111111112';

function seedProfile(): void {
  storageMock['user_profile'] = {
    id: 'user_test',
    email: 'test@barryguard.com',
    tier: 'rescue_pass',
    hourlyAnalysesUsed: 0,
    hourlyAnalysesRemaining: 100,
  };
  storageMock['profile_synced_at'] = Date.now() - 120_000;
}

function mockValidateSession401(): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Unauthorized' }),
  });
}

function buildAnalyzeListSuccess(addresses: string[]): object {
  return {
    success: true,
    scores: addresses.map((address) => ({
      address,
      chain: 'solana',
      score: 75,
      risk: 'low',
      checks: {},
      reasons: [],
      analyzedAt: new Date().toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('analyzeTokenList — recent-post dedup (60 s window)', () => {
  beforeEach(async () => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    Object.keys(sessionMock).forEach((k) => delete sessionMock[k]);
    mockFetch.mockReset();
    await setInflightSet(new Set());
    await setRecentPosts(new Map());
    vi.useRealTimers();
    await cache.clear();
    seedProfile();
  });

  // -------------------------------------------------------------------------
  // Test 1: Dedup window active (< 60 s)
  // -------------------------------------------------------------------------
  it('skips a second POST when the same address was analyzed within the 60 s window', async () => {
    vi.useFakeTimers();
    const startTime = Date.now();

    // First call — performs a POST and records the timestamp
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const first = await analyzeTokenList([ADDR_A]);
    expect(first.success).toBe(true);
    expect((await getRecentPosts()).has(`solana:${ADDR_A}`)).toBe(true);

    // Advance 30 s — still within the 60 s dedup window
    vi.advanceTimersByTime(30_000);

    storageMock['profile_synced_at'] = startTime - 120_000;
    mockValidateSession401();

    // Second call — dedup must suppress the POST
    const second = await analyzeTokenList([ADDR_A]);
    expect(second.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(1);

    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 2: Dedup window expired (> 60 s)
  // -------------------------------------------------------------------------
  it('fires a new POST after 60 001 ms have elapsed since the last analysis', async () => {
    // Directly inject a timestamp 61 s in the past so the dedup check
    // (now - lastPostMs < RECENT_POST_DEDUP_MS) evaluates to false,
    // without requiring real waiting or fake-timer/AbortController interactions.
    const staleMs = Date.now() - 61_000;
    await setRecentPosts(new Map([[`solana:${ADDR_A}`, staleMs]]));

    // ADDR_A is not in cache (cleared in beforeEach), so it is a cache miss.
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const result = await analyzeTokenList([ADDR_A]);
    expect(result.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    // Stale stamp must not suppress the POST
    expect(postCalls.length).toBe(1);

    // A fresh stamp must now be written
    const newStamp = (await getRecentPosts()).get(`solana:${ADDR_A}`);
    expect(newStamp).toBeDefined();
    expect(newStamp!).toBeGreaterThan(staleMs);
  });

  // -------------------------------------------------------------------------
  // Test 3: Service-worker restart simulation
  // -------------------------------------------------------------------------
  it('fires a new POST after recentPosts is cleared (service-worker restart)', async () => {
    // First call sets the stamp
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const first = await analyzeTokenList([ADDR_A]);
    expect(first.success).toBe(true);
    expect((await getRecentPosts()).has(`solana:${ADDR_A}`)).toBe(true);

    // Simulate module re-init — clear persistent maps and cache
    await setRecentPosts(new Map());
    await setInflightSet(new Set());
    await cache.invalidate(ADDR_A, 'solana');

    storageMock['profile_synced_at'] = Date.now() - 120_000;
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    // Even though wall-clock is within 60 s, the map was wiped — POST must fire
    const second = await analyzeTokenList([ADDR_A]);
    expect(second.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Test 4: Cache-miss while recent-post stamp is active
  // -------------------------------------------------------------------------
  it('suppresses a duplicate POST even when the cache entry was evicted within the 60 s window', async () => {
    vi.useFakeTimers();
    const startTime = Date.now();

    // First call — POST succeeds, stamp + cache entry are written
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const first = await analyzeTokenList([ADDR_A]);
    expect(first.success).toBe(true);

    // Advance 10 s — still within the window
    vi.advanceTimersByTime(10_000);

    // Externally evict the cache entry (e.g. storage wipe)
    await cache.invalidate(ADDR_A, 'solana');

    storageMock['profile_synced_at'] = startTime - 120_000;
    mockValidateSession401();

    // Second call: no cache hit, but recent-post stamp is active
    // Expected: dedup fires, no POST (address is silently skipped)
    const second = await analyzeTokenList([ADDR_A]);
    expect(second.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(1);

    vi.useRealTimers();
  });
});
