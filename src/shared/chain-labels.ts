// src/shared/chain-labels.ts
// Human-readable labels for chains that appear in URLs but are not supported
// by the BarryGuard backend. Mirrors the backend chain mapping.

export const UNSUPPORTED_CHAIN_LABELS: Record<string, string> = {
  pulsechain: 'PulseChain',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  optimism: 'Optimism',
  fantom: 'Fantom',
  cronos: 'Cronos',
  linea: 'Linea',
  scroll: 'Scroll',
  zksync: 'zkSync Era',
  blast: 'Blast',
};

/**
 * Returns the human-readable label for a URL chain segment that is not
 * supported by BarryGuard, or null if the segment is unknown.
 */
export function getUnsupportedChainLabel(chainSegment: string): string | null {
  return UNSUPPORTED_CHAIN_LABELS[chainSegment.toLowerCase()] ?? null;
}
