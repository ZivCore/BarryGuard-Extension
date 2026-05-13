/**
 * analyze-token-list-inflight-dedup.test.ts
 *
 * Tests for the in-flight dedup logic inside `analyzeTokenList`.
 * Covers: parallel overlapping calls, all-addresses-in-flight early exit,
 * service-worker restart (module state cleared), and finally-cleanup on error.
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
const ADDR_B = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ADDR_C = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

function seedProfile(): void {
  storageMock['user_profile'] = {
    id: 'user_test',
    email: 'test@barryguard.com',
    tier: 'rescue_pass',
    hourlyAnalysesUsed: 0,
    hourlyAnalysesRemaining: 100,
  };
  // Stale profile_synced_at so refreshProfileStateIfNeeded enters the refresh path,
  // hits validateSession (mocked to 401), then falls back to the stored profile.
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
      score: 80,
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

describe('analyzeTokenList — in-flight dedup', () => {
  beforeEach(async () => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    Object.keys(sessionMock).forEach((k) => delete sessionMock[k]);
    mockFetch.mockReset();
    await setInflightSet(new Set());
    await setRecentPosts(new Map());
    await cache.clear();
    seedProfile();
  });

  // -------------------------------------------------------------------------
  // Test 1: Parallel calls with overlapping addresses
  // -------------------------------------------------------------------------
  it('calls the API only once per address when two parallel calls share overlapping addresses', async () => {
    // Strategy: pre-populate the in-flight set with ADDR_A and ADDR_B directly,
    // simulating that a concurrent analyzeTokenList call already marked them.
    // Then start a single call for [ADDR_A, ADDR_B, ADDR_C] and verify that
    // ADDR_A / ADDR_B are skipped and only ADDR_C reaches the POST.
    await setInflightSet(new Set([`solana:${ADDR_A}`, `solana:${ADDR_B}`]));

    mockValidateSession401();

    // Only ADDR_C should appear in the POST batch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_C]),
    });

    const result = await analyzeTokenList([ADDR_A, ADDR_B, ADDR_C]);

    expect(result.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(1);

    const postBody = JSON.parse(postCalls[0][1]?.body ?? '{}') as { addresses?: string[] };
    expect(postBody.addresses).not.toContain(ADDR_A);
    expect(postBody.addresses).not.toContain(ADDR_B);
    expect(postBody.addresses).toContain(ADDR_C);

    // After completion, ADDR_C should no longer be in-flight
    expect((await getInflightSet()).has(`solana:${ADDR_C}`)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test 2: All addresses in-flight
  // -------------------------------------------------------------------------
  it('returns success with no POST when all addresses are already in-flight', async () => {
    await setInflightSet(new Set([`solana:${ADDR_A}`, `solana:${ADDR_B}`]));

    mockValidateSession401();

    const result = await analyzeTokenList([ADDR_A, ADDR_B]);

    expect(result.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(0);

    // No cached data was available, so scores should be empty
    if (result.success) {
      expect(result.data?.scores?.length ?? 0).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: Service-worker restart simulation
  // -------------------------------------------------------------------------
  it('fires a new POST after both maps are cleared (service-worker restart)', async () => {
    // First call — succeeds, writes cache and recent-post stamp
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const first = await analyzeTokenList([ADDR_A]);
    expect(first.success).toBe(true);

    // Simulate module re-init: clear both persistent maps and the local cache entry
    await setInflightSet(new Set());
    await setRecentPosts(new Map());
    await cache.invalidate(ADDR_A, 'solana');

    // Second call must reach the API again
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const second = await analyzeTokenList([ADDR_A]);
    expect(second.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Test 4: finally-cleanup on API error
  // -------------------------------------------------------------------------
  it('removes in-flight keys in the finally block when the API returns HTTP 500', async () => {
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Internal Server Error' }),
    });

    const result = await analyzeTokenList([ADDR_A]);
    expect(result.success).toBe(false);

    // The in-flight key must be gone after the error
    expect((await getInflightSet()).has(`solana:${ADDR_A}`)).toBe(false);

    // A follow-up call must not be blocked by a stale in-flight entry
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => buildAnalyzeListSuccess([ADDR_A]),
    });

    const retry = await analyzeTokenList([ADDR_A]);
    expect(retry.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(2);
  });
});
