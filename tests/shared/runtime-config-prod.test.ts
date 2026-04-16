/**
 * runtime-config-prod.test.ts — Step 8 (E-M7)
 * Tests that allowLocalHttp is effectively false in production builds.
 *
 * The existing runtime-config.test.ts covers the general URL sanitization.
 * This file specifically covers the production build guard (IS_DEV_BUILD = false).
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeAppNavigationUrl,
  sanitizeCustomerPortalUrl,
  getAppBaseUrl,
} from '../../src/shared/runtime-config'

// In the test environment import.meta.env.MODE is 'test' (not 'development'),
// so IS_DEV_BUILD resolves to false — production semantics apply.

describe('runtime-config — production build: localhost HTTP is always rejected (E-M7)', () => {
  it('sanitizeAppNavigationUrl rejects http://localhost in production', () => {
    const result = sanitizeAppNavigationUrl('http://localhost:3000/dashboard')
    expect(result).toBeNull()
  })

  it('sanitizeAppNavigationUrl rejects http://127.0.0.1 in production', () => {
    const result = sanitizeAppNavigationUrl('http://127.0.0.1:3000/account')
    expect(result).toBeNull()
  })

  it('sanitizeCustomerPortalUrl rejects http://localhost in production', () => {
    const result = sanitizeCustomerPortalUrl('http://localhost:3000/portal')
    expect(result).toBeNull()
  })

  it('getAppBaseUrl returns the production https URL', () => {
    const url = getAppBaseUrl()
    expect(url.startsWith('https://')).toBe(true)
    expect(url).not.toContain('localhost')
  })

  it('sanitizeAppNavigationUrl accepts https barryguard.com URLs', () => {
    const result = sanitizeAppNavigationUrl('https://www.barryguard.com/dashboard')
    expect(result).toBe('https://www.barryguard.com/dashboard')
  })

  it('sanitizeAppNavigationUrl rejects arbitrary https URLs not from barryguard.com', () => {
    const result = sanitizeAppNavigationUrl('https://evil.example.com/malicious')
    expect(result).toBeNull()
  })

  it('sanitizeCustomerPortalUrl accepts billing.stripe.com in production', () => {
    const result = sanitizeCustomerPortalUrl('https://billing.stripe.com/p/login/test')
    expect(result).toBe('https://billing.stripe.com/p/login/test')
  })

  it('sanitizeCustomerPortalUrl rejects http://billing.stripe.com (non-https)', () => {
    const result = sanitizeCustomerPortalUrl('http://billing.stripe.com/p/login/test')
    expect(result).toBeNull()
  })

  it('sanitizeAppNavigationUrl rejects data: URLs', () => {
    const result = sanitizeAppNavigationUrl('data:text/html,<script>alert(1)</script>')
    expect(result).toBeNull()
  })

  it('sanitizeAppNavigationUrl rejects javascript: URLs', () => {
    const result = sanitizeAppNavigationUrl('javascript:alert(1)')
    expect(result).toBeNull()
  })
})
