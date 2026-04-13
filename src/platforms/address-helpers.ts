const SOLANA_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

function extractSolanaAddresses(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.match(SOLANA_ADDRESS_RE) ?? [];
}

export function extractFirstSolanaAddress(value: string | null | undefined): string | null {
  return extractSolanaAddresses(value)[0] ?? null;
}

export function dedupeAddresses(addresses: Iterable<string>): string[] {
  return [...new Set(Array.from(addresses).filter(Boolean))];
}

export function pickPreferredSolanaAddress(
  candidates: Array<string | null | undefined>,
  ignoredAddresses: Iterable<string> = [],
): string | null {
  const ignored = new Set(Array.from(ignoredAddresses));
  const deduped = dedupeAddresses(candidates.filter((value): value is string => typeof value === 'string'));
  return deduped.find((candidate) => !ignored.has(candidate)) ?? deduped[0] ?? null;
}
