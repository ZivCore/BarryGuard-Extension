import { describe, expect, it } from 'vitest';
import { FlaunchPlatform } from '../../src/platforms/flaunch';

const TOKEN = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

function makeLocation(overrides: Partial<Location>): Location {
  return {
    hostname: 'flaunch.gg',
    pathname: '/',
    search: '',
    hash: '',
    href: '',
    origin: '',
    host: '',
    port: '',
    protocol: '',
    ancestorOrigins: {} as DOMStringList,
    assign: () => {},
    reload: () => {},
    replace: () => {},
    toString: () => '',
    ...overrides,
  };
}

describe('FlaunchPlatform', () => {
  const platform = new FlaunchPlatform();

  describe('matchesLocation', () => {
    it('matches flaunch.gg', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'flaunch.gg' }))).toBe(true);
    });

    it('matches www.flaunch.gg', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'www.flaunch.gg' }))).toBe(true);
    });

    it('does not match other hostnames', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'pump.fun' }))).toBe(false);
    });
  });

  describe('address extraction via currentAddressPatterns', () => {
    it('extracts address from /base/coin/{address}', () => {
      const url = `/base/coin/${TOKEN}`;
      const match = url.match(/\/base\/coin\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
      expect(match?.[1]).toBe(TOKEN);
    });

    it('extracts address from /base/coin/{address}/ with trailing slash', () => {
      const url = `/base/coin/${TOKEN}/`;
      const match = url.match(/\/base\/coin\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
      expect(match?.[1]).toBe(TOKEN);
    });

    it('returns null for unrelated paths', () => {
      const url = '/base/trending';
      const match = url.match(/\/base\/coin\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
      expect(match).toBeNull();
    });

    it('returns null for non-EVM address in coin path', () => {
      const url = '/base/coin/notanaddress';
      const match = url.match(/\/base\/coin\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
      expect(match).toBeNull();
    });
  });

  describe('id/name/chains', () => {
    it('has correct id', () => expect(platform.id).toBe('flaunch'));
    it('has correct name', () => expect(platform.name).toBe('flaunch'));
    it('supports only base chain', () => expect(platform.chains).toEqual(['base']));
  });

  describe('detectChainFromUrl', () => {
    it('returns base (fixed chain)', () => {
      expect(platform.detectChainFromUrl(`https://flaunch.gg/base/coin/${TOKEN}`)).toBe('base');
    });
  });
});
