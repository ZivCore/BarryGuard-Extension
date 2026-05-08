/**
 * chain-aware-score.test.ts — Test-Paket B, Tests 11-12
 *
 * Test 11: GET_TOKEN_SCORE Object-Payload chain-aware — Background verarbeitet
 *          { address, chain } korrekt; String-Payload defaultet auf 'solana'.
 * Test 12: In-Flight-Sperre chain-aware — Gleiche EVM-Adresse auf zwei Chains
 *          blockiert sich nicht gegenseitig; Same-Chain-Race wird blockiert.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Mock-Adressen (ADR-002) ----------
const SOLANA_ADDR = 'So11111111111111111111111111111111111111112';
const EVM_ADDR = '0x0000000000000000000000000000000000000001';

const storageMock: Record<string, unknown> = {};
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
    // logScoreHandoff ruft chrome.runtime.getManifest() auf
    getManifest: vi.fn(() => ({ version: '0.0.0-test' })),
  },
});

const {
  _getTokenScoreForTest: getTokenScore,
} = await import('../../src/background/index');

// ---------- Test 11: Object-Payload chain-aware ----------
describe('background GET_TOKEN_SCORE object payload chain-awareness (Test 11)', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
    mockFetch.mockReset();
  });

  it('routes { address, chain: solana } to the solana backend endpoint', async () => {
    const freshScore = {
      address: SOLANA_ADDR,
      chain: 'solana',
      score: 88,
      risk: 'low',
      checks: {},
      reasons: [],
      analyzedAt: '2026-05-08T10:00:00.000Z',
    };

    // profile (401 = no session), cache GET (404 = miss), analyze POST (200)
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => freshScore });

    const result = await getTokenScore(SOLANA_ADDR, 'solana');

    expect(result.success).toBe(true);
    // Backend-URL muss 'solana' und die Adresse enthalten
    const cacheCallUrl = String(mockFetch.mock.calls[1][0]);
    expect(cacheCallUrl).toContain('solana');
    expect(cacheCallUrl).toContain(SOLANA_ADDR);
  });

  it('routes { address, chain: ethereum } to the ethereum backend endpoint — not solana', async () => {
    const freshScore = {
      address: EVM_ADDR,
      chain: 'ethereum',
      score: 72,
      risk: 'medium',
      checks: {},
      reasons: [],
      analyzedAt: '2026-05-08T10:00:00.000Z',
    };

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Not found' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => freshScore });

    const result = await getTokenScore(EVM_ADDR, 'ethereum');

    expect(result.success).toBe(true);
    // Backend-URL muss 'ethereum' enthalten — nicht 'solana'
    const cacheCallUrl = String(mockFetch.mock.calls[1][0]);
    expect(cacheCallUrl).toContain('ethereum');
    expect(cacheCallUrl).not.toContain('/solana/');
  });

  it('defaults to solana when no chain argument is provided (backward compat for string payload)', async () => {
    // String-Payload-Verhalten: getTokenScore(address) ohne chain => default 'solana'
    // Prueft die Funktion-Signatur: chain: string = 'solana'
    // Validierung: getTokenScore mit ungueltigem EVM-Payload ohne chain gibt Validation-Error
    // (EVM-Adresse ist fuer Solana-Kette ungueltig => isValidTokenAddress returned false)
    const result = await getTokenScore(EVM_ADDR);

    // EVM-Adresse mit default chain='solana' muss als validation-error abgewiesen werden
    // (isValidSolanaAddress(EVM_ADDR) === false)
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    // Kein fetch-Aufruf noetig (Validation schlaegt vor fetch fehl)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------- Test 12: In-Flight-Sperre chain-aware ----------
describe('background in-flight lock is chain-aware (Test 12)', () => {
  beforeEach(() => {
    Object.keys(storageMock).forEach((key) => delete storageMock[key]);
    mockFetch.mockReset();
  });

  it('allows parallel fetches for same EVM address on ethereum vs bsc — no mutual blocking', async () => {
    // Gleiche EVM-Adresse auf zwei Chains: In-Flight-Key ist chain:address,
    // daher sind 'ethereum:0x...' und 'bsc:0x...' separate Keys.
    // Prueft: Beide Aufrufe loesen je eine Backend-Anfrage aus — keine gegenseitige Blockierung.
    //
    // Strategie: GET /token/chain/address gibt Cache-Hit zurueck (200) pro Chain.
    // Kein /analyze-Aufruf noetig — vermeidet sanitize-Komplexitaet mit BSC.
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      // profile/session fetch -> kein Login
      if (urlStr.includes('/profile') || urlStr.includes('/me') || urlStr.includes('/session')) {
        return { ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) };
      }
      // GET /token/ethereum/0x... -> Cache-Hit mit ethereum-Score
      if (urlStr.includes('/token/ethereum/')) {
        return {
          ok: true, status: 200, json: async () => ({
            address: EVM_ADDR,
            chain: 'ethereum',
            score: 65,
            risk: 'medium',
            checks: {},
            reasons: [],
            analyzedAt: '2026-05-08T10:00:00.000Z',
          }),
        };
      }
      // GET /token/bsc/0x... -> Cache-Hit mit bsc-Score
      if (urlStr.includes('/token/bsc/')) {
        return {
          ok: true, status: 200, json: async () => ({
            address: EVM_ADDR,
            chain: 'bsc',
            score: 55,
            risk: 'medium',
            checks: {},
            reasons: [],
            analyzedAt: '2026-05-08T10:00:00.000Z',
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
    });

    const [ethResult, bscResult] = await Promise.all([
      getTokenScore(EVM_ADDR, 'ethereum'),
      getTokenScore(EVM_ADDR, 'bsc'),
    ]);

    // Kern-Assertion: Beide muessen erfolgreich sein — keine gegenseitige Blockierung.
    // (ethereum und bsc haben separate In-Flight-Keys: 'ethereum:0x...' vs 'bsc:0x...')
    // Weder 'busy'-Error noch Validation-Error erwartet.
    expect(ethResult.success).toBe(true);
    expect(bscResult.success).toBe(true);
    // Kein 'busy'-Fehler — die Chains blockieren sich nicht
    expect(ethResult.errorType).not.toBe('busy');
    expect(bscResult.errorType).not.toBe('busy');
  });

  it('blocks a second parallel fetch for the same address on the same chain (same-chain race)', async () => {
    // Same-Chain-Race: Solana mit gleicher Adresse — zweiter Aufruf wird mit 'busy' blockiert
    const freshScore = {
      address: SOLANA_ADDR,
      chain: 'solana',
      score: 90,
      risk: 'low',
      checks: {},
      reasons: [],
      analyzedAt: '2026-05-08T10:00:00.000Z',
    };

    // Erster Aufruf: cache-fetch verzoegern damit In-Flight-Sperre aktiv bleibt
    let resolveFirst!: () => void;
    const firstFetchGate = new Promise<void>((res) => { resolveFirst = res; });

    mockFetch
      // Erster Aufruf: profile
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
      // Erster Aufruf: cache — wartet auf Signal
      .mockImplementationOnce(async () => {
        await firstFetchGate;
        return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
      })
      // Erster Aufruf: analyze
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => freshScore });

    // Erster Aufruf starten (noch nicht awaited)
    const firstPromise = getTokenScore(SOLANA_ADDR, 'solana');

    // Kleiner Tick damit firstPromise den In-Flight-Key setzen kann
    await Promise.resolve();

    // Zweiter Aufruf sofort — muss mit 'busy' abgelehnt werden
    const secondResult = await getTokenScore(SOLANA_ADDR, 'solana');

    expect(secondResult.success).toBe(false);
    expect(secondResult.errorType).toBe('busy');

    // Ersten Aufruf freigeben und abschliessen
    resolveFirst();
    const firstResult = await firstPromise;
    expect(firstResult.success).toBe(true);
  });
});
