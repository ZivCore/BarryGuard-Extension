import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoPlusPlatform } from '../../src/platforms/goplus';

const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('GoPlusPlatform', () => {
  it('matches gopluslabs.io hostname', () => {
    const p = new GoPlusPlatform();
    expect(p.matchesLocation({ hostname: 'gopluslabs.io' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.gopluslabs.io' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new GoPlusPlatform();
    expect(p.matchesLocation({ hostname: 'etherscan.io' } as Location)).toBe(false);
  });

  it('extracts address from /token-security/1/{address} (ethereum)', () => {
    const p = new GoPlusPlatform();
    window.history.replaceState({}, '', `/token-security/1/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /token-security/56/{address} (bsc)', () => {
    const p = new GoPlusPlatform();
    window.history.replaceState({}, '', `/token-security/56/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /token-security/8453/{address} (base)', () => {
    const p = new GoPlusPlatform();
    window.history.replaceState({}, '', `/token-security/8453/${BASE_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for unknown chain id', () => {
    const p = new GoPlusPlatform();
    window.history.replaceState({}, '', `/token-security/137/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-matching URL', () => {
    const p = new GoPlusPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new GoPlusPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('exposes correct id and name', () => {
    const p = new GoPlusPlatform();
    expect(p.id).toBe('goplus');
    expect(p.name).toBe('GoPlus');
  });
});
