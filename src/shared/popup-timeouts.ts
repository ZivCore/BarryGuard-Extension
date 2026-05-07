import { ANALYSIS_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from './api-client';

export let POPUP_DEFAULT_MESSAGE_TIMEOUT_MS = 2500;
export let POPUP_AUTH_REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS + 3000;
export let POPUP_ANALYZE_REQUEST_TIMEOUT_MS = ANALYSIS_REQUEST_TIMEOUT_MS + 3000;

export function updatePopupTimeouts(args: {
  localBackgroundTimeoutMs?: number;
  requestExtraBufferMs?: number;
}): void {
  const nextDefault = args.localBackgroundTimeoutMs;
  const nextExtra = args.requestExtraBufferMs;

  if (typeof nextDefault === 'number' && Number.isFinite(nextDefault) && nextDefault > 0) {
    POPUP_DEFAULT_MESSAGE_TIMEOUT_MS = Math.floor(nextDefault);
  }

  if (typeof nextExtra === 'number' && Number.isFinite(nextExtra) && nextExtra >= 0) {
    const extra = Math.floor(nextExtra);
    POPUP_AUTH_REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS + extra;
    POPUP_ANALYZE_REQUEST_TIMEOUT_MS = ANALYSIS_REQUEST_TIMEOUT_MS + extra;
  }
}
