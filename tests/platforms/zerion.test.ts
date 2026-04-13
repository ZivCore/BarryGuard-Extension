import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZerionPlatform } from '../../src/platforms/zerion';

const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('ZerionPlatform', () => {
  it('matches app.zerion.io, zerion.io, and www.zerion.io', () => {
    const p = new ZerionPlatform();
    expect(p.matchesLocation({ hostname: 'app.zerion.io' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'zerion.io' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.zerion.io' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new ZerionPlatform();
    expect(p.matchesLocation({ hostname: 'debank.com' } as Location)).toBe(false);
  });

  it('extracts address from /tokens/{address}-ethereum', () => {
    const p = new ZerionPlatform();
    window.history.replaceState({}, '', `/tokens/${ETH_ADDR}-ethereum`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /tokens/{address}-bsc', () => {
    const p = new ZerionPlatform();
    window.history.replaceState({}, '', `/tokens/${BSC_ADDR}-bsc`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /tokens/{address}-base', () => {
    const p = new ZerionPlatform();
    window.history.replaceState({}, '', `/tokens/${BASE_ADDR}-base`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for non-token URL', () => {
    const p = new ZerionPlatform();
    window.history.replaceState({}, '', '/portfolio');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for unsupported chain slug', () => {
    const p = new ZerionPlatform();
    window.history.replaceState({}, '', `/tokens/${ETH_ADDR}-arbitrum`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('detectChainFromUrl returns ethereum', () => {
    const p = new ZerionPlatform();
    expect(p.detectChainFromUrl(`https://app.zerion.io/tokens/${ETH_ADDR}-ethereum`)).toBe('ethereum');
  });

  it('detectChainFromUrl returns bsc', () => {
    const p = new ZerionPlatform();
    expect(p.detectChainFromUrl(`https://app.zerion.io/tokens/${BSC_ADDR}-bsc`)).toBe('bsc');
  });

  it('detectChainFromUrl returns base', () => {
    const p = new ZerionPlatform();
    expect(p.detectChainFromUrl(`https://app.zerion.io/tokens/${BASE_ADDR}-base`)).toBe('base');
  });

  it('detectChainFromUrl returns null for unsupported chain', () => {
    const p = new ZerionPlatform();
    expect(p.detectChainFromUrl(`https://app.zerion.io/tokens/${ETH_ADDR}-arbitrum`)).toBeNull();
  });

  it('detectChainFromUrl returns null for non-token URL', () => {
    const p = new ZerionPlatform();
    expect(p.detectChainFromUrl('https://app.zerion.io/portfolio')).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new ZerionPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('exposes correct host patterns', () => {
    const p = new ZerionPlatform();
    expect(p.hostPattern).toContain('*://app.zerion.io/*');
    expect(p.hostPattern).toContain('*://zerion.io/*');
    expect(p.hostPattern).toContain('*://www.zerion.io/*');
  });
});
