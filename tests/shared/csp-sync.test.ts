/**
 * csp-sync.test.ts — Step 2 (E-H2)
 * Verifies that CSP_API_HOSTS contains all required API hosts and that
 * every entry is a valid HTTPS URL (no bare hostnames, no HTTP).
 */

import { describe, it, expect } from 'vitest'
import { CSP_API_HOSTS } from '../../src/shared/csp-hosts'

describe('CSP_API_HOSTS integrity', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CSP_API_HOSTS)).toBe(true)
    expect(CSP_API_HOSTS.length).toBeGreaterThan(0)
  })

  it('every entry is a valid https URL', () => {
    for (const entry of CSP_API_HOSTS) {
      let url: URL
      try {
        url = new URL(entry)
      } catch {
        throw new Error(`CSP_API_HOSTS contains invalid URL: "${entry}"`)
      }
      expect(url.protocol).toBe('https:')
    }
  })

  it('contains api.dexscreener.com (required by E-H2 for pair resolution)', () => {
    const hasDexscreener = CSP_API_HOSTS.some(h => h.includes('api.dexscreener.com'))
    expect(hasDexscreener).toBe(true)
  })

  it('has no duplicate entries', () => {
    const uniq = new Set(CSP_API_HOSTS)
    expect(uniq.size).toBe(CSP_API_HOSTS.length)
  })

  it('has no HTTP-only entries (all must be https)', () => {
    const httpEntries = CSP_API_HOSTS.filter(h => h.startsWith('http:'))
    expect(httpEntries).toHaveLength(0)
  })

  it('has no bare hostnames (must be full URLs)', () => {
    const bare = CSP_API_HOSTS.filter(h => !h.startsWith('http'))
    expect(bare).toHaveLength(0)
  })
})
