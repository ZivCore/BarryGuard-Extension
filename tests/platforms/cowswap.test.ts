import { describe, expect, it } from 'vitest';
import { CowSwapPlatform } from '../../src/platforms/cowswap';

function makeLocation(hostname: string, pathname: string, search = '', hash = ''): Location {
  return { hostname, pathname, search, hash } as unknown as Location;
}

describe('CowSwapPlatform', () => {
  const platform = new CowSwapPlatform();

  it('has correct id and name', () => {
    expect(platform.id).toBe('cowswap');
    expect(platform.name).toBe('CoW Swap');
  });

  it('supports expected chains (no BSC)', () => {
    expect(platform.chains).toEqual(['ethereum', 'base']);
  });

  it('matchesLocation for swap.cow.fi', () => {
    expect(platform.matchesLocation(makeLocation('swap.cow.fi', '/'))).toBe(true);
  });

  it('does not match unrelated host', () => {
    expect(platform.matchesLocation(makeLocation('cow.fi', '/'))).toBe(false);
  });

  it('extracts tokenIn from ethereum hash (chainId 1)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('swap.cow.fi', '/', '', '#/1/swap/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('extracts tokenIn from base hash (chainId 8453)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('swap.cow.fi', '/', '', '#/8453/swap/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('returns null for gnosis chainId 100 (not supported)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('swap.cow.fi', '/', '', '#/100/swap/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBeNull();
  });

  it('returns null for BSC chainId 56 (not supported)', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('swap.cow.fi', '/', '', '#/56/swap/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(extractor(loc)).toBeNull();
  });

  it('returns null when tokenIn is not a 0x address', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('swap.cow.fi', '/', '', '#/1/swap/ETH/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(extractor(loc)).toBeNull();
  });

  it('returns null for empty hash', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('swap.cow.fi', '/', '', '');
    expect(extractor(loc)).toBeNull();
  });

  it('detectChainFromUrl returns ethereum for chainId 1', () => {
    expect(platform.detectChainFromUrl('https://swap.cow.fi/#/1/swap/0xabc/0xdef')).toBe('ethereum');
  });

  it('detectChainFromUrl returns base for chainId 8453', () => {
    expect(platform.detectChainFromUrl('https://swap.cow.fi/#/8453/swap/0xabc/0xdef')).toBe('base');
  });

  it('detectChainFromUrl returns null for chainId 100 (gnosis)', () => {
    expect(platform.detectChainFromUrl('https://swap.cow.fi/#/100/swap/0xabc/0xdef')).toBeNull();
  });
});
