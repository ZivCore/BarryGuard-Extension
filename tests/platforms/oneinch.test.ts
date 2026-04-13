import { describe, expect, it } from 'vitest';
import { OneInchPlatform } from '../../src/platforms/oneinch';

function makeLocation(hostname: string, pathname: string, search = '', hash = ''): Location {
  return { hostname, pathname, search, hash } as unknown as Location;
}

describe('OneInchPlatform', () => {
  const platform = new OneInchPlatform();

  it('has correct id and name', () => {
    expect(platform.id).toBe('oneinch');
    expect(platform.name).toBe('1inch');
  });

  it('supports expected chains', () => {
    expect(platform.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('matchesLocation for app.1inch.io', () => {
    expect(platform.matchesLocation(makeLocation('app.1inch.io', '/'))).toBe(true);
  });

  it('does not match unrelated host', () => {
    expect(platform.matchesLocation(makeLocation('1inch.io', '/'))).toBe(false);
  });

  it('extracts tokenIn from ethereum hash (chainId 1)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('app.1inch.io', '/', '', '#/1/simple/swap/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('extracts tokenIn from bsc hash (chainId 56)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('app.1inch.io', '/', '', '#/56/simple/swap/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBe('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
  });

  it('extracts tokenIn from base hash (chainId 8453)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('app.1inch.io', '/', '', '#/8453/simple/swap/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('returns null for unknown chainId', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('app.1inch.io', '/', '', '#/137/simple/swap/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBeNull();
  });

  it('returns null when tokenIn is not a 0x address', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('app.1inch.io', '/', '', '#/1/simple/swap/ETH/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(extractor(loc)).toBeNull();
  });

  it('returns null for missing hash', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('app.1inch.io', '/', '', '');
    expect(extractor(loc)).toBeNull();
  });

  it('detectChainFromUrl returns ethereum for chainId 1', () => {
    expect(platform.detectChainFromUrl('https://app.1inch.io/#/1/simple/swap/0xabc/0xdef')).toBe('ethereum');
  });

  it('detectChainFromUrl returns bsc for chainId 56', () => {
    expect(platform.detectChainFromUrl('https://app.1inch.io/#/56/simple/swap/0xabc/0xdef')).toBe('bsc');
  });

  it('detectChainFromUrl returns base for chainId 8453', () => {
    expect(platform.detectChainFromUrl('https://app.1inch.io/#/8453/simple/swap/0xabc/0xdef')).toBe('base');
  });

  it('detectChainFromUrl returns null for unsupported chainId', () => {
    expect(platform.detectChainFromUrl('https://app.1inch.io/#/137/simple/swap/0xabc/0xdef')).toBeNull();
  });
});
