import { describe, expect, it } from 'vitest';
import { VirtualsPlatform } from '../../src/platforms/virtuals';

const ADDR = '0xaB1234567890aB1234567890aB1234567890aB12';

function makeLocation(pathname: string, hostname = 'app.virtuals.io'): Location {
  return { hostname, pathname, search: '', hash: '' } as unknown as Location;
}

describe('VirtualsPlatform', () => {
  const platform = new VirtualsPlatform();

  it('has correct id, name, chain', () => {
    expect(platform.id).toBe('virtuals');
    expect(platform.name).toBe('Virtuals');
    expect(platform.chains).toEqual(['base']);
  });

  it.each([
    ['app.virtuals.io'],
    ['www.virtuals.io'],
    ['virtuals.io'],
  ])('matches %s hostname', (hostname) => {
    expect(platform.matchesLocation(makeLocation('/', hostname))).toBe(true);
  });

  it('does not match unrelated hostname', () => {
    expect(platform.matchesLocation(makeLocation('/', 'virtuals.xyz'))).toBe(false);
  });

  it('extracts address from /prototypes/{address}', () => {
    const loc = makeLocation(`/prototypes/${ADDR}`);
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBe(ADDR);
  });

  it('returns null for /virtuals/{id} path (DOM-based, not supported)', () => {
    const loc = makeLocation('/virtuals/42');
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });

  it('returns null for root path', () => {
    const loc = makeLocation('/');
    Object.defineProperty(global, 'window', { value: { location: loc }, writable: true });
    expect(platform.getCurrentPageAddress()).toBeNull();
  });
});
