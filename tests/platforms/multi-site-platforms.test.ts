import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PumpSwapPlatform } from '../../src/platforms/pumpswap';
import { RaydiumPlatform } from '../../src/platforms/raydium';
import { LetsBonkPlatform } from '../../src/platforms/letsbonk';
import { MoonshotPlatform } from '../../src/platforms/moonshot';
import { DexScreenerPlatform } from '../../src/platforms/dexscreener';
import { BirdeyePlatform } from '../../src/platforms/birdeye';
import { SolscanPlatform } from '../../src/platforms/solscan';

const TOKEN_A = 'Gur3msAr6KPmoFogSabvuAxe4ZzjtNwv5WudJ49Ppump';
const TOKEN_B = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

describe('additional Solana platforms', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'test-extension-id',
        sendMessage: vi.fn(),
      },
    });

    document.body.innerHTML = '';
  });

  it('extracts PumpSwap output mint from swap query params', () => {
    const platform = new PumpSwapPlatform();
    window.history.replaceState({}, '', `/swap?inputMint=${SOL_MINT}&outputMint=${TOKEN_A}`);

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
  });

  it('extracts Raydium token addresses from query params and token links', () => {
    const platform = new RaydiumPlatform();
    window.history.replaceState({}, '', `/swap/?inputMint=${SOL_MINT}&outputMint=${TOKEN_A}`);
    document.body.innerHTML = `<a href="/token/${TOKEN_B}">Token B</a>`;

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A, TOKEN_B]);
  });

  it('renders a Raydium detail badge directly next to Market cap', () => {
    const platform = new RaydiumPlatform();
    window.history.replaceState({}, '', `/launchpad/token/?mint=${TOKEN_A}`);
    document.body.innerHTML = `
      <div data-sentry-component="Info">
        <div data-sentry-source-file="Info.tsx">
          <div class="css-wd8hou">
            <p data-sentry-element="Text">Token A</p>
            <p class="market-cap">Market cap: $10K</p>
          </div>
          <div>Contract address:</div>
        </div>
      </div>
    `;

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 64,
      risk: 'medium',
      checks: {},
      cached: false,
    });

    const marketCap = document.querySelector('.market-cap');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(marketCap?.nextElementSibling).toBe(badge);
    expect(badge?.textContent).toContain('BarryGuard');
  });

  it('renders a Raydium launchpad list badge directly above MC', () => {
    const platform = new RaydiumPlatform();
    window.history.replaceState({}, '', '/launchpad/');
    document.body.innerHTML = `
      <article data-sentry-component="TopListCard">
        <a href="/launchpad/token/?mint=${TOKEN_A}" class="chakra-linkbox__overlay">
          <div class="css-j7qwjs">
            <p>New Token Created</p>
            <p>Token A <span>(TKNA)</span></p>
          </div>
        </a>
        <div class="mc-row"><p>MC:$64K</p></div>
      </article>
    `;

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 64,
      risk: 'medium',
      checks: {},
      cached: false,
    });

    const mcRow = document.querySelector('.mc-row');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(mcRow?.previousElementSibling).toBe(badge);
    expect(badge?.textContent).toContain('BarryGuard');
  });

  it('extracts LetsBonk token addresses from token links', () => {
    const platform = new LetsBonkPlatform();
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = `<a href="/token/${TOKEN_A}">Token A</a>`;

    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('extracts Moonshot token addresses from detail routes', () => {
    const platform = new MoonshotPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('extracts Dexscreener token addresses from explorer links on pair pages', () => {
    const platform = new DexScreenerPlatform();
    window.history.replaceState({}, '', '/solana/BGxJ6fDcfwC3h7K4Y3DEj7S2xKz5b3jQzL2p8sY3pair');
    document.body.innerHTML = `<a href="https://solscan.io/token/${TOKEN_A}">Solscan</a>`;

    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('extracts Birdeye token addresses from token routes', () => {
    const platform = new BirdeyePlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}?chain=solana`);

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
  });

  it('extracts Solscan token addresses from token routes and token links', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = `<a href="/token/${TOKEN_B}">Token B</a>`;

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A, TOKEN_B]);
  });

  it('extracts Solscan token addresses from the token overview page', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', '/token');
    document.body.innerHTML = `<a href="/token/${TOKEN_A}">Token A</a><a href="/token/${TOKEN_B}">Token B</a>`;

    expect(platform.getCurrentPageAddress()).toBe(null);
    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A, TOKEN_B]);
  });

  it('does not render a Solscan detail badge on an interstitial page without token content', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = '<main><h1>solscan.io</h1><p>Checking your browser before accessing.</p></main>';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 70,
      risk: 'low',
      checks: {},
      cached: false,
    });

    expect(document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`)).toBeNull();
  });

  it('renders a Solscan detail badge directly below the token name', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <section class="token-info">
          <h1>Would</h1>
        </section>
      </main>
    `;
    document.title = 'Would | Solscan';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 70,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const tokenName = document.querySelector('h1');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenName?.nextElementSibling).toBe(badge);
  });

  it('uses a Solscan-specific fallback heading when no h1 is present', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <div class="tokenName">Would</div>
      </main>
    `;
    document.title = 'Would | Solscan';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 70,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const tokenName = document.querySelector('.tokenName');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenName?.nextElementSibling).toBe(badge);
  });
});
