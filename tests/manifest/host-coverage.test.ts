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
import { UniswapPlatform } from '../../src/platforms/uniswap-app';
import { PancakeSwapPlatform } from '../../src/platforms/pancakeswap-app';
import { AerodromePlatform } from '../../src/platforms/aerodrome-app';
import { EtherscanPlatform } from '../../src/platforms/etherscan';
import { BscscanPlatform } from '../../src/platforms/bscscan';
import { BasescanPlatform } from '../../src/platforms/basescan';
import { GoPlusPlatform } from '../../src/platforms/goplus';
import { TokenSnifferPlatform } from '../../src/platforms/tokensniffer';
import { HoneypotIsPlatform } from '../../src/platforms/honeypot-is';
import { GeckoTerminalPlatform } from '../../src/platforms/geckoterminal';
import { AveAiPlatform } from '../../src/platforms/ave-ai';
import { DexViewPlatform } from '../../src/platforms/dexview';
import { SushiSwapPlatform } from '../../src/platforms/sushiswap';
import { OneInchPlatform } from '../../src/platforms/oneinch';
import { MatchaPlatform } from '../../src/platforms/matcha';
import { CowSwapPlatform } from '../../src/platforms/cowswap';
import { ParaswapPlatform } from '../../src/platforms/paraswap';
import { BaseSwapPlatform } from '../../src/platforms/baseswap';
import { FlaunchPlatform } from '../../src/platforms/flaunch';
import { FourMemePlatform } from '../../src/platforms/four-meme';
import { GmgnEvmPlatform } from '../../src/platforms/gmgn-evm';
import { PoocoinPlatform } from '../../src/platforms/poocoin';
import { VirtualsPlatform } from '../../src/platforms/virtuals';
import { DeBankPlatform } from '../../src/platforms/debank';
import { ZerionPlatform } from '../../src/platforms/zerion';

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
  new UniswapPlatform(),
  new PancakeSwapPlatform(),
  new AerodromePlatform(),
  new EtherscanPlatform(),
  new BscscanPlatform(),
  new BasescanPlatform(),
  new GoPlusPlatform(),
  new TokenSnifferPlatform(),
  new HoneypotIsPlatform(),
  new GeckoTerminalPlatform(),
  new AveAiPlatform(),
  new DexViewPlatform(),
  new SushiSwapPlatform(),
  new OneInchPlatform(),
  new MatchaPlatform(),
  new CowSwapPlatform(),
  new ParaswapPlatform(),
  new BaseSwapPlatform(),
  new FlaunchPlatform(),
  new FourMemePlatform(),
  new GmgnEvmPlatform(),
  new PoocoinPlatform(),
  new VirtualsPlatform(),
  new DeBankPlatform(),
  new ZerionPlatform(),
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

