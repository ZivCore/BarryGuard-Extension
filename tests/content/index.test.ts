import { describe, expect, it } from 'vitest';
import {
  getCurrentPageAddress,
  selectAddressesForTier,
  shouldApplySelectedTokenScore,
  shouldRetryTokenScoreFetch,
} from '../../src/content/index';

describe('content tier gating', () => {
  it('extracts the current token address from a coin pathname', () => {
    expect(getCurrentPageAddress('/coin/Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump')).toBe(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
    );
  });

  it('extracts the current token address from a root pathname', () => {
    expect(getCurrentPageAddress('/Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump')).toBe(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
    );
  });

  it('extracts the current token address from swap query params', () => {
    expect(
      getCurrentPageAddress('/swap?inputMint=So11111111111111111111111111111111111111112&outputMint=Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump'),
    ).toBe('Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump');
  });

  it('returns first 3 as active and rest as locked for the free tier on list pages', () => {
    expect(
      selectAddressesForTier(
        ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
        null,
        'free',
      ),
    ).toEqual({ active: ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'], locked: [] });
  });

  it('returns only the current coin for the free tier on detail pages', () => {
    expect(
      selectAddressesForTier(
        [
          'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
          '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        ],
        'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
        'free',
      ),
    ).toEqual({ active: ['Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump'], locked: [] });
  });

  it('keeps full list scoring for paid tiers', () => {
    const addresses = [
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    ];

    expect(selectAddressesForTier(addresses, null, 'rescue_pass')).toEqual({ active: addresses, locked: [] });
    expect(selectAddressesForTier(addresses, null, 'pro')).toEqual({ active: addresses, locked: [] });
  });

  it('returns first 3 as active and the rest as locked for free tier with many tokens', () => {
    const addresses = Array.from({ length: 7 }, (_, i) => `Addr${i}${'x'.repeat(38 - String(i).length)}`);
    const result = selectAddressesForTier(addresses, null, 'free');
    expect(result.active).toHaveLength(3);
    expect(result.locked).toHaveLength(4);
    expect(result.active).toEqual(addresses.slice(0, 3));
    expect(result.locked).toEqual(addresses.slice(3));
  });

  it('returns empty active and locked when no addresses (free tier, list page)', () => {
    expect(selectAddressesForTier([], null, 'free')).toEqual({ active: [], locked: [] });
  });

  it('retries transient score fetch failures on the current token page', () => {
    expect(shouldRetryTokenScoreFetch(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      { success: false, statusCode: 404, error: 'Token not found yet' },
    )).toBe(true);
  });

  it('retries generic server failures on the current token page', () => {
    expect(shouldRetryTokenScoreFetch(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      { success: false, errorType: 'server', error: 'BarryGuard API returned malformed token score data.' },
    )).toBe(true);
  });

  it('does not retry non-transient failures', () => {
    expect(shouldRetryTokenScoreFetch(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      { success: false, statusCode: 403, errorType: 'plan_gate', error: 'Forbidden' },
    )).toBe(false);
  });

  it('applies a stored selected token score for the current token page', () => {
    expect(shouldApplySelectedTokenScore(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      {
        address: 'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
        metadata: {},
        score: {
          address: 'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
          chain: 'solana',
          score: 72,
          risk: 'low',
          checks: {},
          cached: false,
        },
      },
    )).toBe(true);
  });

  it('ignores stored selected token updates for another token page', () => {
    expect(shouldApplySelectedTokenScore(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        metadata: {},
        score: {
          address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          chain: 'solana',
          score: 18,
          risk: 'high',
          checks: {},
          cached: false,
        },
      },
    )).toBe(false);
  });
});
