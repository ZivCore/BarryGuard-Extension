import { describe, expect, it } from 'vitest';
import { ParaswapPlatform } from '../../src/platforms/paraswap';

const TOKEN = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

function makeLocation(overrides: Partial<Location>): Location {
  return {
    hostname: 'app.paraswap.io',
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

describe('ParaswapPlatform', () => {
  const platform = new ParaswapPlatform();

  describe('matchesLocation', () => {
    it('matches app.paraswap.io', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'app.paraswap.io' }))).toBe(true);
    });

    it('matches www.paraswap.io', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'www.paraswap.io' }))).toBe(true);
    });

    it('does not match other hostnames', () => {
      expect(platform.matchesLocation(makeLocation({ hostname: 'uniswap.org' }))).toBe(false);
    });
  });

  describe('detectChainFromUrl', () => {
    it('detects ethereum via network=1 in hash query', () => {
      expect(
        platform.detectChainFromUrl(`https://app.paraswap.io/#/${TOKEN}-ETH/1/SELL?network=1`),
      ).toBe('ethereum');
    });

    it('detects bsc via network=56', () => {
      expect(
        platform.detectChainFromUrl(`https://app.paraswap.io/#/${TOKEN}-BNB/1/SELL?network=56`),
      ).toBe('bsc');
    });

    it('detects base via network=8453', () => {
      expect(
        platform.detectChainFromUrl(`https://app.paraswap.io/#/${TOKEN}-ETH/1/SELL?network=8453`),
      ).toBe('base');
    });

    it('returns null for unknown network id', () => {
      expect(
        platform.detectChainFromUrl(`https://app.paraswap.io/#/${TOKEN}-ETH/1/SELL?network=999`),
      ).toBeNull();
    });

    it('returns null when network param is missing', () => {
      expect(
        platform.detectChainFromUrl(`https://app.paraswap.io/#/${TOKEN}-ETH/1/SELL`),
      ).toBeNull();
    });
  });

  describe('id/name/chains', () => {
    it('has correct id', () => expect(platform.id).toBe('paraswap'));
    it('has correct name', () => expect(platform.name).toBe('Paraswap'));
    it('supports expected chains', () => {
      expect(platform.chains).toEqual(['ethereum', 'bsc', 'base']);
    });
  });

  describe('getCurrentPageAddress via currentAddressExtractor', () => {
    it('extracts tokenIn from hash for ethereum (network=1)', () => {
      window.history.replaceState({}, '', `/#/${TOKEN}-ETH/1/SELL?network=1`);
      expect(platform.getCurrentPageAddress()).toBe(TOKEN);
    });

    it('extracts tokenIn from hash for bsc (network=56)', () => {
      window.history.replaceState({}, '', `/#/${TOKEN}-BNB/1/SELL?network=56`);
      expect(platform.getCurrentPageAddress()).toBe(TOKEN);
    });

    it('extracts tokenIn from hash for base (network=8453)', () => {
      window.history.replaceState({}, '', `/#/${TOKEN}-USDbC/1/SELL?network=8453`);
      expect(platform.getCurrentPageAddress()).toBe(TOKEN);
    });

    it('returns null when hash has no 0x address', () => {
      window.history.replaceState({}, '', '/#/ETH-BNB/1/SELL?network=1');
      expect(platform.getCurrentPageAddress()).toBeNull();
    });
  });
});
