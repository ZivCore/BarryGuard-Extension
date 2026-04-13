import { describe, expect, it } from 'vitest';
import { PoocoinPlatform } from '../../src/platforms/poocoin';

const ADDR = '0xaB1234567890aB1234567890aB1234567890aB12';

function makeLocation(pathname: string, hostname = 'poocoin.app'): Location {
  return { hostname, pathname, search: '', hash: '' } as unknown as Location;
}

describe('PoocoinPlatform', () => {
  const platform = new PoocoinPlatform();

  it('has correct id, name, chain', () => {
    expect(platform.id).toBe('poocoin');
    expect(platform.name).toBe('Poocoin');
    expect(platform.chains).toEqual(['bsc']);
  });

  it('matches poocoin.app hostname', () => {
    expect(platform.matchesLocation(makeLocation('/'))).toBe(true);
  });

  it('matches www.poocoin.app hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'www.poocoin.app'))).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'dextools.io'))).toBe(false);
  });

  it('extracts address from /tokens/{address}', () => {
    const loc = makeLocation(`/tokens/${ADDR}`);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBe(ADDR);
  });

  it('returns null for non-token path', () => {
    const loc = makeLocation('/');
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for /token/ (singular) — wrong path', () => {
    const loc = makeLocation(`/token/${ADDR}`);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });
});
