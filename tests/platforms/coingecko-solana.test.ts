import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinGeckoSolanaPlatform } from '../../src/platforms/coingecko-solana';

const SOLANA_MINT = 'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump';
const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('CoinGeckoSolanaPlatform — Solana (existing)', () => {
  it('matches /chains/solana path', () => {
    const p = new CoinGeckoSolanaPlatform();
    expect(
      p.matchesLocation({ hostname: 'www.coingecko.com', pathname: '/chains/solana' } as Location),
    ).toBe(true);
  });

  it('matches /de/chains/solana locale-prefixed path', () => {
    const p = new CoinGeckoSolanaPlatform();
    expect(
      p.matchesLocation({ hostname: 'www.coingecko.com', pathname: '/de/chains/solana' } as Location),
    ).toBe(true);
  });

  it('does not match /chains/ethereum path via matchesLocation', () => {
    const p = new CoinGeckoSolanaPlatform();
    // /chains/ethereum is not a Solana chain page, but /coins/ pages are now matched
    expect(
      p.matchesLocation({ hostname: 'www.coingecko.com', pathname: '/chains/ethereum' } as Location),
    ).toBe(false);
  });

  it('extracts Solana mint from Solscan explorer link', () => {
    const p = new CoinGeckoSolanaPlatform();
    window.history.replaceState({}, '', '/chains/solana');
    document.body.innerHTML = `<a href="https://solscan.io/token/${SOLANA_MINT}">Explorer</a>`;
    expect(p.extractTokenAddresses()).toContain(SOLANA_MINT);
  });

  it('id stays coingecko-solana for backward compat', () => {
    const p = new CoinGeckoSolanaPlatform();
    expect(p.id).toBe('coingecko-solana');
  });

  it('exposes all four chains', () => {
    const p = new CoinGeckoSolanaPlatform();
    expect(p.chains).toEqual(['solana', 'ethereum', 'bsc', 'base']);
  });
});

describe('CoinGeckoSolanaPlatform — /coins/{slug} EVM pages (new)', () => {
  it('matchesLocation returns true for /coins/{slug}', () => {
    const p = new CoinGeckoSolanaPlatform();
    expect(
      p.matchesLocation({ hostname: 'www.coingecko.com', pathname: '/coins/usd-coin' } as Location),
    ).toBe(true);
  });

  it('matchesLocation returns true for locale-prefixed /en/coins/{slug}', () => {
    const p = new CoinGeckoSolanaPlatform();
    expect(
      p.matchesLocation({ hostname: 'www.coingecko.com', pathname: '/en/coins/usd-coin' } as Location),
    ).toBe(true);
  });

  it('extracts EVM Ethereum address from DOM contract block', () => {
    const p = new CoinGeckoSolanaPlatform();
    window.history.replaceState({}, '', '/coins/usd-coin');
    document.body.innerHTML = `
      <div class="contract">
        <span>Ethereum</span>
        <span>${ETH_ADDR}</span>
      </div>
    `;
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts EVM BSC address from DOM contract block', () => {
    const p = new CoinGeckoSolanaPlatform();
    window.history.replaceState({}, '', '/coins/tether-bsc');
    document.body.innerHTML = `
      <div class="contract">
        <span>BNB Smart Chain</span>
        <span>${BSC_ADDR}</span>
      </div>
    `;
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts EVM Base address from DOM contract block', () => {
    const p = new CoinGeckoSolanaPlatform();
    window.history.replaceState({}, '', '/coins/usd-base-coin');
    document.body.innerHTML = `
      <div class="contract">
        <span>Base</span>
        <span>${BASE_ADDR}</span>
      </div>
    `;
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns Solana mint on /coins/ page when chain label is Solana', () => {
    const p = new CoinGeckoSolanaPlatform();
    window.history.replaceState({}, '', '/coins/bonk');
    // No EVM address in DOM — falls back to Solscan link (Solana path)
    document.body.innerHTML = `<a href="https://solscan.io/token/${SOLANA_MINT}">Solscan</a>`;
    // EVM extraction returns null (no 0x address), Solana fallback kicks in
    expect(p.extractTokenAddresses()).toContain(SOLANA_MINT);
  });

  it('returns null when chain label is unknown and no EVM address', () => {
    const p = new CoinGeckoSolanaPlatform();
    window.history.replaceState({}, '', '/coins/unknown-token');
    document.body.innerHTML = `<div><span>Polygon</span><span>${ETH_ADDR}</span></div>`;
    // Polygon is not a supported chain → EVM extractor returns null, no Solana links either
    expect(p.getCurrentPageAddress()).toBeNull();
  });
});
