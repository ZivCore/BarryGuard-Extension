/**
 * Tests for popup/check-categories.ts (Extension / Vitest)
 *
 * Plan token-check-display-bugs-bluechip-and-scam, Step 12 (Wave 6):
 *   - CHECK_CATEGORY_MAP eliminated; Extension reads category from Backend.
 *   - getCategoryFromRawCheck returns valid CheckCategory or null.
 *
 * ADR-002: no token hardcodes.
 * ADR-007: Extension is not the source of truth for categorisation.
 * ADR-015: Unit-Test-Pflicht.
 */

import { describe, expect, it } from 'vitest'
import * as checkCategories from '../check-categories'
import { getCategoryFromRawCheck, CATEGORY_LABEL, CATEGORY_ORDER } from '../check-categories'

// ---------------------------------------------------------------------------
// getCategoryFromRawCheck
// ---------------------------------------------------------------------------

describe('getCategoryFromRawCheck — valid categories', () => {
  it('returns "contract" for category=contract', () => {
    expect(getCategoryFromRawCheck({ category: 'contract' })).toBe('contract')
  })

  it('returns "marketStructure" for category=marketStructure', () => {
    expect(getCategoryFromRawCheck({ category: 'marketStructure' })).toBe('marketStructure')
  })

  it('returns "behavior" for category=behavior', () => {
    expect(getCategoryFromRawCheck({ category: 'behavior' })).toBe('behavior')
  })
})

describe('getCategoryFromRawCheck — unknown/absent category', () => {
  it('returns null for an unknown category string', () => {
    expect(getCategoryFromRawCheck({ category: 'unknown_future_value' })).toBeNull()
  })

  it('returns null when category field is absent', () => {
    expect(getCategoryFromRawCheck({})).toBeNull()
  })

  it('returns null when category is undefined', () => {
    expect(getCategoryFromRawCheck({ category: undefined })).toBeNull()
  })

  it('returns null when category is null', () => {
    expect(getCategoryFromRawCheck({ category: null })).toBeNull()
  })

  it('returns null for numeric category', () => {
    expect(getCategoryFromRawCheck({ category: 42 })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CATEGORY_LABEL
// ---------------------------------------------------------------------------

describe('CATEGORY_LABEL map', () => {
  it('contract → "Contract"', () => {
    expect(CATEGORY_LABEL['contract']).toBe('Contract')
  })

  it('marketStructure → "Market"', () => {
    expect(CATEGORY_LABEL['marketStructure']).toBe('Market')
  })

  it('behavior → "Behavior"', () => {
    expect(CATEGORY_LABEL['behavior']).toBe('Behavior')
  })
})

// ---------------------------------------------------------------------------
// CATEGORY_ORDER
// ---------------------------------------------------------------------------

describe('CATEGORY_ORDER', () => {
  it('has exactly 3 entries', () => {
    expect(CATEGORY_ORDER).toHaveLength(3)
  })

  it('starts with contract', () => {
    expect(CATEGORY_ORDER[0]).toBe('contract')
  })

  it('ends with behavior', () => {
    expect(CATEGORY_ORDER[2]).toBe('behavior')
  })
})

// ---------------------------------------------------------------------------
// CHECK_CATEGORY_MAP removed in Wave 6 (Plan Step 12)
// Verify the export does NOT exist (ADR-007: Backend is the source of truth)
// ---------------------------------------------------------------------------

describe('CHECK_CATEGORY_MAP eliminated (Wave 6)', () => {
  it('CHECK_CATEGORY_MAP is not exported from check-categories', () => {
    expect((checkCategories as Record<string, unknown>)['CHECK_CATEGORY_MAP']).toBeUndefined()
  })

  it('CHECK_CATEGORY is not exported from check-categories', () => {
    expect((checkCategories as Record<string, unknown>)['CHECK_CATEGORY']).toBeUndefined()
  })
})
