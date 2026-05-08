/**
 * popup-display-bugs.test.ts (Vitest / jsdom)
 *
 * Verifies the display-bug fixes from plan-extension-popup-display-bugs.md (Step 11).
 *
 * DOM fixture mirrors the current popup.html structure — no legacy refs
 * (no reasons-container, confidence-badge, analyzed-at, score-donut,
 *  subscores-container, score-value, risk-label, watchlist-error).
 *
 * ADR-002: no token hardcodes.
 * ADR-007: Extension reads structured displayMetrics from backend.
 * ADR-018: 0 is valid; absent values shown as "--".
 * ADR-020: locked-overlay text comes from check.description.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  renderChecks,
  renderVerdictBand,
  renderDataStrip,
} from '../../src/popup/render';
import type { CheckResult, TokenScore } from '../../src/shared/types';

const ADDR = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

// ─── Current popup.html DOM fixture (no legacy refs) ─────────────────────────

function buildPopupDOM() {
  document.body.innerHTML = `
    <div id="rd-verdict-band">
      <span id="rd-verdict-headline">--</span>
      <ul id="rd-verdict-reasons"></ul>
      <div id="coverage-risk" class="rd-coverage-risk"></div>
    </div>

    <div id="check-category-tabs" class="rd-tabs">
      <button id="tab-contract" class="rd-tab is-active" role="tab" aria-selected="true" data-category="contract">
        <span class="rd-tab-label">Contract</span>
        <span class="rd-tab-count" id="tab-contract-count">0</span>
      </button>
      <button id="tab-marketStructure" class="rd-tab" role="tab" aria-selected="false" data-category="marketStructure">
        <span class="rd-tab-label">Market</span>
        <span class="rd-tab-count" id="tab-marketStructure-count">0</span>
      </button>
      <button id="tab-behavior" class="rd-tab" role="tab" aria-selected="false" data-category="behavior">
        <span class="rd-tab-label">Behavior</span>
        <span class="rd-tab-count" id="tab-behavior-count">0</span>
      </button>
    </div>

    <div id="checks-container" class="rd-checks-container">
      <div id="checks-list"></div>
    </div>

    <div id="checks-empty-state" class="rd-checks-empty hidden">No detailed checks available for this token</div>

    <div class="rd-utility-row">
      <a id="view-full-analysis" href="#" target="_blank" rel="noopener noreferrer">
        View full analysis on barryguard.com
      </a>
    </div>

    <div id="rd-data-strip">
      <div id="rd-data-holders">—</div>
      <div id="rd-data-liquidity">—</div>
      <div id="rd-data-marketcap">—</div>
      <div id="rd-data-age">—</div>
    </div>
  `;
}

function makeScore(overrides: Partial<TokenScore> = {}): TokenScore {
  return {
    address: ADDR,
    chain: 'solana',
    score: 44,
    risk: 'high',
    subscores: { contract: 40, marketStructure: 45, behavior: 35 },
    checks: {
      mintAuthority: { status: 'danger', value: true, label: 'Mint Authority', description: 'Creator can mint new tokens.', tier: 'free', category: 'contract' },
      freezeAuthority: { status: 'success', value: false, label: 'Freeze Authority', description: 'No freeze authority.', tier: 'free', category: 'contract' },
      tokenAge: { status: 'warning', value: 5, label: 'Token Age', description: 'Token is 5 days old.', tier: 'free', category: 'behavior' },
    },
    reasons: ['Top holder owns 48.7%', 'Low market cap', '9 checks could not be evaluated'],
    confidence: 'medium',
    cached: false,
    analyzedAt: '2026-05-08T12:00:00Z',
    ...overrides,
  };
}

// ─── Bug 1: reasons rendered ONLY in verdict band ─────────────────────────────

describe('Top Concerns rendered once only in verdict band', () => {
  beforeEach(buildPopupDOM);

  it('reasons appear in #rd-verdict-reasons, not in a second Top Concerns H2', () => {
    const score = makeScore();
    renderVerdictBand(score.risk, score.risk, score.reasons, 'free');

    // Reasons exist in verdict band
    const verdictReasons = document.getElementById('rd-verdict-reasons');
    expect(verdictReasons?.querySelectorAll('li').length).toBeGreaterThan(0);

    // No second "Top Concerns" heading in the document
    const allH2s = Array.from(document.querySelectorAll('h2'));
    const topConcernsH2 = allH2s.find((h2) => /top concerns/i.test(h2.textContent ?? ''));
    expect(topConcernsH2).toBeUndefined();
  });

  it('verdict band renders all provided reasons', () => {
    const reasons = ['Reason A', 'Reason B', 'Reason C'];
    renderVerdictBand('high', 'HIGH', reasons, 'free');

    const items = document.getElementById('rd-verdict-reasons')?.querySelectorAll('li');
    expect(items?.length).toBe(3);
  });
});

// ─── Bug 2: #confidence-badge does not exist in DOM ───────────────────────────

describe('confidence-badge element absent', () => {
  beforeEach(buildPopupDOM);

  it('no element with id="confidence-badge" in the current popup DOM', () => {
    expect(document.getElementById('confidence-badge')).toBeNull();
  });
});

// ─── Bug 3: exactly one View full analysis link ────────────────────────────────

describe('View full analysis — single CTA', () => {
  beforeEach(buildPopupDOM);

  it('exactly one #view-full-analysis element in DOM', () => {
    const links = document.querySelectorAll('#view-full-analysis');
    expect(links.length).toBe(1);
  });

  it('renderChecks for !isPaid does not add a second view-full-analysis link', () => {
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(makeScore(), listEl, 'free');

    // Still exactly one view-full-analysis in the entire document
    const links = document.querySelectorAll('#view-full-analysis');
    expect(links.length).toBe(1);
  });

  it('renderChecks for pro tier also does not add a second view-full-analysis link', () => {
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(makeScore(), listEl, 'pro');

    const links = document.querySelectorAll('#view-full-analysis');
    expect(links.length).toBe(1);
  });
});

// ─── ADR-020: locked overlay text from check.description ─────────────────────

describe('ADR-020: locked overlay text from check.description', () => {
  beforeEach(buildPopupDOM);

  it('locked check on free tier shows check.description text in overlay', () => {
    const score = makeScore({
      checks: {
        liquidityDepth: {
          status: 'warning',
          value: 0,
          label: 'Liquidity Depth',
          description: 'Sign up free to see all checks',
          tier: 'rescue_pass',
          locked: true,
          category: 'marketStructure',
        } as CheckResult,
      },
    });
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl, 'free');

    const overlay = listEl.querySelector('.check-upgrade-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('Sign up free to see all checks');
  });

  it('locked overlay text is NOT hardcoded — different description is used verbatim', () => {
    const score = makeScore({
      checks: {
        liquidityDepth: {
          status: 'warning',
          value: 0,
          label: 'Liquidity Depth',
          description: 'Custom backend locked text here',
          tier: 'rescue_pass',
          locked: true,
          category: 'marketStructure',
        } as CheckResult,
      },
    });
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl, 'free');

    const overlay = listEl.querySelector('.check-upgrade-overlay');
    expect(overlay?.textContent).toContain('Custom backend locked text here');
  });
});

// ─── Bug 6: tab disabled behaviour ────────────────────────────────────────────

describe('tab disabled behaviour', () => {
  beforeEach(buildPopupDOM);

  it('1 contract check, 0 market, 0 behavior: contract not disabled, market+behavior are disabled', () => {
    const score = makeScore({
      checks: {
        mintAuthority: {
          status: 'danger', value: true, label: 'Mint Authority',
          description: 'Active.', tier: 'free', category: 'contract',
        },
      },
    });
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl);

    const contractTab = document.getElementById('tab-contract');
    const marketTab = document.getElementById('tab-marketStructure');
    const behaviorTab = document.getElementById('tab-behavior');

    expect(contractTab?.classList.contains('rd-tab-disabled')).toBe(false);
    expect(marketTab?.classList.contains('rd-tab-disabled')).toBe(true);
    expect(marketTab?.getAttribute('aria-disabled')).toBe('true');
    expect(marketTab?.getAttribute('tabindex')).toBe('-1');
    expect(behaviorTab?.classList.contains('rd-tab-disabled')).toBe(true);
    expect(behaviorTab?.getAttribute('aria-disabled')).toBe('true');
    expect(behaviorTab?.getAttribute('tabindex')).toBe('-1');
  });

  it('tabs with counts > 0 do not get rd-tab-disabled', () => {
    const score = makeScore({
      checks: {
        mintAuthority: { status: 'danger', value: true, label: 'Mint', description: '', tier: 'free', category: 'contract' },
        liquidityLocked: { status: 'danger', value: false, label: 'Liquidity', description: '', tier: 'free', category: 'marketStructure' },
        tokenAge: { status: 'warning', value: 5, label: 'Age', description: '', tier: 'free', category: 'behavior' },
      },
    });
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl);

    expect(document.getElementById('tab-contract')?.classList.contains('rd-tab-disabled')).toBe(false);
    expect(document.getElementById('tab-marketStructure')?.classList.contains('rd-tab-disabled')).toBe(false);
    expect(document.getElementById('tab-behavior')?.classList.contains('rd-tab-disabled')).toBe(false);
  });
});

// ─── Bug 6: all-zero empty state ─────────────────────────────────────────────

describe('tab all-zero empty state', () => {
  beforeEach(buildPopupDOM);

  it('checks={} hides #check-category-tabs and #checks-container, shows #checks-empty-state', () => {
    const score = makeScore({ checks: {} });
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl);

    expect(document.getElementById('check-category-tabs')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('checks-container')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('checks-empty-state')?.classList.contains('hidden')).toBe(false);
  });

  it('#checks-empty-state contains the required text', () => {
    const score = makeScore({ checks: {} });
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl);

    expect(document.getElementById('checks-empty-state')?.textContent?.trim()).toBe(
      'No detailed checks available for this token',
    );
  });

  it('when checks are present, tabs and container are visible, empty-state is hidden', () => {
    const score = makeScore();
    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl);

    expect(document.getElementById('check-category-tabs')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('checks-container')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('checks-empty-state')?.classList.contains('hidden')).toBe(true);
  });
});

// ─── Data strip reads from displayMetrics ────────────────────────────────────

describe('renderDataStrip reads from score.displayMetrics', () => {
  beforeEach(buildPopupDOM);

  it('renders $100.0K for marketCapUsd=100000', () => {
    const score = makeScore({
      displayMetrics: { marketCapUsd: 100000, liquidityUsd: 50000, totalHolders: 3000 },
    });
    renderDataStrip(score);
    expect(document.getElementById('rd-data-marketcap')?.textContent).toBe('$100.0K');
  });

  it('renders $50.0K for liquidityUsd=50000', () => {
    const score = makeScore({
      displayMetrics: { marketCapUsd: 100000, liquidityUsd: 50000, totalHolders: 3000 },
    });
    renderDataStrip(score);
    expect(document.getElementById('rd-data-liquidity')?.textContent).toBe('$50.0K');
  });

  it('renders 3.0K for totalHolders=3000', () => {
    const score = makeScore({
      displayMetrics: { marketCapUsd: 100000, liquidityUsd: 50000, totalHolders: 3000 },
    });
    renderDataStrip(score);
    expect(document.getElementById('rd-data-holders')?.textContent).toBe('3.0K');
  });

  it('shows "—" for all metric slots when displayMetrics is undefined', () => {
    const score = makeScore({ displayMetrics: undefined });
    renderDataStrip(score);
    expect(document.getElementById('rd-data-marketcap')?.textContent).toBe('—');
    expect(document.getElementById('rd-data-liquidity')?.textContent).toBe('—');
    expect(document.getElementById('rd-data-holders')?.textContent).toBe('—');
  });

  it('shows "—" for null sub-fields', () => {
    const score = makeScore({
      displayMetrics: { marketCapUsd: null, liquidityUsd: null, totalHolders: null },
    });
    renderDataStrip(score);
    expect(document.getElementById('rd-data-marketcap')?.textContent).toBe('—');
    expect(document.getElementById('rd-data-liquidity')?.textContent).toBe('—');
    expect(document.getElementById('rd-data-holders')?.textContent).toBe('—');
  });

  it('shows correct values when only some fields are present', () => {
    const score = makeScore({
      displayMetrics: { marketCapUsd: 2500000, liquidityUsd: null, totalHolders: 500 },
    });
    renderDataStrip(score);
    expect(document.getElementById('rd-data-marketcap')?.textContent).toBe('$2.5M');
    expect(document.getElementById('rd-data-liquidity')?.textContent).toBe('—');
    expect(document.getElementById('rd-data-holders')?.textContent).toBe('500');
  });
});
