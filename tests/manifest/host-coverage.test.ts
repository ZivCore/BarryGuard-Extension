import { describe, expect, it } from 'vitest';
import { PLATFORM_HOST_PATTERNS } from '../../src/manifest/platform-hosts';
import { PumpFunPlatform } from '../../src/platforms/pumpfun';
import { PumpSwapPlatform } from '../../src/platforms/pumpswap';
import { RaydiumPlatform } from '../../src/platforms/raydium';
import { LetsBonkPlatform } from '../../src/platforms/letsbonk';
import { MoonshotPlatform } from '../../src/platforms/moonshot';
import { DexScreenerPlatform } from '../../src/platforms/dexscreener';
import { DextoolsPlatform } from '../../src/platforms/dextools';
import { BirdeyePlatform } from '../../src/platforms/birdeye';
import { BagsPlatform } from '../../src/platforms/bags';
import { SolscanPlatform } from '../../src/platforms/solscan';
import { CoinMarketCapDexPlatform } from '../../src/platforms/coinmarketcap-dex';
import { CoinGeckoSolanaPlatform } from '../../src/platforms/coingecko-solana';

const PLATFORMS = [
  new PumpSwapPlatform(),
  new PumpFunPlatform(),
  new RaydiumPlatform(),
  new LetsBonkPlatform(),
  new MoonshotPlatform(),
  new DexScreenerPlatform(),
  new DextoolsPlatform(),
  new BirdeyePlatform(),
  new BagsPlatform(),
  new SolscanPlatform(),
  new CoinMarketCapDexPlatform(),
  new CoinGeckoSolanaPlatform(),
];

describe('manifest coverage for platform hosts', () => {
  it('covers all platform adapter host patterns in host_permissions + content script matches', () => {
    const hostPatterns = [...PLATFORM_HOST_PATTERNS];
    expect(Array.isArray(hostPatterns)).toBe(true);

    for (const platform of PLATFORMS) {
      for (const pattern of platform.hostPattern) {
        expect(hostPatterns).toContain(pattern);
      }
    }
  });
});

