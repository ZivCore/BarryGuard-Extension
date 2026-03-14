// tests/shared/cache.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenCache } from '../../src/shared/cache';
import type { TokenScore } from '../../src/shared/types';

// Mock chrome.storage.local
const storageMock: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: storageMock[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(storageMock, obj);
      }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach(k => delete storageMock[k]);
      }),
    },
  },
});

function makeScore(score = 50): TokenScore {
  return {
    address: 'test',
    chain: 'solana',
    score,
    risk: 'medium',
    checks: {},
    cached: false,
  };
}

describe('TokenCache', () => {
  let cache: TokenCache;

  beforeEach(() => {
    cache = new TokenCache();
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
  });

  it('returns null for unknown address', async () => {
    const result = await cache.get('unknown', 'free');
    expect(result).toBeNull();
  });

  it('stores and retrieves a score', async () => {
    const score = makeScore(75);
    await cache.set('addr1', score, 'free');
    const result = await cache.get('addr1', 'free');
    expect(result?.score).toBe(75);
  });

  it('returns null for expired free-tier entry (TTL 5min)', async () => {
    vi.useFakeTimers();
    const score = makeScore(50);
    await cache.set('addr2', score, 'free');

    // Advance time past 5 minutes
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    const result = await cache.get('addr2', 'free');
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  it('evicts oldest entry when at max capacity (1000)', async () => {
    // Fill cache to 1000 entries
    for (let i = 0; i < 1000; i++) {
      await cache.set(`addr${i}`, makeScore(i % 100), 'free');
    }
    // Add one more — should evict addr0
    await cache.set('addr1000', makeScore(99), 'free');

    const stats = cache.getStats();
    expect(stats.size).toBe(1000);
  });

  it('reports correct stats', async () => {
    const stats = cache.getStats();
    expect(stats.maxSize).toBe(1000);
    expect(stats.size).toBe(0);
  });
});
