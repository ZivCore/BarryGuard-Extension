import { describe, expect, it } from 'vitest';
import { getCurrentPageAddress, selectAddressesForTier } from '../../src/content/index';

describe('content tier gating', () => {
  it('extracts the current token address from a coin pathname', () => {
    expect(getCurrentPageAddress('/coin/Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump')).toBe(
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
    );
  });

  it('returns no list addresses for the free tier on non-coin pages', () => {
    expect(
      selectAddressesForTier(
        ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
        '/',
        'free',
      ),
    ).toEqual([]);
  });

  it('returns only the current coin for the free tier on detail pages', () => {
    expect(
      selectAddressesForTier(
        [
          'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
          '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        ],
        '/coin/Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
        'free',
      ),
    ).toEqual(['Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump']);
  });

  it('keeps full list scoring for paid tiers', () => {
    const addresses = [
      'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump',
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    ];

    expect(selectAddressesForTier(addresses, '/', 'rescue_pass')).toEqual(addresses);
    expect(selectAddressesForTier(addresses, '/', 'pro')).toEqual(addresses);
  });
});
