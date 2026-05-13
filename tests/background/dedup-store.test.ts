/**
 * dedup-store.test.ts
 *
 * Tests for chrome.storage.session-backed dedup state in dedup-store.ts.
 * Covers: roundtrips, pruneRecentPosts, withInflightSet atomic mutator,
 * service-worker-restart simulation, and in-memory fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionMock() {
  const store: Record<string, unknown> = {};
  return {
    store,
    mock: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Suite 1: Normal operation with chrome.storage.session available
// ---------------------------------------------------------------------------

describe('dedup-store — session storage roundtrips', () => {
  let sessionStore: ReturnType<typeof makeSessionMock>;

  beforeEach(async () => {
    vi.resetModules();

    sessionStore = makeSessionMock();
    (globalThis as Record<string, unknown>).chrome = {
      storage: { session: sessionStore.mock },
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).chrome;
  });

  it('roundtrip: setInflightSet / getInflightSet', async () => {
    const { setInflightSet, getInflightSet } = await import('../../src/background/dedup-store');

    const input = new Set(['solana:abc111111111111111111111111111111111111111']);
    await setInflightSet(input);
    const result = await getInflightSet();

    expect(result).toBeInstanceOf(Set);
    expect(result.has('solana:abc111111111111111111111111111111111111111')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('roundtrip: setRecentPosts / getRecentPosts', async () => {
    const { setRecentPosts, getRecentPosts } = await import('../../src/background/dedup-store');

    const input = new Map([['k1', 1000]]);
    await setRecentPosts(input);
    const result = await getRecentPosts();

    expect(result).toBeInstanceOf(Map);
    expect(result.get('k1')).toBe(1000);
    expect(result.size).toBe(1);
  });

  it('pruneRecentPosts removes entries older than ttlMs', async () => {
    const { setRecentPosts, getRecentPosts, pruneRecentPosts } = await import(
      '../../src/background/dedup-store'
    );

    // 'old' at t=5000, 'fresh' at t=65000
    // now=70000, ttlMs=60000 → now - 5000 = 65000 > 60000 → 'old' pruned
    // now - 65000 = 5000 < 60000 → 'fresh' kept
    await setRecentPosts(new Map([['old', 5000], ['fresh', 65000]]));
    await pruneRecentPosts(70000, 60000);

    const result = await getRecentPosts();
    expect(result.has('old')).toBe(false);
    expect(result.has('fresh')).toBe(true);
    expect(result.get('fresh')).toBe(65000);
  });

  it('withInflightSet calls mutator and persists the result', async () => {
    const { withInflightSet, getInflightSet } = await import('../../src/background/dedup-store');

    await withInflightSet((set) => {
      set.add('solana:mutated111111111111111111111111111111111');
    });

    const result = await getInflightSet();
    expect(result.has('solana:mutated111111111111111111111111111111111')).toBe(true);
    expect(sessionStore.mock.set).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Service-worker-restart simulation
// ---------------------------------------------------------------------------

describe('dedup-store — service-worker restart simulation', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).chrome;
  });

  it('getInflightSet reads back values written before module reset', async () => {
    vi.resetModules();

    const sessionStore = makeSessionMock();
    (globalThis as Record<string, unknown>).chrome = {
      storage: { session: sessionStore.mock },
    };

    // First import — write data
    const { setInflightSet } = await import('../../src/background/dedup-store');
    await setInflightSet(new Set(['solana:restart11111111111111111111111111111111']));

    // Simulate service-worker restart: reset modules (clears in-memory module state)
    vi.resetModules();

    // Re-import — chrome.storage.session mock still holds the written data
    const { getInflightSet } = await import('../../src/background/dedup-store');
    const result = await getInflightSet();

    expect(result.has('solana:restart11111111111111111111111111111111')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Fallback when chrome.storage.session is unavailable
// ---------------------------------------------------------------------------

describe('dedup-store — in-memory fallback', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let warnSpy: any;

  beforeEach(async () => {
    vi.resetModules();
    // Remove chrome entirely so isSessionStorageAvailable() returns false
    delete (globalThis as Record<string, unknown>).chrome;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete (globalThis as Record<string, unknown>).chrome;
  });

  it('getInflightSet returns empty Set and emits console.warn when session unavailable', async () => {
    const { getInflightSet } = await import('../../src/background/dedup-store');

    const result = await getInflightSet();

    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[dedup-store]'));
  });

  it('setInflightSet writes to in-memory fallback when session unavailable', async () => {
    const { setInflightSet, getInflightSet } = await import('../../src/background/dedup-store');

    await setInflightSet(new Set(['solana:fallback1111111111111111111111111111111']));
    warnSpy.mockClear();

    const result = await getInflightSet();
    expect(result.has('solana:fallback1111111111111111111111111111111')).toBe(true);
  });
});
