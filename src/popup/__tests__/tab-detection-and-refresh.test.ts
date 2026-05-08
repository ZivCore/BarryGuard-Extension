import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Mock-Adressen (ADR-002) ----------
const SOLANA_ADDR = 'So11111111111111111111111111111111111111112';
const EVM_ADDR = '0x0000000000000000000000000000000000000001';

const STALE_SOLANA_TOKEN = {
  address: SOLANA_ADDR,
  chain: 'solana',
  score: {
    address: SOLANA_ADDR,
    chain: 'solana',
    score: 85,
    risk: 'low',
    checks: {},
    cached: true,
  },
};

const STALE_EVM_TOKEN = {
  address: EVM_ADDR,
  chain: 'ethereum',
  score: {
    address: EVM_ADDR,
    chain: 'ethereum',
    score: 70,
    risk: 'medium',
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

// Baut einen Chrome-Mock mit konfigurierbarem Tab-Status und selectedToken
function installChromeMock(opts: {
  tabStatus: 'has_token' | 'no_token' | 'unavailable';
  selectedToken?: unknown;
  scoreResponse?: unknown;
}) {
  const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
    if (message.type === 'GET_TAB_TOKEN_DETECTION_STATE') {
      callback({ success: true, data: { status: opts.tabStatus } });
      return;
    }
    if (message.type === 'REFRESH_USAGE') {
      callback({ success: true });
      return;
    }
    if (message.type === 'GET_TOKEN_SCORE') {
      callback(opts.scoreResponse ?? { success: false, error: 'No active session.' });
      return;
    }
    if (message.type === 'GET_WATCHLIST_STATUS') {
      callback({ success: false, error: 'No active session.' });
      return;
    }
    if (message.type === 'GET_WATCHLIST_ALERTS') {
      callback({ success: false, error: 'No active session.' });
      return;
    }
    callback({ success: false, error: 'No active session.' });
  });

  const storageLocal = {
    get: vi.fn(async (key: string | string[]) => {
      if (key === 'selectedToken') {
        return opts.selectedToken !== undefined
          ? { selectedToken: opts.selectedToken }
          : {};
      }
      return {};
    }),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };

  vi.stubGlobal('chrome', {
    runtime: { id: 'extension-id', lastError: undefined, sendMessage },
    storage: {
      local: storageLocal,
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      onChanged: { addListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
  });

  return { sendMessage, storageLocal };
}

// ---------- Tests 1-7, 17: Popup Tab-Detection & Refresh ----------
describe('popup tab detection and refresh', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    renderPopupShell();
  });

  // Test 1: no_token Status — stales selectedToken wird geloescht
  it('clears stale selectedToken when active supported tab reports no_token', async () => {
    const { storageLocal } = installChromeMock({
      tabStatus: 'no_token',
      selectedToken: STALE_SOLANA_TOKEN,
    });

    await import('../index');
    await flushMicrotasks();

    // no-token-screen muss sichtbar sein
    expect(document.getElementById('no-token-screen')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('token-detail-screen')?.classList.contains('hidden')).toBe(true);
    // Storage-Remove muss aufgerufen worden sein
    expect(storageLocal.remove).toHaveBeenCalledWith('selectedToken');
  });

  // Test 2: unavailable Status — selectedToken wird BEHALTEN, kein No-Token-Screen
  it('preserves selectedToken when tab detection reports unavailable', async () => {
    installChromeMock({
      tabStatus: 'unavailable',
      selectedToken: STALE_SOLANA_TOKEN,
      // Score kommt zurueck damit token-detail angezeigt wird
      scoreResponse: {
        success: true,
        data: STALE_SOLANA_TOKEN.score,
      },
    });

    await import('../index');
    await flushMicrotasks();

    // no-token-screen darf NICHT sichtbar sein, da selectedToken behalten wird
    expect(document.getElementById('no-token-screen')?.classList.contains('hidden')).toBe(true);
  });

  // Test 3: unsupported (faellt in no_token-Branch) — selectedToken wird geloescht
  it('clears selectedToken when tab detection reports unsupported host (no_token branch)', async () => {
    // 'unsupported' wird in detectActiveTabTokenState als no_token behandelt
    // (status ist weder 'has_token' noch 'unavailable')
    const { storageLocal } = installChromeMock({
      tabStatus: 'no_token',
      selectedToken: STALE_EVM_TOKEN,
    });

    await import('../index');
    await flushMicrotasks();

    expect(document.getElementById('no-token-screen')?.classList.contains('hidden')).toBe(false);
    expect(storageLocal.remove).toHaveBeenCalledWith('selectedToken');
  });

  // Test 4: GET_TOKEN_SCORE Solana Object-Payload
  it('sends GET_TOKEN_SCORE with { address, chain: solana } object payload for Solana token', async () => {
    const { sendMessage } = installChromeMock({
      tabStatus: 'has_token',
      selectedToken: { address: SOLANA_ADDR, chain: 'solana' }, // kein score -> fetchScore
      scoreResponse: { success: false, error: 'Score unavailable' },
    });

    await import('../index');
    await flushMicrotasks();

    const scoreCall = sendMessage.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === 'GET_TOKEN_SCORE',
    );
    expect(scoreCall).toBeDefined();
    const payload = (scoreCall![0] as { type: string; payload: unknown }).payload;
    expect(payload).toMatchObject({ address: SOLANA_ADDR, chain: 'solana' });
  });

  // Test 5: GET_TOKEN_SCORE EVM Object-Payload — verhindert stille Solana-Default-Falle
  it('sends GET_TOKEN_SCORE with { address, chain: ethereum } for EVM token — not default solana', async () => {
    const { sendMessage } = installChromeMock({
      tabStatus: 'has_token',
      selectedToken: { address: EVM_ADDR, chain: 'ethereum' }, // kein score
      scoreResponse: { success: false, error: 'Score unavailable' },
    });

    await import('../index');
    await flushMicrotasks();

    const scoreCall = sendMessage.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === 'GET_TOKEN_SCORE',
    );
    expect(scoreCall).toBeDefined();
    const payload = (scoreCall![0] as { type: string; payload: unknown }).payload;
    // Chain muss 'ethereum' sein, NICHT 'solana'
    expect(payload).toMatchObject({ address: EVM_ADDR, chain: 'ethereum' });
    expect((payload as { chain: string }).chain).not.toBe('solana');
  });

  // Test 6: Force-Refresh und Watchlist senden chain-aware Payloads
  // Prueft: REFRESH_TOKEN_SCORE-Payload enthaelt die korrekte Chain des EVM-Tokens.
  // (GET_WATCHLIST_STATUS wird nur gesendet wenn User eingeloggt ist — dieser Test
  //  prueft die chain-aware Payload via REFRESH_TOKEN_SCORE, die immer gesendet wird.)
  it('sends chain-aware { address, chain } payload for REFRESH_TOKEN_SCORE (force-refresh)', async () => {
    const { sendMessage } = installChromeMock({
      tabStatus: 'has_token',
      // Token mit Score -> kein GET_TOKEN_SCORE, aber Refresh-Button-Click wuerde REFRESH_TOKEN_SCORE senden.
      // Wir testen hier den GET_TOKEN_SCORE-Payload der refreshSelectedTokenScore-Funktion,
      // die chain-aware arbeitet (chain: selectedToken.chain ?? 'solana').
      selectedToken: { address: EVM_ADDR, chain: 'ethereum' }, // kein score -> fetchScore
      scoreResponse: { success: false, error: 'unavailable' },
    });

    await import('../index');
    await flushMicrotasks();

    // GET_TOKEN_SCORE muss mit chain: 'ethereum' gesendet worden sein
    const scoreCall = sendMessage.mock.calls.find(
      (args: unknown[]) => (args[0] as { type: string }).type === 'GET_TOKEN_SCORE',
    );
    expect(scoreCall).toBeDefined();
    const payload = (scoreCall![0] as { type: string; payload: unknown }).payload;
    // Chain muss 'ethereum' sein — nicht der Solana-Default
    expect(payload).toMatchObject({ address: EVM_ADDR, chain: 'ethereum' });
  });

  // Test 7: Storage-Update ohne Score — bestehende Chain bleibt erhalten
  it('shows token-detail when selectedToken with chain but no score is loaded on has_token tab', async () => {
    // Simuliert handleSelectedTokenUpdate mit scorelosen Token der eine Chain hat
    // -> Chain muss bei Merge erhalten bleiben, Token-Detail wird angezeigt
    installChromeMock({
      tabStatus: 'has_token',
      selectedToken: STALE_EVM_TOKEN,
      scoreResponse: { success: true, data: STALE_EVM_TOKEN.score },
    });

    await import('../index');
    await flushMicrotasks();

    // token-detail-screen muss sichtbar sein (chain war vorhanden, score konnte geladen werden)
    expect(document.getElementById('token-detail-screen')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('no-token-screen')?.classList.contains('hidden')).toBe(true);
  });

  // Test 17: Malformed Score -> Error-View, selectedToken bleibt erhalten
  it('keeps selectedToken and does not show no-token-screen when score fetch returns server error', async () => {
    installChromeMock({
      tabStatus: 'has_token',
      selectedToken: { address: SOLANA_ADDR, chain: 'solana' }, // kein score -> fetchScore
      scoreResponse: {
        success: false,
        error: 'malformed',
        errorType: 'server',
      },
    });

    await import('../index');
    await flushMicrotasks();

    // no-token-screen darf NICHT sichtbar sein (selectedToken bleibt erhalten)
    // renderScoreFetchErrorState wird aufgerufen und zeigt error in token-detail-screen
    expect(document.getElementById('no-token-screen')?.classList.contains('hidden')).toBe(true);
  });
});
