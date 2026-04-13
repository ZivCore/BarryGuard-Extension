import { describe, expect, it } from 'vitest';
import { FourMemePlatform } from '../../src/platforms/four-meme';

const ADDR = '0xaB1234567890aB1234567890aB1234567890aB12';

function makeLocation(pathname: string, hostname = 'four.meme'): Location {
  return { hostname, pathname, search: '', hash: '' } as unknown as Location;
}

describe('FourMemePlatform', () => {
  const platform = new FourMemePlatform();

  it('has correct id, name, chain', () => {
    expect(platform.id).toBe('four-meme');
    expect(platform.name).toBe('four.meme');
    expect(platform.chains).toEqual(['bsc']);
  });

  it('matches four.meme hostname', () => {
    expect(platform.matchesLocation(makeLocation('/'))).toBe(true);
  });

  it('matches www.four.meme hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'www.four.meme'))).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'example.com'))).toBe(false);
  });

  it('extracts address from /token/{address}', () => {
    const loc = makeLocation(`/token/${ADDR}`);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBe(ADDR);
  });

  it('returns null for non-token path', () => {
    const loc = makeLocation('/');
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });
});
