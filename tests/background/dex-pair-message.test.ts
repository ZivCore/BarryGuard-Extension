import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock: Record<string, unknown> = {};
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'session-pair-1'),
});

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
    session: {
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
    getManifest: vi.fn(() => ({ version: '1.6.5' })),
    id: 'test-ext-id',
  },
});

const {
  _resolveDexPairsForTest: resolveDexPairs,
  _getTokenScoreForTest: getTokenScore,
  _takeTelemetrySessionForTest: takeTelemetrySession,
} = await import('../../src/background/index');

describe('RESOLVE_DEX_PAIR boundary contract', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
    mockFetch.mockReset();
  });

  it('delegates pair resolution to BarryGuard API instead of DexScreener directly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            pairAddress: 'pair123',
            tokenAddress: 'So11111111111111111111111111111111111111112',
          },
        ],
      }),
    });

    const results = await resolveDexPairs(['pair123'], 'solana');

    expect(results).toEqual([
      {
        pairAddress: 'pair123',
        tokenAddress: 'So11111111111111111111111111111111111111112',
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://barryguard.com/api/resolve/pair',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          provider: 'dexscreener',
          chain: 'solana',
          pairs: ['pair123'],
        }),
      }),
    );
    expect(String(mockFetch.mock.calls[0][0])).not.toContain('api.dexscreener.com');
  });

  it('stores a telemetry session for the resolved token and reuses it on the next score fetch', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              pairAddress: 'pair123',
              tokenAddress: 'So11111111111111111111111111111111111111112',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ message: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: 'Not found' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          address: 'So11111111111111111111111111111111111111112',
          chain: 'solana',
          score: 84,
          risk: 'low',
          checks: {},
          cached: false,
        }),
      });

    await resolveDexPairs(['pair123'], 'solana');

    const fresh = await getTokenScore('So11111111111111111111111111111111111111112', 'solana');

    expect(fresh.success).toBe(true);
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/api/token/solana/So11111111111111111111111111111111111111112?source=content_script&sessionId=session-pair-1'),
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      'https://barryguard.com/api/analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          address: 'So11111111111111111111111111111111111111112',
          chain: 'solana',
          mode: 'full',
          source: 'content_script',
          sessionId: 'session-pair-1',
        }),
      }),
    );
    expect(takeTelemetrySession('So11111111111111111111111111111111111111112', 'solana')).toBeUndefined();
  });
});
