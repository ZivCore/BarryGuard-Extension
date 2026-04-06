import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PumpSwapPlatform } from '../../src/platforms/pumpswap';
import { RaydiumPlatform } from '../../src/platforms/raydium';
import { LetsBonkPlatform } from '../../src/platforms/letsbonk';
import { MoonshotPlatform } from '../../src/platforms/moonshot';
import { DexScreenerPlatform } from '../../src/platforms/dexscreener';
import { BirdeyePlatform } from '../../src/platforms/birdeye';
import { BagsPlatform } from '../../src/platforms/bags';
import { SolscanPlatform } from '../../src/platforms/solscan';
import { CoinMarketCapDexPlatform } from '../../src/platforms/coinmarketcap-dex';
import { CoinGeckoSolanaPlatform } from '../../src/platforms/coingecko-solana';

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

  it('DexScreener declares both apex and www host patterns (MV3)', () => {
    const platform = new DexScreenerPlatform();
    expect(platform.hostPattern).toContain('*://dexscreener.com/*');
    expect(platform.hostPattern).toContain('*://www.dexscreener.com/*');
  });

  it('extracts CoinMarketCap DEX token address from dexscan routes', () => {
    const platform = new CoinMarketCapDexPlatform();
    window.history.replaceState({}, '', `/dexscan/solana/${TOKEN_A}`);
    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('CoinGecko Solana adapter matches locale-independent chain routes and extracts from explorer links', () => {
    const platform = new CoinGeckoSolanaPlatform();
    const fakeLocation = { hostname: 'www.coingecko.com', pathname: '/de/chains/solana' } as unknown as Location;
    document.body.innerHTML = `<a href="https://solscan.io/token/${TOKEN_A}">Explorer</a>`;
    expect(platform.matchesLocation(fakeLocation)).toBe(true);
    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('ignores Dexscreener maker wallet links when extracting token addresses', () => {
    const platform = new DexScreenerPlatform();
    const makerWallet = '6Q4Xu2sXxMLZ7w8sL9fL1v7b7dQGJwR2X8c7mWq9rYpS';
    window.history.replaceState({}, '', '/solana/BGxJ6fDcfwC3h7K4Y3DEj7S2xKz5b3jQzL2p8sY3pair');
    document.body.innerHTML = `
      <main>
        <a href="https://solscan.io/token/${TOKEN_A}">Token explorer</a>
        <section aria-label="Transactions">
          <a href="/solana/${makerWallet}">Maker</a>
        </section>
      </main>
    `;

    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('resolves DexScreener list pair addresses via API and renders list badges inline', async () => {
    const pairAddress = TOKEN_B; // use TOKEN_B as a stand-in pair address
    const platform = new DexScreenerPlatform();
    window.history.replaceState({}, '', '/solana/moonit');
    document.body.innerHTML = `
      <main>
        <a class="ds-dex-table-row" href="/solana/${pairAddress}">
          <div class="ds-dex-table-row-base-token-name">
            <span class="ds-dex-table-row-base-token-name-text">Token A</span>
          </div>
        </a>
      </main>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        pairs: [{ pairAddress, baseToken: { address: TOKEN_A } }],
      }),
    }));

    // First call triggers async resolution — returns empty while pending
    expect(platform.extractTokenAddresses()).toEqual([]);

    // Wait for the async fetch + json() promise chain to complete
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Second call returns the resolved token address
    expect(platform.extractTokenAddresses()).toContain(TOKEN_A);

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 88,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const nameEl = document.querySelector('.ds-dex-table-row-base-token-name-text');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(nameEl?.nextElementSibling).toBe(badge);
    expect(badge?.textContent).toContain('BarryGuard');

    vi.unstubAllGlobals();
    vi.stubGlobal('chrome', {
      runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
    });
  });

  it('extracts Birdeye token addresses from token routes', () => {
    const platform = new BirdeyePlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}?chain=solana`);

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);
  });

  it('extracts Birdeye token addresses from chain-prefixed token routes', () => {
    const platform = new BirdeyePlatform();
    window.history.replaceState({}, '', `/solana/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <section class="token-shell">
          <div class="tokenName">Token A</div>
        </section>
      </main>
    `;
    document.title = 'Token A price today | Birdeye';

    expect(platform.getCurrentPageAddress()).toBe(TOKEN_A);

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 81,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const tokenName = document.querySelector('.tokenName');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenName?.nextElementSibling).toBe(badge);
    // Birdeye uses compact badge ('BG' label instead of 'BarryGuard')
    expect(badge?.textContent).toContain('BG');
  });

  it('renders a Birdeye detail badge inline inside h1 (to the right of the token name)', () => {
    const platform = new BirdeyePlatform();
    window.history.replaceState({}, '', `/solana/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <h1 class="flex items-baseline gap-1">
          <span class="shrink-0 truncate">TokenName</span>
          <span class="truncate">SYMBOL</span>
        </h1>
      </main>
    `;
    document.title = 'TokenName $0.01 | Birdeye';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 81,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const h1 = document.querySelector('h1');
    const symbolSpan = h1?.querySelector('span:last-of-type');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    // Badge is inserted after the last span — inside h1, to the right of the symbol
    expect(symbolSpan?.nextElementSibling).toBe(badge);
    expect(badge?.textContent).toContain('BG');
  });

  it('renders a Bags detail badge directly below the token name', () => {
    const platform = new BagsPlatform();
    const bagsToken = '7pskt3A1Zsjhngazam7vHWjWHnfgiRump916Xj7ABAGS';
    window.history.replaceState({}, '', `/${bagsToken}`);
    document.body.innerHTML = `
      <main>
        <section class="hero">
          <div class="tokenTitle">$$GAS</div>
        </section>
      </main>
    `;
    document.title = '$$GAS on Bags | Bags';

    expect(platform.getCurrentPageAddress()).toBe(bagsToken);

    platform.renderScoreBadge(bagsToken, {
      address: bagsToken,
      chain: 'solana',
      score: 88,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const tokenName = document.querySelector('.tokenTitle');
    const badge = document.querySelector(`[data-barryguard-badge="${bagsToken}"]`);

    expect(tokenName?.nextElementSibling).toBe(badge);
    expect(badge?.textContent).toContain('BarryGuard');
  });

  it('prefers the Bags token name over unrelated headings on detail pages', () => {
    const platform = new BagsPlatform();
    const bagsToken = 'ESBCnCXtEZDmX8QnHU6qMZXd9mvjSAZVoYaLKKADBAGS';
    window.history.replaceState({}, '', `/${bagsToken}`);
    document.body.innerHTML = `
      <main>
        <section class="stats">
          <h2>Top holders</h2>
        </section>
        <section class="hero">
          <div class="tokenTitle">Example Token</div>
        </section>
      </main>
    `;
    document.title = 'Example Token on Bags | Bags';

    platform.renderScoreBadge(bagsToken, {
      address: bagsToken,
      chain: 'solana',
      score: 88,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const tokenName = document.querySelector('.tokenTitle');
    const badge = document.querySelector(`[data-barryguard-badge="${bagsToken}"]`);

    expect(tokenName?.nextElementSibling).toBe(badge);
    expect(document.querySelector('.stats [data-barryguard-badge]')).toBeNull();
  });

  it('prefers the smallest Bags title match instead of a wrapper containing buy actions', () => {
    const platform = new BagsPlatform();
    const bagsToken = 'ESBCnCXtEZDmX8QnHU6qMZXd9mvjSAZVoYaLKKADBAGS';
    window.history.replaceState({}, '', `/${bagsToken}`);
    document.body.innerHTML = `
      <main>
        <section class="hero">
          <div class="tokenPanel">
            <div class="tokenHeader">
              <div class="titleGroup">
                <div class="tokenTitle">BUY THE HAT</div>
                <div class="tokenSymbol">BUY THE HAT</div>
              </div>
              <div class="actions">
                <a href="/buy/bags">Buy on Bags</a>
                <a href="/buy/axiom">Buy on Axiom</a>
                <a href="/buy/jupiter">Buy on Jupiter</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    `;
    document.title = 'BUY THE HAT on Bags | Bags';

    platform.renderScoreBadge(bagsToken, {
      address: bagsToken,
      chain: 'solana',
      score: 88,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const titleGroup = document.querySelector('.titleGroup');
    const badge = document.querySelector(`[data-barryguard-badge="${bagsToken}"]`);

    expect(titleGroup?.nextElementSibling).toBe(badge);
    expect(document.querySelector('.actions [data-barryguard-badge]')).toBeNull();
  });

  it('ignores Solscan wallet account links when extracting token addresses', () => {
    const platform = new SolscanPlatform();
    const walletAddr = 'So11111111111111111111111111111111111111112';
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <a href="/token/${TOKEN_B}">Token B</a>
        <section aria-label="Transactions">
          <a href="/account/${walletAddr}">From</a>
          <a href="/account/${TOKEN_B}">To</a>
        </section>
      </main>
    `;

    const addresses = platform.extractTokenAddresses();
    expect(addresses).not.toContain(walletAddr);
    // TOKEN_B appears as both a token link and a wallet link; the token link should win
    expect(addresses).toContain(TOKEN_B);
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

  it('renders a Solscan detail badge when token name is in an h4', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <div>
          <h4 class="not-italic text-neutral8 truncate">Token <span>Would</span></h4>
        </div>
      </main>
    `;
    document.title = 'would (WOULD) | Solscan';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 70,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const tokenName = document.querySelector('h4');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenName?.nextElementSibling).toBe(badge);
  });

  it('Birdeye on a token detail page only returns the current token address', () => {
    const platform = new BirdeyePlatform();
    window.history.replaceState({}, '', `/solana/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <a href="/solana/token/${TOKEN_B}">Trending token</a>
      <a href="/solana/token/${TOKEN_A}">Current token</a>
    `;

    expect(platform.extractTokenAddresses()).toEqual([TOKEN_A]);
  });

  it('Birdeye skips wallet address links in holder sections', () => {
    const platform = new BirdeyePlatform();
    window.history.replaceState({}, '', `/solana/token/${TOKEN_A}`);
    const walletAddr = 'So11111111111111111111111111111111111111112';
    document.body.innerHTML = `
      <a href="/address/${walletAddr}">Holder 1</a>
      <a href="/solana/token/${TOKEN_B}">Token B</a>
    `;

    const addresses = platform.extractTokenAddresses();
    expect(addresses).not.toContain(walletAddr);
  });

  it('extracts DexScreener token metadata from main, not the nav brand', () => {
    const platform = new DexScreenerPlatform();
    window.history.replaceState({}, '', '/solana/BGxJ6fDcfwC3h7K4Y3DEj7S2xKz5b3jQzL2p8sY3pair');
    document.body.innerHTML = `
      <nav>
        <span class="siteName">DexScreener</span>
        <h1>DEX SCREENER</h1>
      </nav>
      <main>
        <a href="https://solscan.io/token/${TOKEN_A}">Solscan</a>
        <h2>muddafudda</h2>
      </main>
    `;
    document.title = 'muddafudda $0.001 - First ever meme - DEX Screener';

    const score = { address: TOKEN_A, chain: 'solana', score: 55, risk: 'medium' as const, checks: {}, cached: false };
    const selected = platform.buildSelectedToken(TOKEN_A, score);
    const name = selected.metadata?.name ?? '';

    expect(name).not.toContain('SCREENER');
    expect(name).not.toContain('DexScreener');
    expect(name).toBe('muddafudda');
  });

  it('renders a Dexscreener detail badge below the token name h2', () => {
    const platform = new DexScreenerPlatform();
    window.history.replaceState({}, '', '/solana/BGxJ6fDcfwC3h7K4Y3DEj7S2xKz5b3jQzL2p8sY3pair');
    document.body.innerHTML = `
      <nav><h1>DEX SCREENER</h1></nav>
      <main>
        <a href="https://solscan.io/token/${TOKEN_A}">Solscan</a>
        <h2>muddafudda Copy token address</h2>
      </main>
    `;
    document.title = 'muddafudda $0.001 - First ever meme - DEX Screener';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 55,
      risk: 'medium',
      checks: {},
      cached: false,
    });

    const tokenH2 = document.querySelector('main h2');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenH2?.nextElementSibling).toBe(badge);
    expect(badge?.textContent).toContain('BarryGuard');
  });

  it('moves a Dexscreener badge out of the trending header once the detail target appears', () => {
    const platform = new DexScreenerPlatform();
    window.history.replaceState({}, '', '/solana/BGxJ6fDcfwC3h7K4Y3DEj7S2xKz5b3jQzL2p8sY3pair');
    document.body.innerHTML = `
      <header>
        <a href="/token/${TOKEN_A}">
          <span>Trending</span>
          <span>Token A</span>
        </a>
      </header>
      <main></main>
    `;

    platform.renderLoadingBadge(TOKEN_A);

    const headerLink = document.querySelector('header a');
    let badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);
    expect(headerLink?.nextElementSibling).toBe(badge);

    document.body.innerHTML = `
      <header>
        <a href="/token/${TOKEN_A}">
          <span>Trending</span>
          <span>Token A</span>
        </a>
      </header>
      <main>
        <a href="https://solscan.io/token/${TOKEN_A}">Solscan</a>
        <h2>Token A Copy token address</h2>
      </main>
    `;
    document.title = 'Token A $0.001 - DEX Screener';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 55,
      risk: 'medium',
      checks: {},
      cached: false,
    });

    const tokenH2 = document.querySelector('main h2');
    badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenH2?.nextElementSibling).toBe(badge);
    expect(document.querySelector('header [data-barryguard-badge]')).toBeNull();
  });

  it('does not insert a Solscan badge into document.body during SSR skeleton load', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    // SSR state: no heading elements, no <main>, address in __NEXT_DATA__ script
    document.body.innerHTML = `
      <div class="flex flex-col min-h-screen">
        <div class="animate-pulse rounded-md bg-muted h-6 w-full"></div>
      </div>
      <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"address":"${TOKEN_A}"}}}</script>
    `;
    document.title = `Token ${TOKEN_A} | Solscan`;

    platform.renderLoadingBadge(TOKEN_A);

    // Badge must NOT be in the DOM — inserting after body is invisible and blocks later reinsertion
    expect(document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`)).toBeNull();

    // Simulate React hydration: real content renders with the token name h4
    document.body.innerHTML = `
      <div class="flex flex-col min-h-screen">
        <div>
          <h4 class="not-italic text-neutral8 text-[22px] leading-[28px] font-medium truncate">Token <span>GasStation</span></h4>
        </div>
      </div>
    `;
    document.title = 'GasStation (GAS) | Solscan';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 72,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const h4 = document.querySelector('h4');
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(h4?.nextElementSibling).toBe(badge);
  });

  it('skips earlier h4 section headers and badges the token name h4', () => {
    const platform = new SolscanPlatform();
    window.history.replaceState({}, '', `/token/${TOKEN_A}`);
    document.body.innerHTML = `
      <main>
        <h4>Overview</h4>
        <div>
          <h4 class="not-italic text-neutral8 text-[22px] leading-[28px] font-medium truncate">Token <span class="text-neutral6">Moonbirds</span></h4>
        </div>
      </main>
    `;
    document.title = 'Moonbirds (MOON) | Solscan';

    platform.renderScoreBadge(TOKEN_A, {
      address: TOKEN_A,
      chain: 'solana',
      score: 70,
      risk: 'low',
      checks: {},
      cached: false,
    });

    const overviewH4 = document.querySelector('h4');
    const tokenNameH4 = document.querySelectorAll('h4')[1];
    const badge = document.querySelector(`[data-barryguard-badge="${TOKEN_A}"]`);

    expect(tokenNameH4?.nextElementSibling).toBe(badge);
    expect(overviewH4?.nextElementSibling).not.toBe(badge);
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
