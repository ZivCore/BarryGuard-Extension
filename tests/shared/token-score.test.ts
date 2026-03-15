import { describe, expect, it } from 'vitest';
import { extractTokenScores, isTokenScoreLikelyIncomplete, sanitizeTokenScore } from '../../src/shared/token-score';

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

  it('keeps valid checks even when label and description are missing', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {
        mintAuthority: {
          status: 'danger',
          value: true,
          tier: 'free',
        },
        freezeAuthority: {
          status: 'success',
          value: false,
          tier: 'free',
        },
      },
    })).toEqual({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      cached: false,
      checks: {
        mintAuthority: {
          status: 'danger',
          value: true,
          label: '',
          description: '',
          tier: 'free',
        },
        freezeAuthority: {
          status: 'success',
          value: false,
          label: '',
          description: '',
          tier: 'free',
        },
      },
    });
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

  it('normalizes check key aliases to the canonical popup keys', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {
        mint_authority: {
          status: 'danger',
          value: true,
          tier: 'free',
        },
        freeze_authority: {
          status: 'success',
          value: false,
          tier: 'free',
        },
        liquidity_lock: {
          status: 'warning',
          value: false,
          tier: 'free',
        },
      },
    })?.checks).toEqual({
      mintAuthority: {
        status: 'danger',
        value: true,
        label: '',
        description: '',
        tier: 'free',
      },
      freezeAuthority: {
        status: 'success',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
      liquidityLocked: {
        status: 'warning',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
    });
  });

  it('uses known fallback tiers when the backend omits tier on canonical free checks', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {
        mintAuthority: {
          status: 'danger',
          value: true,
        },
        freezeAuthority: {
          status: 'success',
          value: false,
        },
      },
    })?.checks).toEqual({
      mintAuthority: {
        status: 'danger',
        value: true,
        label: '',
        description: '',
        tier: 'free',
      },
      freezeAuthority: {
        status: 'success',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
    });
  });

  it('infers authority statuses when the backend omits status but keeps boolean values', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {
        mintAuthority: {
          value: true,
        },
        freezeAuthority: {
          value: false,
        },
      },
    })?.checks).toEqual({
      mintAuthority: {
        status: 'danger',
        value: true,
        label: '',
        description: '',
        tier: 'free',
      },
      freezeAuthority: {
        status: 'success',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
    });
  });

  it('extracts canonical free checks from top-level legacy fields when checks are missing them', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      mint_authority: {
        value: true,
      },
      freeze_authority: {
        value: false,
      },
      checks: {
        liquidity_lock: {
          status: 'warning',
          value: false,
          tier: 'free',
        },
      },
    })?.checks).toEqual({
      mintAuthority: {
        status: 'danger',
        value: true,
        label: '',
        description: '',
        tier: 'free',
      },
      freezeAuthority: {
        status: 'success',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
      liquidityLocked: {
        status: 'warning',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
    });
  });

  it('accepts primitive legacy authority fields outside checks', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      mintAuthority: true,
      freezeAuthority: false,
      liquidityLocked: false,
      checks: {},
    })?.checks).toEqual({
      mintAuthority: {
        status: 'danger',
        value: true,
        label: '',
        description: '',
        tier: 'free',
      },
      freezeAuthority: {
        status: 'success',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
      liquidityLocked: {
        status: 'danger',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
    });
  });

  it('accepts legacy riskFactors containers when checks are empty', () => {
    expect(sanitizeTokenScore({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {},
      riskFactors: {
        mint_authority: true,
        freeze_authority: false,
      },
    })?.checks).toEqual({
      mintAuthority: {
        status: 'danger',
        value: true,
        label: '',
        description: '',
        tier: 'free',
      },
      freezeAuthority: {
        status: 'success',
        value: false,
        label: '',
        description: '',
        tier: 'free',
      },
    });
  });

  it('marks free-tier scores with missing visible checks as incomplete', () => {
    expect(isTokenScoreLikelyIncomplete({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      cached: false,
      checks: {
        mintAuthority: {
          status: 'success',
          value: false,
          label: '',
          description: '',
          tier: 'free',
        },
      },
    }, 'free')).toBe(true);
  });

  it('marks paid-tier scores with zero placeholder metrics as incomplete', () => {
    expect(isTokenScoreLikelyIncomplete({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      cached: false,
      checks: {
        mintAuthority: { status: 'success', value: false, label: '', description: '', tier: 'free' },
        freezeAuthority: { status: 'success', value: false, label: '', description: '', tier: 'free' },
        liquidityLocked: { status: 'success', value: true, label: '', description: '', tier: 'free' },
        topHolderConcentration: { status: 'warning', value: 0, label: '', description: '', tier: 'rescue_pass' },
        tokenAge: { status: 'warning', value: 0, label: '', description: '', tier: 'rescue_pass' },
        holderCount: { status: 'warning', value: 0, label: '', description: '', tier: 'rescue_pass' },
      },
    }, 'rescue_pass')).toBe(true);
  });

  it('marks complete visible checks as ready', () => {
    expect(isTokenScoreLikelyIncomplete({
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 84,
      risk: 'low',
      cached: true,
      checks: {
        mintAuthority: { status: 'success', value: false, label: '', description: '', tier: 'free' },
        freezeAuthority: { status: 'success', value: false, label: '', description: '', tier: 'free' },
        liquidityLocked: { status: 'success', value: true, label: '', description: '', tier: 'free' },
      },
    }, 'free')).toBe(false);
  });
});
