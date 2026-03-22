import { describe, expect, it } from 'vitest';

import { buildWebsiteSessionPayload } from '../../src/shared/website-session';

describe('buildWebsiteSessionPayload', () => {
  it('delivers a valid session profile even when no token is present', () => {
    const data = {
      valid: true,
      email: 'mario.zivkovic@zivcore.ch',
      hourlyAnalysesUsed: 0,
      hourlyAnalysesRemaining: 10000,
      hourlyAnalysesLimit: 10000,
    };

    expect(buildWebsiteSessionPayload(data)).toEqual({
      profile: data,
    });
  });

  it('includes the token when the session response provides one', () => {
    const data = {
      valid: true,
      token: { access_token: 'abc', refresh_token: 'def' },
      hourlyAnalysesUsed: 5,
    };

    expect(buildWebsiteSessionPayload(data)).toEqual({
      token: data.token,
      profile: data,
    });
  });

  it('rejects invalid sessions', () => {
    expect(buildWebsiteSessionPayload({ valid: false })).toBeNull();
    expect(buildWebsiteSessionPayload(null)).toBeNull();
  });
});
