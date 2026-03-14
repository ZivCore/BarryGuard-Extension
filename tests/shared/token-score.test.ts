import { describe, expect, it } from 'vitest';
import { extractTokenScores, sanitizeTokenScore } from '../../src/shared/token-score';

describe('sanitizeTokenScore', () => {
  it('returns a normalized token score for valid payloads', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      cached: true,
      token: {
        name: 'Token A',
        symbol: '$TKNA',
      },
      checks: {
        mintAuthority: {
          status: 'success',
          value: false,
          label: 'Mint Authority',
          description: 'No one can mint additional tokens.',
          tier: 'free',
        },
      },
    })).toEqual({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      cached: true,
      token: {
        name: 'Token A',
        symbol: '$TKNA',
      },
      checks: {
        mintAuthority: {
          status: 'success',
          value: false,
          label: 'Mint Authority',
          description: 'No one can mint additional tokens.',
          tier: 'free',
        },
      },
    });
  });

  it('rejects malformed score values instead of coercing them into the DOM', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: '<img src=x onerror=alert(1)>',
      risk: 'low',
      checks: {},
    })).toBeNull();
  });

  it('rejects scores whose address does not match the requested token', () => {
    expect(sanitizeTokenScore({
      address: 'So11111111111111111111111111111111111111112',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {},
    }, {
      expectedAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    })).toBeNull();
  });

  it('rejects non-solana chains and invalid addresses', () => {
    expect(sanitizeTokenScore({
      address: 'not-a-solana-address',
      chain: 'ethereum',
      score: 84,
      risk: 'low',
      checks: {},
    })).toBeNull();
  });
});

describe('extractTokenScores', () => {
  it('extracts nested list scores and skips malformed entries', () => {
    expect(extractTokenScores({
      data: {
        results: [
          {
            address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            chain: 'solana',
            score: 84,
            risk: 'low',
            checks: {},
          },
          {
            address: 'bad',
            chain: 'solana',
            score: '84',
            risk: 'low',
            checks: {},
          },
        ],
      },
    })).toEqual([
      {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        chain: 'solana',
        score: 84,
        risk: 'low',
        cached: false,
        checks: {},
      },
    ]);
  });

  it('filters extracted scores to the requested address set', () => {
    expect(extractTokenScores({
      results: [
        {
          address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          chain: 'solana',
          score: 84,
          risk: 'low',
          checks: {},
        },
        {
          address: 'So11111111111111111111111111111111111111112',
          chain: 'solana',
          score: 65,
          risk: 'medium',
          checks: {},
        },
      ],
    }, {
      allowedAddresses: ['So11111111111111111111111111111111111111112'],
    })).toEqual([
      {
        address: 'So11111111111111111111111111111111111111112',
        chain: 'solana',
        score: 65,
        risk: 'medium',
        cached: false,
        checks: {},
      },
    ]);
  });
});
