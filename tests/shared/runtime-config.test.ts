import { describe, expect, it } from 'vitest';
import {
  getAccountUrl,
  getAppBaseUrl,
  getForgotPasswordUrl,
  getOAuthUrl,
  getPricingUrl,
  sanitizeAppNavigationUrl,
  sanitizeCustomerPortalUrl,
  sanitizeExplorerUrl,
  sanitizeExternalNavigationUrl,
} from '../../src/shared/runtime-config';

describe('runtime-config navigation hardening', () => {
  it('uses secure default app URLs', () => {
    expect(getAppBaseUrl()).toBe('https://www.barryguard.com');
    expect(getPricingUrl()).toBe('https://www.barryguard.com/pricing');
    expect(getAccountUrl()).toBe('https://www.barryguard.com/dashboard/account');
    expect(getForgotPasswordUrl()).toBe('https://www.barryguard.com/forgot-password');
    expect(getOAuthUrl('google')).toBe('https://www.barryguard.com/auth/google?extension=true');
  });

  it('accepts only same-origin app navigation URLs', () => {
    expect(sanitizeAppNavigationUrl('https://www.barryguard.com/auth/google?extension=true'))
      .toBe('https://www.barryguard.com/auth/google?extension=true');
    expect(sanitizeAppNavigationUrl('https://evil.example/auth/google')).toBeNull();
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
