import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HoneypotIsPlatform } from '../../src/platforms/honeypot-is';

const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
  });
  document.body.innerHTML = '';
});

describe('HoneypotIsPlatform', () => {
  it('matches honeypot.is hostname', () => {
    const p = new HoneypotIsPlatform();
    expect(p.matchesLocation({ hostname: 'honeypot.is' } as Location)).toBe(true);
    expect(p.matchesLocation({ hostname: 'www.honeypot.is' } as Location)).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    const p = new HoneypotIsPlatform();
    expect(p.matchesLocation({ hostname: 'etherscan.io' } as Location)).toBe(false);
  });

  it('extracts address from ?address=...&chain=ethereum', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', `/?address=${ETH_ADDR}&chain=ethereum`);
    expect(p.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('extracts address from ?address=...&chain=bsc', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', `/?address=${BSC_ADDR}&chain=bsc`);
    expect(p.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('extracts address from ?address=...&chain=base', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', `/?address=${BASE_ADDR}&chain=base`);
    expect(p.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('returns null for unknown chain slug', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', `/?address=${ETH_ADDR}&chain=polygon`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null when address param is missing', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', '/?chain=ethereum');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null when chain param is missing', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', `/?address=${ETH_ADDR}`);
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-matching URL', () => {
    const p = new HoneypotIsPlatform();
    window.history.replaceState({}, '', '/');
    expect(p.getCurrentPageAddress()).toBeNull();
  });

  it('exposes correct chains', () => {
    const p = new HoneypotIsPlatform();
    expect(p.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('exposes correct id and name', () => {
    const p = new HoneypotIsPlatform();
    expect(p.id).toBe('honeypot-is');
    expect(p.name).toBe('Honeypot.is');
  });
});
