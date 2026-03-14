import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PumpFunPlatform } from '../../src/platforms/pumpfun';

describe('PumpFunPlatform', () => {
  let platform: PumpFunPlatform;

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(),
      },
    });

    platform = new PumpFunPlatform();
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('extracts valid Solana addresses from /coin/ links', () => {
    document.body.innerHTML = `
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">Token A</a>
      <a href="/coin/So11111111111111111111111111111111111111112">Token B</a>
    `;

    const addresses = platform.extractTokenAddresses();

    expect(addresses).toHaveLength(2);
    expect(addresses[0]).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    expect(addresses[1]).toBe('So11111111111111111111111111111111111111112');
  });

  it('deduplicates addresses that appear multiple times', () => {
    document.body.innerHTML = `
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">Token A</a>
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">Token A (again)</a>
    `;

    const addresses = platform.extractTokenAddresses();
    expect(addresses).toHaveLength(1);
  });

  it('ignores links that are not /coin/ routes', () => {
    document.body.innerHTML = `
      <a href="/profile/someuser">Profile</a>
      <a href="/about">About</a>
    `;

    expect(platform.extractTokenAddresses()).toHaveLength(0);
  });

  it('ignores /coin/ links with invalid addresses (too short)', () => {
    document.body.innerHTML = '<a href="/coin/abc123">Invalid</a>';
    expect(platform.extractTokenAddresses()).toHaveLength(0);
  });

  it('returns empty array when no token links present', () => {
    document.body.innerHTML = '<div>No tokens here</div>';
    expect(platform.extractTokenAddresses()).toHaveLength(0);
  });

  it('replaces a loading badge with the final score badge', () => {
    document.body.innerHTML = `
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">
        <span>Token A</span>
      </a>
    `;

    platform.renderLoadingBadge('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    platform.renderScoreBadge('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 82,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const badge = document.querySelector('[data-barryguard-badge="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"]');
    expect(badge?.textContent).toBe('82');
    expect((badge as HTMLElement).style.backgroundColor).toBe('rgb(209, 250, 229)');
  });

  it('requests the popup to open when a badge is clicked', () => {
    document.body.innerHTML = `
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">
        <div class="card">
          <span class="name">Token A</span>
          <span class="symbol">$TKNA</span>
        </div>
      </a>
    `;

    platform.renderScoreBadge('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      chain: 'solana',
      score: 22,
      risk: 'high',
      checks: {},
      cached: false,
    });

    const badge = document.querySelector('[data-barryguard-badge="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"]') as HTMLElement;
    badge.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_POPUP_FOR_TOKEN',
        payload: expect.objectContaining({
          address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          metadata: expect.objectContaining({
            name: 'Token A',
            symbol: '$TKNA',
          }),
        }),
      }),
    );
  });

  it('includes the current coin page address in extracted addresses', () => {
    window.history.replaceState({}, '', '/coin/EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt');
    document.body.innerHTML = '<h1>Terafab</h1>';

    const addresses = platform.extractTokenAddresses();

    expect(addresses).toContain('EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt');
  });

  it('renders a badge on the current coin detail page and includes image metadata', () => {
    window.history.replaceState({}, '', '/coin/EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt');
    document.title = 'TERAFAB $32.6K | Pump';
    document.body.innerHTML = `
      <h1>Terafab</h1>
      <img
        alt="Terafab logo"
        src="https://images.pump.fun/coin-image/EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt?variant=86x86"
      />
    `;

    platform.renderScoreBadge('EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt', {
      address: 'EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt',
      chain: 'solana',
      score: 84,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const badge = document.querySelector('[data-barryguard-badge="EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt"]') as HTMLElement;
    expect(badge).toBeTruthy();

    badge.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_POPUP_FOR_TOKEN',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'Terafab',
            symbol: 'TERAFAB',
            imageUrl: expect.stringContaining('/coin-image/EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt'),
          }),
        }),
      }),
    );
  });
});
