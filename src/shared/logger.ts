/**
 * Logger with build-time gate (E-M4).
 *
 * `log` and `debug` are no-ops in Production builds — they never emit to the
 * browser console, preventing tier/usage/profile data from appearing in DevTools
 * on users' machines.
 *
 * `warn` and `error` are always active (desired for Production debugging).
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
  /** Development-only: silenced in Production builds. */
  debug(...args: unknown[]): void {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.debug('[BarryGuard]', ...args);
    }
  },

  /** Development-only: silenced in Production builds. */
  log(...args: unknown[]): void {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log('[BarryGuard]', ...args);
    }
  },

  /** Always active — suitable for non-sensitive operational warnings. */
  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn('[BarryGuard]', ...args);
  },

  /** Always active — suitable for error reporting. */
  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error('[BarryGuard]', ...args);
  },
};
