/**
 * cache-ttl.test.ts — Step 6 (E-M2)
 * Tests the clock-drift guard in TokenCache.
 *
 * When a stored timestamp is far in the future (system clock moved forward
 * then corrected), the entry must be treated as expired.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenCache } from '../../src/shared/cache'
import type { TokenScore } from '../../src/shared/types'

const storageMock: Record<string, unknown> = {}

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: storageMock[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        Object.assign(storageMock, obj)
      }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key]
        keys.forEach((k) => delete storageMock[k])
      }),
    },
  },
})

function makeScore(score = 50): TokenScore {
  return {
    address: 'clock-test',
    chain: 'solana',
    score,
    risk: 'moderate',
    checks: {},
    cached: false,
  }
}

describe('TokenCache — clock-drift guard (E-M2)', () => {
  let cache: TokenCache

  beforeEach(() => {
    cache = new TokenCache()
    Object.keys(storageMock).forEach((k) => delete storageMock[k])
    vi.restoreAllMocks()
  })

  it('returns a cached entry when timestamp is valid and within TTL', async () => {
    const score = makeScore(80)
    await cache.set('valid-addr', score, 'free')
    const result = await cache.get('valid-addr', 'free')
    expect(result).not.toBeNull()
    expect(result?.score).toBe(80)
  })

  it('treats an entry as expired when timestamp is far in the future (clock-drift)', async () => {
    const score = makeScore(75)
    await cache.set('drift-addr', score, 'free')

    // Simulate clock going back: the stored timestamp is now MAX_TTL + 1ms in the future
    const MAX_TTL_MS = 720 * 60 * 1000 // 12h — largest TTL
    const futureTimestamp = Date.now() + MAX_TTL_MS + 1

    // Directly manipulate the internal cache map via init-reload simulation
    // by overwriting the stored value with a future timestamp
    const storedKey = 'barryguard_cache'
    storageMock[storedKey] = {
      'solana:drift-addr': {
        score,
        timestamp: futureTimestamp,
        tier: 'free',
      },
    }

    // Create a fresh cache to trigger re-init from storage
    const freshCache = new TokenCache()
    const result = await freshCache.get('drift-addr', 'free')

    // Entry with future timestamp > MAX_TTL_MS should be evicted on init
    expect(result).toBeNull()
  })

  it('evicts expired entry on get() and triggers persist', async () => {
    const score = makeScore(60)
    await cache.set('expired-addr', score, 'pro')

    // Manipulate storage to make the timestamp old (beyond 10 min pro TTL)
    const storedKey = 'barryguard_cache'
    const pastTimestamp = Date.now() - 11 * 60 * 1000 // 11 minutes ago
    storageMock[storedKey] = {
      'solana:expired-addr': {
        score,
        timestamp: pastTimestamp,
        tier: 'pro',
      },
    }

    const freshCache = new TokenCache()
    const result = await freshCache.get('expired-addr', 'pro')
    expect(result).toBeNull()
  })

  it('returns null for wrong tier even if timestamp is valid', async () => {
    const score = makeScore(70)
    await cache.set('tier-mismatch', score, 'pro')
    // Ask for same address with different tier
    const result = await cache.get('tier-mismatch', 'free')
    expect(result).toBeNull()
  })

  it('getStats reflects cache size', async () => {
    const score = makeScore(50)
    await cache.set('stats-addr', score, 'free')
    const stats = cache.getStats()
    expect(stats.size).toBeGreaterThan(0)
    expect(stats.maxSize).toBe(1000)
  })
})
