import { GenericEvmPlatform, extractFirstEvmAddress } from './generic-evm';

const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum',
  '56': 'bsc',
  '8453': 'base',
};

export class ParaswapPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'paraswap',
      name: 'Paraswap',
      hostPattern: ['*://app.paraswap.io/*', '*://www.paraswap.io/*'],
      hostnames: ['app.paraswap.io', 'www.paraswap.io'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: (location) => {
        // Hash format: #/{tokenIn}-{tokenOut}/{amount}/SELL?network={chainId}
        const hash = location.hash; // e.g. #/0xABC-ETH/1/SELL?network=1
        if (!hash) {
          return null;
        }

        // Extract tokenIn from the hash path segment
        const hashPath = hash.replace(/^#\//, '');
        const pathMatch = hashPath.match(/^(0x[0-9a-fA-F]{40})/i);
        if (pathMatch?.[1]) {
          return pathMatch[1];
        }

        // Fallback: any EVM address in the full URL
        const fullUrl = `${location.pathname}${location.search}${location.hash}`;
        return extractFirstEvmAddress(fullUrl);
      },
      linkAddressPatterns: [
        /[#/](0x[0-9a-fA-F]{40})/i,
        /[?&](?:token|address)=(0x[0-9a-fA-F]{40})/i,
      ],
      anchorSelectors: [
        'a[href*="0x"]',
        '[data-token-address]',
        '[data-testid*="token"]',
      ],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      // network param may appear in hash query string
      const hashQuery = parsed.hash.includes('?')
        ? new URLSearchParams(parsed.hash.slice(parsed.hash.indexOf('?') + 1))
        : null;
      const networkId =
        hashQuery?.get('network') ??
        parsed.searchParams.get('network');

      if (networkId && CHAIN_ID_MAP[networkId]) {
        return CHAIN_ID_MAP[networkId];
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }
}
