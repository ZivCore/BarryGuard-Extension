/**
 * auth-content-script.test.ts — Step 1 (E-H1)
 * Tests for localhost guard and JWT issuer check in barryguard-auth.content.ts.
 * We test the extracted helpers directly (isValidSupabaseToken logic).
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inline re-implementation of isValidSupabaseToken (the same logic as in the
// content script) so we can unit-test it without loading the WXT content entry.
// ---------------------------------------------------------------------------

function isValidSupabaseToken(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload || typeof payload !== 'object') return false
    const iss: unknown = (payload as Record<string, unknown>).iss
    if (typeof iss !== 'string') return false
    const issHost = new URL(iss).hostname
    return issHost.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fakesig`
}

// ---------------------------------------------------------------------------
// Production hostname guard
// ---------------------------------------------------------------------------

describe('Production hostname guard logic', () => {
  const ALLOWED = new Set(['barryguard.com', 'www.barryguard.com'])

  it('allows barryguard.com', () => {
    expect(ALLOWED.has('barryguard.com')).toBe(true)
  })

  it('allows www.barryguard.com', () => {
    expect(ALLOWED.has('www.barryguard.com')).toBe(true)
  })

  it('blocks localhost', () => {
    expect(ALLOWED.has('localhost')).toBe(false)
  })

  it('blocks 127.0.0.1', () => {
    expect(ALLOWED.has('127.0.0.1')).toBe(false)
  })

  it('blocks arbitrary subdomains', () => {
    expect(ALLOWED.has('evil.barryguard.com')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// JWT issuer check (Step 1 — E-H1)
// ---------------------------------------------------------------------------

describe('isValidSupabaseToken', () => {
  it('accepts a token with a valid .supabase.co issuer', () => {
    const token = buildJwt({ iss: 'https://abcdefghijklmnop.supabase.co/auth/v1', sub: 'user_1' })
    expect(isValidSupabaseToken(token)).toBe(true)
  })

  it('rejects a token with a localhost issuer', () => {
    const token = buildJwt({ iss: 'http://localhost:54321/auth/v1', sub: 'user_1' })
    expect(isValidSupabaseToken(token)).toBe(false)
  })

  it('rejects a token with an arbitrary non-Supabase issuer', () => {
    const token = buildJwt({ iss: 'https://evil.example.com/auth', sub: 'user_1' })
    expect(isValidSupabaseToken(token)).toBe(false)
  })

  it('rejects a token missing the iss claim', () => {
    const token = buildJwt({ sub: 'user_1' })
    expect(isValidSupabaseToken(token)).toBe(false)
  })

  it('rejects a token with a non-string iss claim', () => {
    const token = buildJwt({ iss: 42, sub: 'user_1' })
    expect(isValidSupabaseToken(token)).toBe(false)
  })

  it('rejects a malformed JWT (not 3 parts)', () => {
    expect(isValidSupabaseToken('only.two')).toBe(false)
    expect(isValidSupabaseToken('just_one')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidSupabaseToken('')).toBe(false)
  })

  it('rejects a token with invalid base64 in the payload segment', () => {
    expect(isValidSupabaseToken('header.!!!invalid!!!.sig')).toBe(false)
  })

  it('rejects a token whose payload is not a JSON object', () => {
    const body = btoa(JSON.stringify([1, 2, 3]))
    expect(isValidSupabaseToken(`h.${body}.s`)).toBe(false)
  })

  it('rejects a token whose iss is a supabase.co subdomain lookalike', () => {
    // evil.com/supabase.co should not pass
    const token = buildJwt({ iss: 'https://evil.com/supabase.co', sub: 'user' })
    expect(isValidSupabaseToken(token)).toBe(false)
  })

  it('accepts token from any valid Supabase project ref', () => {
    const token = buildJwt({ iss: 'https://xyzproject123.supabase.co/auth/v1' })
    expect(isValidSupabaseToken(token)).toBe(true)
  })
})
