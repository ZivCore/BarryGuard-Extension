import { describe, expect, it } from 'vitest';
import { GmgnEvmPlatform } from '../../src/platforms/gmgn-evm';

const ADDR = '0xaB1234567890aB1234567890aB1234567890aB12';

function makeLocation(pathname: string, hostname = 'gmgn.ai'): Location {
  return { hostname, pathname, search: '', hash: '' } as unknown as Location;
}

describe('GmgnEvmPlatform', () => {
  const platform = new GmgnEvmPlatform();

  it('has correct id, name, chains', () => {
    expect(platform.id).toBe('gmgn-evm');
    expect(platform.name).toBe('GMGN');
    expect(platform.chains).toEqual(['ethereum', 'bsc', 'base']);
  });

  it('matches gmgn.ai hostname', () => {
    expect(platform.matchesLocation(makeLocation('/'))).toBe(true);
  });

  it('matches www.gmgn.ai hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'www.gmgn.ai'))).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'gmgn.xyz'))).toBe(false);
  });

  it.each([
    ['/eth/token/' + ADDR, ADDR, 'ethereum'],
    ['/bsc/token/' + ADDR, ADDR, 'bsc'],
    ['/base/token/' + ADDR, ADDR, 'base'],
  ])('extracts address and chain from %s', (pathname, expectedAddr, expectedChain) => {
    const loc = makeLocation(pathname);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBe(expectedAddr);
    expect(platform.detectChainFromUrl(pathname)).toBe(expectedChain);
  });

  it('ignores /sol/ paths (Solana)', () => {
    const loc = makeLocation('/sol/token/' + ADDR);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for unknown chain slug', () => {
    const loc = makeLocation('/polygon/token/' + ADDR);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for non-token path', () => {
    const loc = makeLocation('/bsc/pairs');
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });
});
