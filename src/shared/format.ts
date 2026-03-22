/**
 * Shorten a Solana address for display: `BHvsujaa...8qtdDtTpump`
 * ADR-008: single source of truth for address formatting.
 */
export function shortenAddress(address: string, start = 6, end = 6): string {
  if (address.length <= start + end + 3) return address
  return `${address.slice(0, start)}...${address.slice(-end)}`
}
