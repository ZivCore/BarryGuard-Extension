import { describe, expect, it } from 'vitest';
import { isSupportedExtensionHost } from '../../src/manifest/platform-hosts';

describe('isSupportedExtensionHost', () => {
  it('covers all supported platform hosts (incl. www variants + new platforms)', () => {
    expect(isSupportedExtensionHost('https://dexscreener.com/solana/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://www.dexscreener.com/solana/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://dextools.io/app/en/token')).toBe(true);
    expect(isSupportedExtensionHost('https://www.dextools.io/app/en/token')).toBe(true);
    expect(isSupportedExtensionHost('https://dex.coinmarketcap.com/token/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://www.coingecko.com/en/coins/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://solscan.io/token/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://pro.solscan.io/token/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://pump.fun/coin/abc')).toBe(true);
    expect(isSupportedExtensionHost('https://unsupported-site.com/token/abc')).toBe(false);
  });

  // Test 18 — sample per chain + multi-chain + negatives
  it.each([
    // Solana
    ['https://pump.fun/coin/So11111111111111111111111111111111111111112', true],
    ['https://raydium.io/liquidity/', true],
    ['https://solscan.io/token/So11111111111111111111111111111111111111112', true],
    // Ethereum
    ['https://app.uniswap.org/#/swap', true],
    ['https://etherscan.io/token/0x0000000000000000000000000000000000000001', true],
    // BSC
    ['https://pancakeswap.finance/swap', true],
    ['https://bscscan.com/token/0x0000000000000000000000000000000000000001', true],
    // Base
    ['https://aerodrome.finance/swap', true],
    ['https://basescan.org/token/0x0000000000000000000000000000000000000001', true],
    // Multi-chain
    ['https://dexscreener.com/solana/So11111111111111111111111111111111111111112', true],
    ['https://geckoterminal.com/solana/pools/abc', true],
    ['https://gopluslabs.io/token-security/1/0x0000000000000000000000000000000000000001', true],
    // Negatives
    ['https://example.com/token/abc', false],
    ['https://google.com/search?q=token', false],
    ['chrome://extensions/', false],
  ] as [string, boolean][])('18: isSupportedExtensionHost(%s) → %s', (url, expected) => {
    expect(isSupportedExtensionHost(url)).toBe(expected);
  });
});

