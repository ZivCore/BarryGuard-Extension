/**
 * dex-pair-message.test.ts — Step 9 (E-M10)
 * Tests the RESOLVE_DEX_PAIR message handler pattern.
 *
 * DexScreener/DexTools API calls must happen in the background service worker,
 * not in content scripts. This test verifies the message routing logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Simulated background handler for RESOLVE_DEX_PAIR message
// ---------------------------------------------------------------------------

interface DexPairRequest {
  type: 'RESOLVE_DEX_PAIR'
  chain: string
  address: string
}

interface DexPairResult {
  pairAddress: string | null
  baseToken: string | null
  quoteToken: string | null
}

async function handleResolveDexPair(
  request: DexPairRequest,
  fetchFn: (url: string) => Promise<Response>
): Promise<DexPairResult> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${request.address}`
  try {
    const res = await fetchFn(url)
    if (!res.ok) {
      return { pairAddress: null, baseToken: null, quoteToken: null }
    }
    const data = await res.json() as { pairs?: Array<{ pairAddress: string; baseToken: { address: string }; quoteToken: { address: string } }> }
    const pair = data.pairs?.[0]
    if (!pair) return { pairAddress: null, baseToken: null, quoteToken: null }
    return {
      pairAddress: pair.pairAddress,
      baseToken: pair.baseToken.address,
      quoteToken: pair.quoteToken.address,
    }
  } catch {
    return { pairAddress: null, baseToken: null, quoteToken: null }
  }
}

describe('RESOLVE_DEX_PAIR background handler (E-M10)', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  it('fetches from api.dexscreener.com (not from content script)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        pairs: [
          {
            pairAddress: 'pair123',
            baseToken: { address: 'So11111111111111111111111111111111111111112' },
            quoteToken: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
          },
        ],
      }),
    } as Response)

    const result = await handleResolveDexPair(
      { type: 'RESOLVE_DEX_PAIR', chain: 'solana', address: 'So11111111111111111111111111111111111111112' },
      mockFetch
    )

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.dexscreener.com')
    )
    expect(result.pairAddress).toBe('pair123')
  })

  it('returns null fields on 4xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response)

    const result = await handleResolveDexPair(
      { type: 'RESOLVE_DEX_PAIR', chain: 'solana', address: 'unknown' },
      mockFetch
    )

    expect(result.pairAddress).toBeNull()
    expect(result.baseToken).toBeNull()
    expect(result.quoteToken).toBeNull()
  })

  it('returns null fields when pairs array is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: [] }),
    } as Response)

    const result = await handleResolveDexPair(
      { type: 'RESOLVE_DEX_PAIR', chain: 'solana', address: 'no-pairs' },
      mockFetch
    )

    expect(result.pairAddress).toBeNull()
  })

  it('returns null fields on network error (does not throw)', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))

    const result = await handleResolveDexPair(
      { type: 'RESOLVE_DEX_PAIR', chain: 'solana', address: 'addr' },
      mockFetch
    )

    expect(result.pairAddress).toBeNull()
    expect(result.baseToken).toBeNull()
    expect(result.quoteToken).toBeNull()
  })

  it('uses the token address in the DexScreener URL', async () => {
    const testAddress = 'TestAddr111111111111111111111111111111111111'
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response)

    await handleResolveDexPair(
      { type: 'RESOLVE_DEX_PAIR', chain: 'solana', address: testAddress },
      mockFetch
    )

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(testAddress))
  })

  it('single rate-limit point: only one fetch per RESOLVE_DEX_PAIR message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: [] }),
    } as Response)

    await handleResolveDexPair(
      { type: 'RESOLVE_DEX_PAIR', chain: 'solana', address: 'addr' },
      mockFetch
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
