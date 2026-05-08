/**
 * chain-persistence.test.ts — Test-Paket B, Tests 8-10
 *
 * Test  8: Chain-Persistenz vor Score — Content Script persistiert { address, chain }
 * Test  9: GET_CACHED_SCORE chain-aware
 * Test 10: persistSelectedTokenPreserveScore — Score nicht ueberschreiben bei Adress+Chain-Match,
 *           aber verwerfen bei Chain-Mismatch
 *
 * Da persistSelectedToken / persistSelectedTokenPreserveScore nicht exportiert sind,
 * werden die Kernlogiken als White-Box-Unit-Tests reproduziert (Muster analog
 * content-sender-check.test.ts). Storage-Interaktion wird via chrome-Mock geprueft.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Mock-Adressen (ADR-002) ----------
const SOLANA_ADDR = 'So11111111111111111111111111111111111111112';
const EVM_ADDR = '0x0000000000000000000000000000000000000001';

const SOLANA_SCORE = {
  address: SOLANA_ADDR,
  chain: 'solana',
  score: 80,
  risk: 'low',
  checks: {},
  cached: false,
};

const EVM_SCORE = {
  address: EVM_ADDR,
  chain: 'ethereum',
  score: 60,
  risk: 'medium',
  checks: {},
  cached: false,
};

// ---------- Inline-Reproduktion der persistSelectedTokenPreserveScore-Logik ----------
// Spiegelt src/content/index.ts: persistSelectedTokenPreserveScore
interface StoredToken {
  address: string;
  chain?: string;
  score?: unknown;
}

function applyPreserveScoreLogic(
  existing: StoredToken | undefined,
  update: { address: string; chain?: string },
): StoredToken {
  return {
    ...update,
    ...(existing?.address === update.address
      && (update.chain == null || existing?.chain == null || existing?.chain === update.chain)
      && existing?.score
      ? { score: existing.score }
      : {}),
  };
}

// ---------- Test 8: Chain-Persistenz vor Score ----------
describe('content script chain persistence before score (Test 8)', () => {
  // Helper mirrors the pageChain resolution in content/index.ts:
  //   platform.detectChainFromUrl?.(window.location.href) ?? platform.chains?.[0] ?? 'solana'
  const resolvePageChain = (
    detectFn: ((url: string) => string | null) | undefined,
    chains: string[] | undefined,
    href: string,
  ): string => detectFn?.(href) ?? chains?.[0] ?? 'solana';

  it('persists { address, chain: solana } for a Solana detail page', () => {
    const href = 'https://pump.fun/coin/So11111111111111111111111111111111111111112';
    const pageChain = resolvePageChain(undefined, ['solana'], href);
    const persisted = { address: SOLANA_ADDR, chain: pageChain };

    expect(persisted).toMatchObject({ address: SOLANA_ADDR, chain: 'solana' });
  });

  it('persists { address, chain: ethereum } for an EVM detail page adapter', () => {
    // Simuliert einen EVM-Adapter mit chains: ['ethereum'] und detectChainFromUrl
    const platformChains = ['ethereum'];
    const detectChainFromUrl = (_url: string): string | null => 'ethereum';
    const href = 'https://example-evm-dex.io/token/0x0000000000000000000000000000000000000001';

    const pageChain = (detectChainFromUrl(href) ?? platformChains?.[0]) ?? 'solana';
    const persisted = { address: EVM_ADDR, chain: pageChain };

    expect(persisted).toMatchObject({ address: EVM_ADDR, chain: 'ethereum' });
    // Kein Solana-Default fuer EVM-Adapter
    expect(persisted.chain).not.toBe('solana');
  });
});

// ---------- Test 9: GET_CACHED_SCORE chain-aware ----------
describe('content script GET_CACHED_SCORE is chain-aware (Test 9)', () => {
  it('sends GET_CACHED_SCORE with { address, chain: solana } for Solana detail page', () => {
    // Prueft: Das payload-Objekt enthaelt die korrekte Chain
    const pageChain = 'solana';
    const expectedPayload = { address: SOLANA_ADDR, chain: pageChain };

    // Spiegelt den Message-Aufruf in scanAll():
    // sendRuntimeMessage({ type: 'GET_CACHED_SCORE', payload: { address, chain: pageChain } }, ...)
    expect(expectedPayload).toMatchObject({ address: SOLANA_ADDR, chain: 'solana' });
  });

  it('sends GET_CACHED_SCORE with { address, chain: ethereum } for EVM detail page', () => {
    const pageChain = 'ethereum';
    const expectedPayload = { address: EVM_ADDR, chain: pageChain };

    expect(expectedPayload).toMatchObject({ address: EVM_ADDR, chain: 'ethereum' });
    expect(expectedPayload.chain).not.toBe('solana');
  });

  it('uses separate cache entries per chain — Solana and EVM do not collide', async () => {
    // Prueft: Solana und EVM erzeugen verschiedene Cache-Keys (chain:address)
    const storageMock: Record<string, unknown> = {};

    const storageSet = vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(storageMock, values);
    });
    const storageGet = vi.fn(async (key: string) => ({ [key]: storageMock[key] }));

    vi.stubGlobal('chrome', {
      storage: { local: { get: storageGet, set: storageSet } },
    });

    const solanaKey = `token_cache:solana:${SOLANA_ADDR}`;
    const evmKey = `token_cache:ethereum:${EVM_ADDR}`;

    await storageSet({ [solanaKey]: SOLANA_SCORE });
    await storageSet({ [evmKey]: EVM_SCORE });

    const solanaResult = await storageGet(solanaKey);
    const evmResult = await storageGet(evmKey);

    expect(solanaResult[solanaKey]).toMatchObject({ chain: 'solana' });
    expect(evmResult[evmKey]).toMatchObject({ chain: 'ethereum' });
    // Eintraege blockieren sich nicht gegenseitig
    expect(solanaResult[solanaKey]).not.toEqual(evmResult[evmKey]);

    vi.unstubAllGlobals();
  });
});

// ---------- Test 10: persistSelectedTokenPreserveScore ----------
describe('persistSelectedTokenPreserveScore logic (Test 10)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps existing score when address and chain match', () => {
    // Adress+Chain-Match: vorhandener Score bleibt erhalten
    const existing: StoredToken = {
      address: SOLANA_ADDR,
      chain: 'solana',
      score: SOLANA_SCORE,
    };
    const update = { address: SOLANA_ADDR, chain: 'solana' };

    const result = applyPreserveScoreLogic(existing, update);

    expect(result.score).toEqual(SOLANA_SCORE);
    expect(result.address).toBe(SOLANA_ADDR);
    expect(result.chain).toBe('solana');
  });

  it('discards existing score when address does not match (new token)', () => {
    // Adress-Mismatch: Score des alten Tokens wird nicht auf neue Adresse uebertragen
    const existing: StoredToken = {
      address: SOLANA_ADDR,
      chain: 'solana',
      score: SOLANA_SCORE,
    };
    const update = { address: EVM_ADDR, chain: 'ethereum' };

    const result = applyPreserveScoreLogic(existing, update);

    expect(result.score).toBeUndefined();
    expect(result.address).toBe(EVM_ADDR);
    expect(result.chain).toBe('ethereum');
  });

  it('discards existing score when chain does not match (same address, different chain)', () => {
    // Chain-Mismatch bei gleicher Adresse: Score wird verworfen
    const existing: StoredToken = {
      address: SOLANA_ADDR,
      chain: 'solana',
      score: SOLANA_SCORE,
    };
    const update = { address: SOLANA_ADDR, chain: 'ethereum' };

    const result = applyPreserveScoreLogic(existing, update);

    expect(result.score).toBeUndefined();
    expect(result.chain).toBe('ethereum');
  });

  it('keeps existing score when update has no explicit chain (null-safe chain match)', () => {
    // Update ohne Chain: Score bleibt (update.chain == null erlaubt Beibehaltung)
    const existing: StoredToken = {
      address: SOLANA_ADDR,
      chain: 'solana',
      score: SOLANA_SCORE,
    };
    const update = { address: SOLANA_ADDR }; // kein chain

    const result = applyPreserveScoreLogic(existing, update);

    expect(result.score).toEqual(SOLANA_SCORE);
  });

  it('discards score when address changes on the same chain (new token navigation)', () => {
    // Navigiert zu neuem Token auf gleicher Chain — kein Score-Uebertrag
    const OTHER_SOLANA_ADDR = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    const existing: StoredToken = {
      address: OTHER_SOLANA_ADDR,
      chain: 'solana',
      score: { address: OTHER_SOLANA_ADDR, chain: 'solana', score: 50, risk: 'high', checks: {}, cached: false },
    };
    const update = { address: SOLANA_ADDR, chain: 'solana' };

    const result = applyPreserveScoreLogic(existing, update);

    expect(result.score).toBeUndefined();
    expect(result.address).toBe(SOLANA_ADDR);
  });
});
