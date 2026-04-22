import { describe, expect, it } from 'vitest';

import { REQUEST_TIMEOUT_MS } from '../../src/shared/api-client';
import {
  POPUP_ANALYZE_REQUEST_TIMEOUT_MS,
  POPUP_AUTH_REQUEST_TIMEOUT_MS,
  POPUP_DEFAULT_MESSAGE_TIMEOUT_MS,
} from '../../src/shared/popup-timeouts';

describe('popup timeout contracts', () => {
  it('keeps the default popup message timeout short for local background reads', () => {
    expect(POPUP_DEFAULT_MESSAGE_TIMEOUT_MS).toBe(2500);
  });

  it('waits longer for manual analysis than the underlying HTTP client timeout', () => {
    expect(POPUP_ANALYZE_REQUEST_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
  });

  it('waits longer for auth flows than the legacy 2.5s popup default', () => {
    expect(POPUP_AUTH_REQUEST_TIMEOUT_MS).toBeGreaterThan(POPUP_DEFAULT_MESSAGE_TIMEOUT_MS);
  });
});
