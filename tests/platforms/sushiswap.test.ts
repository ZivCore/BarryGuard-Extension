import { describe, expect, it } from 'vitest';
import { SushiSwapPlatform } from '../../src/platforms/sushiswap';

function makeLocation(hostname: string, pathname: string, search = '', hash = ''): Location {
  return { hostname, pathname, search, hash } as unknown as Location;
}

describe('SushiSwapPlatform', () => {
  const platform = new SushiSwapPlatform();

  it('has correct id and name', () => {
    expect(platform.id).toBe('sushiswap');
    expect(platform.name).toBe('SushiSwap');
  });

  it('supports expected chains', () => {
    expect(platform.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('matchesLocation for www.sushi.com', () => {
    expect(platform.matchesLocation(makeLocation('www.sushi.com', '/'))).toBe(true);
  });

  it('matchesLocation for sushi.com', () => {
    expect(platform.matchesLocation(makeLocation('sushi.com', '/'))).toBe(true);
  });

  it('does not match unrelated host', () => {
    expect(platform.matchesLocation(makeLocation('sushiswap.org', '/'))).toBe(false);
  });

  it('extracts address from /ethereum/swap?token1=', () => {
    const loc = makeLocation('www.sushi.com', '/ethereum/swap', '?token1=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    // currentAddressExtractor is tested via getCurrentPageAddress which reads window.location
    // So we call the extractor directly via the config path by wrapping in a fake window.location
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor;
    expect(extractor).toBeDefined();
    expect(extractor!(loc)).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('extracts address from /bsc/swap?token1=', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('www.sushi.com', '/bsc/swap', '?token1=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
    expect(extractor(loc)).toBe('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
  });

  it('extracts address from /base/pool/ path', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('www.sushi.com', '/base/pool/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(extractor(loc)).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('returns null for unknown chain slug', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('www.sushi.com', '/polygon/swap', '?token1=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(extractor(loc)).toBeNull();
  });

  it('returns null when token1 is not a valid EVM address', () => {
    const extractor = (platform as unknown as { currentAddressExtractor?: (l: Location) => string | null }).currentAddressExtractor!;
    const loc = makeLocation('www.sushi.com', '/ethereum/swap', '?token1=ETH');
    expect(extractor(loc)).toBeNull();
  });

  it('detectChainFromUrl returns ethereum', () => {
    expect(platform.detectChainFromUrl('https://www.sushi.com/ethereum/swap')).toBe('ethereum');
  });

  it('detectChainFromUrl returns bsc', () => {
    expect(platform.detectChainFromUrl('https://www.sushi.com/bsc/swap')).toBe('bsc');
  });

  it('detectChainFromUrl returns base', () => {
    expect(platform.detectChainFromUrl('https://www.sushi.com/base/swap')).toBe('base');
  });

  it('detectChainFromUrl returns null for unknown chain', () => {
    expect(platform.detectChainFromUrl('https://www.sushi.com/solana/swap')).toBeNull();
  });
});
