import { describe, expect, it } from 'vitest';
import { SUPPORTED_PLATFORM_HOST_PATTERNS } from '../../src/background';

function matchesAny(hostname: string): boolean {
  return SUPPORTED_PLATFORM_HOST_PATTERNS.some((re) => re.test(hostname));
}

describe('background SUPPORTED_HOST_PATTERNS', () => {
  it('covers all supported platform hosts (incl. www variants + new platforms)', () => {
    expect(matchesAny('dexscreener.com')).toBe(true);
    expect(matchesAny('www.dexscreener.com')).toBe(true);
    expect(matchesAny('dextools.io')).toBe(true);
    expect(matchesAny('www.dextools.io')).toBe(true);
    expect(matchesAny('dex.coinmarketcap.com')).toBe(true);
    expect(matchesAny('www.coingecko.com')).toBe(true);
  });
});

