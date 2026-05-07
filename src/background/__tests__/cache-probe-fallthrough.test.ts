import { describe, expect, it } from 'vitest';

import { _resolveCacheProbeOutcomeForTest } from '../index';
import type { ApiResponse, TokenScore } from '../../shared/types';

const minimalTokenScore: TokenScore = {
  address: '11111111111111111111111111111111',
  chain: 'solana',
  score: 75,
  risk: 'medium',
  checks: {},
  cached: false,
};

describe('resolveCacheProbeOutcome', () => {
  it('returns cache_hit for 200 response with data', () => {
    const response: ApiResponse<TokenScore> = {
      success: true,
      data: minimalTokenScore,
      statusCode: 200,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_hit');
  });

  it('returns cache_miss for 404 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Not found',
      statusCode: 404,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_miss');
  });

  it('returns cache_probe_transient for 429 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Too many requests',
      statusCode: 429,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_transient');
  });

  it('returns cache_probe_transient for 503 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Service unavailable',
      statusCode: 503,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_transient');
  });

  it('returns cache_probe_transient for 504 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Gateway timeout',
      statusCode: 504,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_transient');
  });

  it('returns cache_probe_terminal for 401 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Unauthorized',
      statusCode: 401,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_terminal');
  });

  it('returns cache_probe_terminal for 403 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Forbidden',
      statusCode: 403,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_terminal');
  });

  it('returns cache_probe_terminal for 400 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Bad request',
      statusCode: 400,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_terminal');
  });

  it('returns cache_probe_terminal for 500 response', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Internal server error',
      statusCode: 500,
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_terminal');
  });

  it('returns cache_probe_terminal for response without statusCode', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'Network error',
    };
    expect(_resolveCacheProbeOutcomeForTest(response)).toBe('cache_probe_terminal');
  });
});
