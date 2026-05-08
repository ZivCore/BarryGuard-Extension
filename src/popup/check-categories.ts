// src/popup/check-categories.ts
// Plan token-check-display-bugs-bluechip-and-scam, Step 12: Category-Map
// eliminated. Extension reads category directly from the Backend response
// (ADR-007: Extension is not the source of truth for categorisation).

export type CheckCategory = 'contract' | 'marketStructure' | 'behavior';

/**
 * Extract the category from a raw check object supplied by the Backend.
 * Returns the category when valid; logs a warning and returns null when the
 * field is absent or unrecognised (graceful degrade for version mismatches).
 */
export function getCategoryFromRawCheck(rawCheck: { category?: unknown }): CheckCategory | null {
  const cat = rawCheck.category;
  if (cat === 'contract' || cat === 'marketStructure' || cat === 'behavior') {
    return cat;
  }
  console.warn(`[BarryGuard] getCategoryFromRawCheck: unknown category "${String(cat)}" — check will be skipped for tab counting`);
  return null;
}

export const CATEGORY_LABEL: Record<CheckCategory, string> = {
  contract: 'Contract',
  marketStructure: 'Market',
  behavior: 'Behavior',
};

export const CATEGORY_ORDER: CheckCategory[] = ['contract', 'marketStructure', 'behavior'];
