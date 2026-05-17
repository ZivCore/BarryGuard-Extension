/**
 * analyze-token-list-inflight-sync.test.ts
 *
 * Tests that two parallel analyzeTokenList calls with identical addresses
 * result in only ONE api.analyzeTokenList network call. The second call
 * finds the addresses already in the persistent in-flight map and exits
 * without firing a duplicate POST.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Global stubs — must be set before the module is imported
// ---------------------------------------------------------------------------

const storageMock: Record<string, unknown> = {};
const sessionStoreMock: Record<string, unknown> = {};
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
      get: vi.fn(async (key: string) => ({ [key]: sessionStoreMock[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(sessionStoreMock, obj);
      }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => delete sessionStoreMock[k]);
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

const { setInflightSet, cache } = __testHooks;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Synthetic addresses — valid Base58, 44 chars (ADR-002).
const ADDR_1 = 'SyncTestAddr1111111111111111111111111111111';
const ADDR_2 = 'SyncTestAddr2222222222222222222222222222222';

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
      score: 80,
      risk: 'low',
      checks: {},
      reasons: [],
      analyzedAt: new Date().toISOString(),
    })),
  };
}

/** Wraps buildAnalyzeListSuccess as a proper NDJSON streaming Response. */
function makeAnalyzeListNdjsonResponse(addresses: string[]): Response {
  const encoder = new TextEncoder();
  const payload = buildAnalyzeListSuccess(addresses) as { scores: { address: string }[] };
  const lines = [
    ...payload.scores.map((s) => JSON.stringify({ type: 'token_result', address: s.address, result: s })),
    JSON.stringify({ type: 'summary', count: payload.scores.length, elapsedMs: 10 }),
  ].join('\n') + '\n';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('analyzeTokenList — in-flight sync (parallel calls, same addresses)', () => {
  beforeEach(async () => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    Object.keys(sessionStoreMock).forEach((k) => delete sessionStoreMock[k]);
    mockFetch.mockReset();
    await setInflightSet(new Set());
    await cache.clear();
    seedProfile();
  });

  // -------------------------------------------------------------------------
  // Test: second call with pre-marked in-flight addresses issues no POST
  // -------------------------------------------------------------------------
  it('fires no POST when all addresses are already in the persistent in-flight set', async () => {
    // Pre-populate inflight set — simulates the first parallel call having already
    // marked both addresses in the persistent session storage.
    await setInflightSet(new Set([`solana:${ADDR_1}`, `solana:${ADDR_2}`]));

    mockValidateSession401();

    const result = await analyzeTokenList([ADDR_1, ADDR_2]);

    expect(result.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    // Second parallel call must not issue a duplicate POST
    expect(postCalls.length).toBe(0);

    // No cached data was available so scores should be empty
    if (result.success) {
      expect(result.data?.scores?.length ?? 0).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // Test: first (and only) call fires exactly one POST for fresh addresses
  // -------------------------------------------------------------------------
  it('fires exactly one POST when addresses are not already in-flight', async () => {
    mockValidateSession401();
    mockFetch.mockResolvedValueOnce(makeAnalyzeListNdjsonResponse([ADDR_1, ADDR_2]));

    const result = await analyzeTokenList([ADDR_1, ADDR_2]);

    expect(result.success).toBe(true);

    const postCalls = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/analyze-list'),
    );
    expect(postCalls.length).toBe(1);

    const postBody = JSON.parse(postCalls[0][1]?.body ?? '{}') as { addresses?: string[] };
    expect(postBody.addresses).toContain(ADDR_1);
    expect(postBody.addresses).toContain(ADDR_2);
  });
});
