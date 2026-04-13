import { describe, expect, it } from 'vitest';
import { BaseSwapPlatform } from '../../src/platforms/baseswap';

const TOKEN = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

function makeLocation(overrides: Partial<Location>): Location {
  return {
    hostname: 'baseswap.fi',
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

describe('BaseSwapPlatform', () => {
  const platform = new BaseSwapPlatform();

  describe('matchesLocation', () => {
    it('matches baseswap.fi', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'baseswap.fi' }))).toBe(true);
    });

    it('matches www.baseswap.fi', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'www.baseswap.fi' }))).toBe(true);
    });

    it('does not match other hostnames', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'uniswap.org' }))).toBe(false);
    });
  });

  describe('address extraction via currentAddressPatterns', () => {
    it('extracts address from /info/token/{address}', () => {
      const url = `/info/token/${TOKEN}`;
      const match = url.match(/\/info\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
      expect(match?.[1]).toBe(TOKEN);
    });

    it('extracts address from ?outputCurrency={address}', () => {
      const url = `/swap?outputCurrency=${TOKEN}`;
      const match = url.match(/[?&]outputCurrency=(0x[0-9a-fA-F]{40})/i);
      expect(match?.[1]).toBe(TOKEN);
    });

    it('returns null for URL without token address', () => {
      const url = '/swap?chainId=8453';
      const match1 = url.match(/\/info\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
      const match2 = url.match(/[?&]outputCurrency=(0x[0-9a-fA-F]{40})/i);
      expect(match1).toBeNull();
      expect(match2).toBeNull();
    });
  });

  describe('id/name/chains', () => {
    it('has correct id', () => expect(platform.id).toBe('baseswap'));
    it('has correct name', () => expect(platform.name).toBe('BaseSwap'));
    it('supports only base chain', () => expect(platform.chains).toEqual(['base']));
  });

  describe('detectChainFromUrl', () => {
    it('returns base (fixed chain)', () => {
      expect(platform.detectChainFromUrl(`https://baseswap.fi/swap?outputCurrency=${TOKEN}`)).toBe('base');
    });
  });

  describe('getCurrentPageAddress', () => {
    it('extracts address from /info/token/{address} path', () => {
      window.history.replaceState({}, '', `/info/token/${TOKEN}`);
      expect(platform.getCurrentPageAddress()).toBe(TOKEN);
    });

    it('extracts address from ?outputCurrency={address} query', () => {
      window.history.replaceState({}, '', `/swap?outputCurrency=${TOKEN}`);
      expect(platform.getCurrentPageAddress()).toBe(TOKEN);
    });

    it('returns null for URL without token address', () => {
      window.history.replaceState({}, '', '/swap?chainId=8453');
      expect(platform.getCurrentPageAddress()).toBeNull();
    });
  });
});
