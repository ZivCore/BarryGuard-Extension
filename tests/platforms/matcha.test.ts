import { describe, expect, it } from 'vitest';
import { MatchaPlatform } from '../../src/platforms/matcha';

function makeLocation(hostname: string, pathname: string, search = '', hash = ''): Location {
  return { hostname, pathname, search, hash } as unknown as Location;
}

describe('MatchaPlatform', () => {
  const platform = new MatchaPlatform();

  it('has correct id and name', () => {
    expect(platform.id).toBe('matcha');
    expect(platform.name).toBe('Matcha');
  });

  it('supports expected chains', () => {
    expect(platform.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('matchesLocation for matcha.xyz', () => {
    expect(platform.matchesLocation(makeLocation('matcha.xyz', '/'))).toBe(true);
  });

  it('matchesLocation for www.matcha.xyz', () => {
    expect(platform.matchesLocation(makeLocation('www.matcha.xyz', '/'))).toBe(true);
  });

  it('does not match unrelated host', () => {
    expect(platform.matchesLocation(makeLocation('notmatcha.xyz', '/'))).toBe(false);
  });

  it('extracts address from /tokens/ethereum/{address}', () => {
    const url = '/tokens/ethereum/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const match = url.match(/\/tokens\/(?:ethereum|bsc|base)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
    expect(match?.[1]).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('extracts address from /tokens/bsc/{address}', () => {
    const url = '/tokens/bsc/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const match = url.match(/\/tokens\/(?:ethereum|bsc|base)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
    expect(match?.[1]).toBe('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
  });

  it('extracts address from /tokens/base/{address}', () => {
    const url = '/tokens/base/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const match = url.match(/\/tokens\/(?:ethereum|bsc|base)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
    expect(match?.[1]).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('does not match unknown chain slug', () => {
    const url = '/tokens/polygon/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const match = url.match(/\/tokens\/(?:ethereum|bsc|base)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
    expect(match).toBeNull();
  });

  it('does not match non-token path', () => {
    const url = '/swap?sellToken=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const match = url.match(/\/tokens\/(?:ethereum|bsc|base)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
    expect(match).toBeNull();
  });

  it('detectChainFromUrl returns ethereum', () => {
    expect(platform.detectChainFromUrl('https://matcha.xyz/tokens/ethereum/0xabc')).toBe('ethereum');
  });

  it('detectChainFromUrl returns bsc', () => {
    expect(platform.detectChainFromUrl('https://matcha.xyz/tokens/bsc/0xabc')).toBe('bsc');
  });

  it('detectChainFromUrl returns base', () => {
    expect(platform.detectChainFromUrl('https://matcha.xyz/tokens/base/0xabc')).toBe('base');
  });

  it('detectChainFromUrl returns null for unknown chain', () => {
    expect(platform.detectChainFromUrl('https://matcha.xyz/tokens/polygon/0xabc')).toBeNull();
  });

  it('getCurrentPageAddress extracts address from /tokens/ethereum/{address}', () => {
    const ETH_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    window.history.replaceState({}, '', `/tokens/ethereum/${ETH_ADDR}`);
    expect(platform.getCurrentPageAddress()).toBe(ETH_ADDR);
  });

  it('getCurrentPageAddress extracts address from /tokens/bsc/{address}', () => {
    const BSC_ADDR = '0x55d398326f99059fF775485246999027B3197955';
    window.history.replaceState({}, '', `/tokens/bsc/${BSC_ADDR}`);
    expect(platform.getCurrentPageAddress()).toBe(BSC_ADDR);
  });

  it('getCurrentPageAddress extracts address from /tokens/base/{address}', () => {
    const BASE_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    window.history.replaceState({}, '', `/tokens/base/${BASE_ADDR}`);
    expect(platform.getCurrentPageAddress()).toBe(BASE_ADDR);
  });

  it('getCurrentPageAddress returns null for unknown slug', () => {
    window.history.replaceState({}, '', '/tokens/polygon/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(platform.getCurrentPageAddress()).toBeNull();
  });
});
