import { beforeEach, describe, expect, it, vi } from 'vitest';

const STALE_SELECTED_TOKEN = {
  address: 'So11111111111111111111111111111111111111112',
  score: {
    address: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
    score: 91,
    risk: 'low',
    checks: {},
    cached: true,
  },
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function renderPopupShell() {
  document.body.innerHTML = `
    <div id="loading" class="screen"></div>
    <div id="no-token-screen" class="screen hidden">
      <button id="no-token-manual-btn"></button>
      <button id="no-token-account-btn">Account</button>
    </div>
    <div id="token-detail-screen" class="screen hidden">
      <button id="manual-entry-btn"></button>
      <button id="account-btn"></button>
      <button id="header-account-btn"></button>
      <button id="watchlist-toggle-btn"></button>
      <button id="refresh-btn"></button>
      <button id="token-address"></button>
      <a id="view-explorer"></a>
      <a id="view-full-analysis"></a>
      <img id="token-logo" />
      <div id="token-name"></div>
      <div id="token-symbol"></div>
      <div id="copy-toast"></div>
      <div id="score-donut-ring"></div>
      <div id="checks-list"></div>
      <div id="watchlist-badge"></div>
      <div id="watchlist-alerts-section"></div>
      <div id="watchlist-alerts-list"></div>
    </div>
    <div id="account-screen" class="screen hidden">
      <div id="account-email"></div>
      <div id="tier-badge"></div>
      <img id="account-tier-logo" />
      <div id="tier-name"></div>
      <div id="period-end"></div>
      <div id="subscription-info"></div>
      <button id="manage-subscription-btn"></button>
      <button id="logout-btn"></button>
      <button id="account-back-btn"></button>
    </div>
    <div id="manual-entry-screen" class="screen hidden">
      <input id="token-address-input" />
      <button id="analyze-btn"></button>
      <button id="manual-back-btn"></button>
      <div id="manual-error"></div>
    </div>
    <img id="brand-logo" />
    <div id="usage-indicator"></div>
    <div id="usage-donut"></div>
    <div id="usage-remaining"></div>
    <div id="usage-label"></div>
    <div id="usage-meta"></div>
  `;
}

function installChromeMock() {
  const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
    if (message.type === 'GET_TAB_TOKEN_DETECTION_STATE') {
      callback({ success: true, data: { hasToken: false } });
      return;
    }
    if (message.type === 'REFRESH_USAGE') {
      callback({ success: true });
      return;
    }
    callback({ success: false, error: 'No active session.' });
  });

  vi.stubGlobal('chrome', {
    runtime: { id: 'extension-id', lastError: undefined, sendMessage },
    storage: {
      local: {
        get: vi.fn(async (key: string | string[]) => {
          if (key === 'selectedToken') {
            return { selectedToken: STALE_SELECTED_TOKEN };
          }
          return {};
        }),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      onChanged: { addListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
  });

  return { sendMessage };
}

describe('popup no-token empty state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    renderPopupShell();
  });

  it('ignores stale selectedToken when the active tab reports no token', async () => {
    const { sendMessage } = installChromeMock();

    await import('../index');
    await flushMicrotasks();

    expect(sendMessage).toHaveBeenCalledWith(
      { type: 'GET_TAB_TOKEN_DETECTION_STATE' },
      expect.any(Function),
    );
    expect(document.getElementById('no-token-screen')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('token-detail-screen')?.classList.contains('hidden')).toBe(true);
  });
});
