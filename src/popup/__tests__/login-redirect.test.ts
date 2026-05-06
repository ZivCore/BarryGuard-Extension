import { beforeEach, describe, expect, it, vi } from 'vitest';

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
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
      <div id="score-donut"></div>
      <div id="score-donut-ring"></div>
      <div id="score-value"></div>
      <div id="risk-label"></div>
      <div id="checks-list"></div>
      <div id="subscores-container"></div>
      <div id="reasons-container"></div>
      <ul id="reasons-list"></ul>
      <div id="analyzed-at"></div>
      <div id="confidence-badge"></div>
      <div id="watchlist-badge"></div>
      <div id="watchlist-error"></div>
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
  const create = vi.fn();
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
        get: vi.fn(async () => ({})),
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
    tabs: { create },
  });

  return { create, sendMessage };
}

describe('popup website login redirect', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    renderPopupShell();
  });

  it('opens the website login page from the no-token CTA', async () => {
    const { create } = installChromeMock();

    await import('../index');
    await flushMicrotasks();

    document.getElementById('no-token-account-btn')?.click();

    expect(create).toHaveBeenCalledWith({
      url: 'https://www.barryguard.com/login?source=extension',
    });
  });
});
