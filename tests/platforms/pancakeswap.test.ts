import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PancakeSwapPlatform } from '../../src/platforms/pancakeswap-app';

const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('PancakeSwapPlatform', () => {
  it('matches pancakeswap.finance hostnames', () => {
    const p = new PancakeSwapPlatform();
    expect(p.matchesLocation({ hostname: 'pancakeswap.finance' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.pancakeswap.finance' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new PancakeSwapPlatform();
    expect(p.matchesLocation({ hostname: 'uniswap.org' } as Location)).toBe(false);
  });

  it('exposes chains including ethereum', () => {
    const p = new PancakeSwapPlatform();
    expect(p.chains).toContain('bsc');
    expect(p.chains).toContain('ethereum');
    expect(p.chains).toContain('base');
  });

  // ── Address extraction ──────────────────────────────────────────────────────

  it('extracts address from /tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    window.history.replaceState({}, '', `/tokens/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /info/tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    window.history.replaceState({}, '', `/info/tokens/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /info/ethereum/tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    window.history.replaceState({}, '', `/info/ethereum/tokens/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /info/base/tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    window.history.replaceState({}, '', `/info/base/tokens/${BASE_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('extracts address from query param ?address=', () => {
    const p = new PancakeSwapPlatform();
    window.history.replaceState({}, '', `/swap?chain=eth&address=${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  // ── Chain detection ──────────────────────────────────────────────────────────

  it('detectChainFromUrl returns ethereum for ?chain=eth', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/swap?chain=eth&address=${ETH_ADDR}`)).toBe('ethereum');
  });

  it('detectChainFromUrl returns ethereum for ?chain=ethereum', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/swap?chain=ethereum&address=${ETH_ADDR}`)).toBe('ethereum');
  });

  it('detectChainFromUrl returns base for ?chain=base', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/swap?chain=base&address=${BASE_ADDR}`)).toBe('base');
  });

  it('detectChainFromUrl returns bsc for ?chain=bnb', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/swap?chain=bnb&address=${BSC_ADDR}`)).toBe('bsc');
  });

  it('detectChainFromUrl returns ethereum for /info/ethereum/tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/info/ethereum/tokens/${ETH_ADDR}`)).toBe('ethereum');
  });

  it('detectChainFromUrl returns bsc for /info/bsc/tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/info/bsc/tokens/${BSC_ADDR}`)).toBe('bsc');
  });

  it('detectChainFromUrl returns base for /info/base/tokens/{address}', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/info/base/tokens/${BASE_ADDR}`)).toBe('base');
  });

  it('detectChainFromUrl returns base for bare /base/ path (legacy)', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/base/tokens/${BASE_ADDR}`)).toBe('base');
  });

  it('detectChainFromUrl returns null when no chain indicator present (ADR-007)', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/tokens/${BSC_ADDR}`)).toBeNull();
  });

  it('detectChainFromUrl returns null for unknown query chain slug', () => {
    const p = new PancakeSwapPlatform();
    expect(p.detectChainFromUrl(`/swap?chain=arbitrum&address=${ETH_ADDR}`)).toBeNull();
  });
});
