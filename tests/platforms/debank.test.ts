import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeBankPlatform } from '../../src/platforms/debank';

const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('DeBankPlatform', () => {
  it('matches debank.com hostnames', () => {
    const p = new DeBankPlatform();
    expect(p.matchesLocation({ hostname: 'debank.com' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.debank.com' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new DeBankPlatform();
    expect(p.matchesLocation({ hostname: 'zerion.io' } as Location)).toBe(false);
  });

  it('extracts address from /tokens/1/{address} (Ethereum)', () => {
    const p = new DeBankPlatform();
    window.history.replaceState({}, '', `/tokens/1/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /tokens/56/{address} (BSC)', () => {
    const p = new DeBankPlatform();
    window.history.replaceState({}, '', `/tokens/56/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /tokens/8453/{address} (Base)', () => {
    const p = new DeBankPlatform();
    window.history.replaceState({}, '', `/tokens/8453/${BASE_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for non-token URL', () => {
    const p = new DeBankPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('detectChainFromUrl returns ethereum for chain id 1', () => {
    const p = new DeBankPlatform();
    expect(p.detectChainFromUrl(`https://debank.com/tokens/1/${ETH_ADDR}`)).toBe('ethereum');
  });

  it('detectChainFromUrl returns bsc for chain id 56', () => {
    const p = new DeBankPlatform();
    expect(p.detectChainFromUrl(`https://debank.com/tokens/56/${BSC_ADDR}`)).toBe('bsc');
  });

  it('detectChainFromUrl returns base for chain id 8453', () => {
    const p = new DeBankPlatform();
    expect(p.detectChainFromUrl(`https://debank.com/tokens/8453/${BASE_ADDR}`)).toBe('base');
  });

  it('detectChainFromUrl returns null for unknown chain id', () => {
    const p = new DeBankPlatform();
    expect(p.detectChainFromUrl(`https://debank.com/tokens/137/${ETH_ADDR}`)).toBeNull();
  });

  it('detectChainFromUrl returns null for non-token URL', () => {
    const p = new DeBankPlatform();
    expect(p.detectChainFromUrl('https://debank.com/profile/0xabc')).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new DeBankPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('exposes correct host patterns', () => {
    const p = new DeBankPlatform();
    expect(p.hostPattern).toContain('*://debank.com/*');
    expect(p.hostPattern).toContain('*://www.debank.com/*');
  });
});
