import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeckoTerminalPlatform } from '../../src/platforms/geckoterminal';
import { AveAiPlatform } from '../../src/platforms/ave-ai';
import { DexViewPlatform } from '../../src/platforms/dexview';

const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// GeckoTerminal
// ---------------------------------------------------------------------------
describe('GeckoTerminalPlatform', () => {
  it('matches geckoterminal.com hostname', () => {
    const p = new GeckoTerminalPlatform();
    expect(p.matchesLocation({ hostname: 'geckoterminal.com' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.geckoterminal.com' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new GeckoTerminalPlatform();
    expect(p.matchesLocation({ hostname: 'coingecko.com' } as Location)).toBe(false);
  });

  it('extracts address from /eth/tokens/{address}', () => {
    const p = new GeckoTerminalPlatform();
    window.history.replaceState({}, '', `/eth/tokens/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /bsc/pools/{address}', () => {
    const p = new GeckoTerminalPlatform();
    window.history.replaceState({}, '', `/bsc/pools/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /base/tokens/{address}', () => {
    const p = new GeckoTerminalPlatform();
    window.history.replaceState({}, '', `/base/tokens/${BASE_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for unknown chain slug', () => {
    const p = new GeckoTerminalPlatform();
    window.history.replaceState({}, '', `/solana/tokens/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-token URL', () => {
    const p = new GeckoTerminalPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new GeckoTerminalPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });
});

// ---------------------------------------------------------------------------
// Ave.ai
// ---------------------------------------------------------------------------
describe('AveAiPlatform', () => {
  it('matches ave.ai hostname', () => {
    const p = new AveAiPlatform();
    expect(p.matchesLocation({ hostname: 'ave.ai' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.ave.ai' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new AveAiPlatform();
    expect(p.matchesLocation({ hostname: 'dexscreener.com' } as Location)).toBe(false);
  });

  it('extracts address from /token/{address}-eth', () => {
    const p = new AveAiPlatform();
    window.history.replaceState({}, '', `/token/${ETH_ADDR}-eth`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /token/{address}-bsc', () => {
    const p = new AveAiPlatform();
    window.history.replaceState({}, '', `/token/${BSC_ADDR}-bsc`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /token/{address}-base', () => {
    const p = new AveAiPlatform();
    window.history.replaceState({}, '', `/token/${BASE_ADDR}-base`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for unknown chain slug', () => {
    const p = new AveAiPlatform();
    window.history.replaceState({}, '', `/token/${ETH_ADDR}-arbitrum`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-token URL', () => {
    const p = new AveAiPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new AveAiPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });
});

// ---------------------------------------------------------------------------
// DexView
// ---------------------------------------------------------------------------
describe('DexViewPlatform', () => {
  it('matches dexview.com hostname', () => {
    const p = new DexViewPlatform();
    expect(p.matchesLocation({ hostname: 'dexview.com' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.dexview.com' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new DexViewPlatform();
    expect(p.matchesLocation({ hostname: 'dextools.io' } as Location)).toBe(false);
  });

  it('extracts address from /ethereum/{address}', () => {
    const p = new DexViewPlatform();
    window.history.replaceState({}, '', `/ethereum/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /bsc/{address}', () => {
    const p = new DexViewPlatform();
    window.history.replaceState({}, '', `/bsc/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /base/{address}', () => {
    const p = new DexViewPlatform();
    window.history.replaceState({}, '', `/base/${BASE_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for unknown chain slug', () => {
    const p = new DexViewPlatform();
    window.history.replaceState({}, '', `/polygon/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-token URL', () => {
    const p = new DexViewPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new DexViewPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });
});
