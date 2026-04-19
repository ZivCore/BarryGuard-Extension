// Spiegelt config.json → chains.*.enabled. Bei Chain-Erweiterung (z.B. polygon, arbitrum) muss dieses Set synchron erweitert werden.
const SUPPORTED = new Set(['solana', 'ethereum', 'bsc', 'base']);

export function buildCheckUrl(chain: string | undefined | null, address: string): string | null {
  const normalized = typeof chain === 'string' ? chain.toLowerCase() : '';
  if (SUPPORTED.has(normalized) && address.length > 0) {
    return `https://barryguard.com/check/${normalized}/${address}`;
  }
  // Strict mode — kein Adress-Heuristik-Fallback. Chain MUSS aus TokenScore.chain bzw. WatchlistAlert.chain kommen (beide Pflichtfelder aus dem Backend). null hier bedeutet Backend-Bug oder Legacy-Cache-Row ohne Chain (ADR-007: kein Workaround im Client).
  return null;
}
