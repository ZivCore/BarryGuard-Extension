import { GenericSolanaPlatform } from './generic-solana';

export class DexScreenerPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'dexscreener',
      name: 'Dexscreener',
      hostPattern: ['*://dexscreener.com/*'],
      hostnames: ['dexscreener.com'],
      currentAddressExtractor: () => {
        for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
          const href = anchor.href;
          const match = href.match(/(?:solscan\.io|birdeye\.so)\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i);
          if (match?.[1]) {
            return match[1];
          }
        }

        return null;
      },
      currentAddressPatterns: [
        /[?&](?:tokenAddress|baseToken|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
      ],
      linkAddressPatterns: [
        /[?&](?:tokenAddress|baseToken|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
      ],
    });
  }
}
