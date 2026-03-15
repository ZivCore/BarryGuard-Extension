import { GenericSolanaPlatform } from './generic-solana';
import { pickPreferredSolanaAddress } from './address-helpers';

const COMMON_SOLANA_QUOTES = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD2c3YQm6P88GJEqn3EjjqY',
]);

export class PumpSwapPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'pumpswap',
      name: 'PumpSwap',
      hostPattern: ['*://amm.pump.fun/*', '*://swap.pump.fun/*', '*://pump.fun/*'],
      hostnames: ['amm.pump.fun', 'swap.pump.fun', 'pump.fun'],
      currentAddressExtractor: (location) => {
        const params = new URLSearchParams(location.search);
        return pickPreferredSolanaAddress(
          [
            params.get('outputMint'),
            params.get('inputMint'),
            params.get('baseMint'),
            params.get('quoteMint'),
            params.get('mint'),
            params.get('tokenAddress'),
          ],
          COMMON_SOLANA_QUOTES,
        );
      },
      currentAddressPatterns: [
        /\/(?:swap|trade|token)\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:outputMint|inputMint|baseMint|quoteMint|mint|tokenAddress)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/(?:swap|trade|token)\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:outputMint|inputMint|baseMint|quoteMint|mint|tokenAddress)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }

  matchesLocation(location: Location): boolean {
    return location.hostname === 'amm.pump.fun'
      || location.hostname === 'swap.pump.fun'
      || (location.hostname === 'pump.fun' && /(swap|advanced|trade)/i.test(location.pathname + location.search));
  }
}
