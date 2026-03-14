import { describe, expect, it } from 'vitest';
import {
  getAccountUrl,
  getAppBaseUrl,
  getForgotPasswordUrl,
  getLoginUrl,
  normalizeOAuthNavigationUrl,
  getPricingUrl,
  sanitizeAppNavigationUrl,
  sanitizeCustomerPortalUrl,
  sanitizeExplorerUrl,
  sanitizeExternalNavigationUrl,
  sanitizeOAuthNavigationUrl,
} from '../../src/shared/runtime-config';

describe('runtime-config navigation hardening', () => {
  it('uses secure default app URLs', () => {
    expect(getAppBaseUrl()).toBe('https://www.barryguard.com');
    expect(getPricingUrl()).toBe('https://www.barryguard.com/pricing');
    expect(getAccountUrl()).toBe('https://www.barryguard.com/dashboard/account');
    expect(getForgotPasswordUrl()).toBe('https://www.barryguard.com/forgot-password');
    expect(getLoginUrl()).toBe('https://www.barryguard.com/login');
  });

  it('accepts only same-origin app navigation URLs', () => {
    expect(sanitizeAppNavigationUrl('https://www.barryguard.com/dashboard/account'))
      .toBe('https://www.barryguard.com/dashboard/account');
    expect(sanitizeAppNavigationUrl('https://evil.example/auth/google')).toBeNull();
  });

  it('allows trusted OAuth navigation URLs from app, Google, and Supabase', () => {
    expect(sanitizeOAuthNavigationUrl('https://www.barryguard.com/login'))
      .toBe('https://www.barryguard.com/login');
    expect(sanitizeOAuthNavigationUrl('https://accounts.google.com/o/oauth2/v2/auth'))
      .toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(sanitizeOAuthNavigationUrl('https://project-ref.supabase.co/auth/v1/authorize?provider=google'))
      .toBe('https://project-ref.supabase.co/auth/v1/authorize?provider=google');
    expect(sanitizeOAuthNavigationUrl('https://evil.example/oauth')).toBeNull();
  });

  it('rejects legacy app oauth routes that are known to be invalid', () => {
    expect(normalizeOAuthNavigationUrl('https://www.barryguard.com/auth/google?extension=true', 'google'))
      .toBeNull();
    expect(normalizeOAuthNavigationUrl('https://www.barryguard.com/api/auth/google', 'google'))
      .toBeNull();
  });

  it('limits customer portal URLs to trusted hosts', () => {
    expect(sanitizeCustomerPortalUrl('https://billing.stripe.com/p/login/test'))
      .toBe('https://billing.stripe.com/p/login/test');
    expect(sanitizeCustomerPortalUrl('https://www.barryguard.com/dashboard/account'))
      .toBe('https://www.barryguard.com/dashboard/account');
    expect(sanitizeCustomerPortalUrl('https://evil.example/portal')).toBeNull();
  });

  it('blocks unsafe or untrusted explorer and external URLs', () => {
    expect(sanitizeExplorerUrl('https://solscan.io/token/test')).toBe('https://solscan.io/token/test');
    expect(sanitizeExplorerUrl('https://evil.example/token/test')).toBeNull();
    expect(sanitizeExternalNavigationUrl('javascript:alert(1)')).toBeNull();
  });
});
