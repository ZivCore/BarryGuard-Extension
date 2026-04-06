import { GenericSolanaPlatform } from './generic-solana';

export class CoinMarketCapDexPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'coinmarketcap-dex',
      name: 'CoinMarketCap DEX',
      hostPattern: ['*://dex.coinmarketcap.com/*'],
      hostnames: ['dex.coinmarketcap.com'],
      currentAddressPatterns: [
        // Common DEX token detail routes
        /\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:tokenAddress|address|mint|baseMint|outputMint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:tokenAddress|address|mint|baseMint|outputMint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      detailTargetSelectors: [
        'main h1',
        'main h2',
        'main [data-testid*="token" i] h1',
        'h1',
        'h2',
      ],
      compactBadge: true,
    });
  }
}

