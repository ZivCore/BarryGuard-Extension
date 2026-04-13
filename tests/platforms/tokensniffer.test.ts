import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenSnifferPlatform } from '../../src/platforms/tokensniffer';

const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('TokenSnifferPlatform', () => {
  it('matches tokensniffer.com hostname', () => {
    const p = new TokenSnifferPlatform();
    expect(p.matchesLocation({ hostname: 'tokensniffer.com' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.tokensniffer.com' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new TokenSnifferPlatform();
    expect(p.matchesLocation({ hostname: 'etherscan.io' } as Location)).toBe(false);
  });

  it('extracts address from /token/eth/{address} (ethereum)', () => {
    const p = new TokenSnifferPlatform();
    window.history.replaceState({}, '', `/token/eth/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from /token/bsc/{address} (bsc)', () => {
    const p = new TokenSnifferPlatform();
    window.history.replaceState({}, '', `/token/bsc/${BSC_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from /token/base/{address} (base)', () => {
    const p = new TokenSnifferPlatform();
    window.history.replaceState({}, '', `/token/base/${BASE_ADDR}`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for unknown chain slug', () => {
    const p = new TokenSnifferPlatform();
    window.history.replaceState({}, '', `/token/polygon/${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-matching URL', () => {
    const p = new TokenSnifferPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new TokenSnifferPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('exposes correct id and name', () => {
    const p = new TokenSnifferPlatform();
    expect(p.id).toBe('tokensniffer');
    expect(p.name).toBe('TokenSniffer');
  });
});
