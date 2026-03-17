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
      subscores: { contract: 0, marketStructure: 0, behavior: 0 },
      reasons: [],
      confidence: 'medium',
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
      subscores: { contract: 0, marketStructure: 0, behavior: 0 },
      reasons: [],
      confidence: 'medium',
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
        subscores: { contract: 0, marketStructure: 0, behavior: 0 },
        reasons: [],
        confidence: 'medium',
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
        risk: 'caution', // 'medium' from API is mapped to 'caution'
        cached: false,
        subscores: { contract: 0, marketStructure: 0, behavior: 0 },
        reasons: [],
        confidence: 'medium',
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

  it('maps "safe" status alias to success', () => {
    const base = {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 75,
      risk: 'low' as const,
    };

    expect(sanitizeTokenScore({
      ...base,
      checks: {
        holderCount: { status: 'safe', value: '1,000+', description: 'The token is currently held by 1,000+ wallets.', tier: 'rescue_pass' },
      },
    })?.checks.holderCount?.status).toBe('success');

    expect(sanitizeTokenScore({
      ...base,
      checks: {
        tokenAge: { status: 'safe', value: '62 d', description: 'The token has been live for 62 d. Older tokens usually carry less launch risk.', tier: 'rescue_pass' },
      },
    })?.checks.tokenAge?.status).toBe('success');
  });

  it('infers holderCount status from description text when backend omits status', () => {
    const base = {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 55,
      risk: 'medium' as const,
    };

    expect(sanitizeTokenScore({
      ...base,
      checks: { holderCount: { value: 51, description: 'Es gibt bislang nur wenige Holder.', tier: 'rescue_pass' } },
    })?.checks.holderCount?.status).toBe('warning');

    expect(sanitizeTokenScore({
      ...base,
      checks: { holderCount: { value: 5000, description: 'Es gibt bereits viele Holder.', tier: 'rescue_pass' } },
    })?.checks.holderCount?.status).toBe('success');

    expect(sanitizeTokenScore({
      ...base,
      checks: { holderCount: { value: 51, tier: 'rescue_pass' } },
    })?.checks.holderCount?.status).toBe('warning');

    expect(sanitizeTokenScore({
      ...base,
      checks: { holderCount: { value: 1000, tier: 'rescue_pass' } },
    })?.checks.holderCount?.status).toBe('success');
  });

  it('infers tokenAge status from description text when backend omits status', () => {
    const base = {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 55,
      risk: 'medium' as const,
    };

    // German "very new" description → warning
    expect(sanitizeTokenScore({
      ...base,
      checks: { tokenAge: { value: 2, description: 'Token ist sehr neu.', tier: 'rescue_pass' } },
    })?.checks.tokenAge?.status).toBe('warning');

    // German "some history" description → warning
    expect(sanitizeTokenScore({
      ...base,
      checks: { tokenAge: { value: 14, description: 'Token hat bereits etwas Historie.', tier: 'rescue_pass' } },
    })?.checks.tokenAge?.status).toBe('warning');

    // German "older tokens less risky" description → success
    expect(sanitizeTokenScore({
      ...base,
      checks: { tokenAge: { value: 90, description: 'Ältere Tokens sind in der Regel weniger riskant.', tier: 'rescue_pass' } },
    })?.checks.tokenAge?.status).toBe('success');

    // Numeric value only, no description → warning fallback
    expect(sanitizeTokenScore({
      ...base,
      checks: { tokenAge: { value: 5, tier: 'rescue_pass' } },
    })?.checks.tokenAge?.status).toBe('warning');
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
        topHolderConcentration: { status: 'warning', value: 14.2, label: '', description: '', tier: 'free' },
        tokenAge: { status: 'warning', value: 90, label: '', description: '', tier: 'free' },
        holderCount: { status: 'warning', value: 87, label: '', description: '', tier: 'free' },
        developerHistory: { status: 'danger', value: 'bad', label: '', description: '', tier: 'free' },
        clusterControl: { status: 'danger', value: 38.4, label: '', description: '', tier: 'free' },
      },
    })).toBe(false);
  });
});

describe('sanitizeTokenScore Phase C check aliases', () => {
  const BASE = {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    chain: 'solana',
    score: 42,
    risk: 'high' as const,
  };

  it('normalizes early_dump key alias to earlyDump', () => {
    const result = sanitizeTokenScore({
      ...BASE,
      checks: {
        early_dump: { status: 'danger', value: true, label: 'Early dump', description: 'Dev sold early.', tier: 'free' },
      },
    });
    expect(result?.checks['earlyDump']).toBeDefined();
    expect(result?.checks['early_dump']).toBeUndefined();
  });

  it('normalizes sniper_dominance key alias to sniperDominance', () => {
    const result = sanitizeTokenScore({
      ...BASE,
      checks: {
        sniper_dominance: { status: 'warning', value: 22, label: 'Sniper dominance', description: '22% snipers.', tier: 'free' },
      },
    });
    expect(result?.checks['sniperDominance']).toBeDefined();
    expect(result?.checks['sniper_dominance']).toBeUndefined();
  });

  it('normalizes sell_ability key alias to sellability', () => {
    const result = sanitizeTokenScore({
      ...BASE,
      checks: {
        sell_ability: { status: 'success', value: true, label: 'Sellable', description: 'No restrictions.', tier: 'free' },
      },
    });
    expect(result?.checks['sellability']).toBeDefined();
    expect(result?.checks['sell_ability']).toBeUndefined();
  });

  it('preserves earlyDump check as-is when key is already canonical', () => {
    const result = sanitizeTokenScore({
      ...BASE,
      checks: {
        earlyDump: { status: 'danger', value: true, label: 'Early dump', description: 'Dev sold early.', tier: 'free' },
      },
    });
    expect(result?.checks['earlyDump']).toEqual({
      status: 'danger',
      value: true,
      label: 'Early dump',
      description: 'Dev sold early.',
      tier: 'free',
    });
  });
});
