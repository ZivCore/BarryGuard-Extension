import { describe, expect, it } from 'vitest';

import {
  _getListAnalysisBlockReasonForTest,
  _normalizeProfileForTest,
} from '../index';
import type { UserProfile } from '../../shared/types';

describe('list analysis tier gate', () => {
  it('defaults free profiles to list analysis access', () => {
    const profile = _normalizeProfileForTest({
      id: 'user-free',
      email: 'free@example.com',
      tier: 'free',
    } satisfies Partial<UserProfile>);

    expect(profile.capabilities?.tokenListAnalysis).toBe(true);
    expect(_getListAnalysisBlockReasonForTest(profile)).toBeNull();
  });

  it('blocks anonymous list analysis with sign-in copy', () => {
    expect(_getListAnalysisBlockReasonForTest(null)).toEqual({
      error: 'Mass scan requires sign-in',
      statusCode: 401,
      errorType: 'plan_gate',
    });
  });
});
