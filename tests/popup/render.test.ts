// tests/popup/render.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHECK_METADATA,
  getConfidenceDisplay,
  renderAnalysisFooter,
  renderChecks,
  renderReasons,
  renderSubscores,
} from '../../src/popup/render';
import type { TokenScore } from '../../src/shared/types';

const ADDR = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

function makeScore(overrides: Partial<TokenScore> = {}): TokenScore {
  return {
    address: ADDR,
    chain: 'solana',
    score: 42,
    risk: 'high',
    subscores: { contract: 35, marketStructure: 55, behavior: 28 },
    checks: {
      mintAuthority: { status: 'danger', value: true, label: 'Mint authority active', description: 'Creator can mint new tokens.', tier: 'free' },
      freezeAuthority: { status: 'success', value: false, label: 'Freeze authority disabled', description: 'No freeze authority.', tier: 'free' },
      liquidityLocked: { status: 'danger', value: 'unlocked', label: 'Liquidity not locked', description: 'Can be removed at any time.', tier: 'free' },
      topHolderConcentration: { status: 'warning', value: 14.2, label: 'Top holder 14.2%', description: 'Single wallet holds 14.2%.', tier: 'free' },
      tokenAge: { status: 'warning', value: 90, label: 'Token age 1h', description: 'Live for 1h.', tier: 'free' },
      holderCount: { status: 'warning', value: '87', label: '87 holders', description: 'Held by 87 wallets.', tier: 'free' },
      developerHistory: { status: 'danger', value: 'bad', label: 'Developer reputation: bad', description: 'Creator has 8 rugs.', tier: 'free' },
      insiderNetwork: { status: 'danger', value: 3, label: 'Insider network detected', description: '3 holders share funding source.', tier: 'free' },
    },
    reasons: [
      'Mint authority is still active',
      'Creator has 8 suspected rugs out of 10 tokens.',
      'Top 5 wallets may collectively control 38.4% of supply.',
      'Liquidity can be removed at any time.',
    ],
    confidence: 'medium',
    cached: true,
    analyzedAt: '2026-03-16T10:00:00Z',
    ...overrides,
  };
}

// ─── renderChecks ─────────────────────────────────────────────────────────────

describe('renderChecks', () => {
  it('renders all 18 checks from CHECK_ORDER', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl);
    expect(listEl.querySelectorAll('.check-item').length).toBe(21);
  });

  it('uses ✅ icon for safe/success status', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl);
    const successIcons = Array.from(listEl.querySelectorAll('.check-icon.success'));
    expect(successIcons.length).toBeGreaterThan(0);
    expect(successIcons[0].textContent).toBe('✅');
  });

  it('uses ⚠️ icon for warning status', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl);
    const warningIcons = Array.from(listEl.querySelectorAll('.check-icon.warning'));
    expect(warningIcons.length).toBeGreaterThan(0);
    expect(warningIcons[0].textContent).toBe('⚠️');
  });

  it('uses ❌ icon for danger status', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl);
    const dangerIcons = Array.from(listEl.querySelectorAll('.check-icon.danger'));
    expect(dangerIcons.length).toBeGreaterThan(0);
    expect(dangerIcons[0].textContent).toBe('❌');
  });

  it('shows check label text in each item', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl);
    const labels = Array.from(listEl.querySelectorAll('.check-label')).map((el) => el.textContent);
    expect(labels).toContain('Mint Authority');
    expect(labels).toContain('Freeze Authority');
  });

  it('shows check description text in each item', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl);
    const descs = Array.from(listEl.querySelectorAll('.check-description')).map((el) => el.textContent);
    expect(descs.some((d) => d?.includes('mint') || d?.includes('No freeze'))).toBe(true);
  });

  it('renders earlyDump check when present in score.checks', () => {
    const listEl = document.createElement('div');
    const score = makeScore({
      checks: {
        ...makeScore().checks,
        earlyDump: { status: 'danger', value: true, label: 'Early dump detected', description: 'Dev wallet sold within 5 min.', tier: 'free' },
      },
    });
    renderChecks(score, listEl);
    const labels = Array.from(listEl.querySelectorAll('.check-label')).map((el) => el.textContent);
    expect(labels).toContain('Early Dump');
  });

  it('renders sniperDominance check when present in score.checks', () => {
    const listEl = document.createElement('div');
    const score = makeScore({
      checks: {
        ...makeScore().checks,
        sniperDominance: { status: 'warning', value: 22, label: 'Sniper dominance 22%', description: '22% of early buys from snipers.', tier: 'free' },
      },
    });
    renderChecks(score, listEl);
    const labels = Array.from(listEl.querySelectorAll('.check-label')).map((el) => el.textContent);
    expect(labels).toContain('Sniper Dominance');
  });

  it('renders sellability check when present in score.checks', () => {
    const listEl = document.createElement('div');
    const score = makeScore({
      checks: {
        ...makeScore().checks,
        sellability: { status: 'success', value: true, label: 'Token sellable', description: 'No sell restrictions detected.', tier: 'free' },
      },
    });
    renderChecks(score, listEl);
    const labels = Array.from(listEl.querySelectorAll('.check-label')).map((el) => el.textContent);
    expect(labels).toContain('Sellability');
  });

  it('renders all CHECK_ORDER items even when absent from score.checks', () => {
    const listEl = document.createElement('div');
    renderChecks(makeScore(), listEl); // makeScore has minimal checks
    const items = listEl.querySelectorAll('.check-item');
    expect(items.length).toBe(21); // all 18 ordered checks rendered (missing ones show placeholder)
  });
});

// ─── CHECK_METADATA Phase C entries ───────────────────────────────────────────

describe('CHECK_METADATA Phase C entries', () => {
  it('has earlyDump entry with label and teaser', () => {
    expect(CHECK_METADATA['earlyDump']).toBeDefined();
    expect(CHECK_METADATA['earlyDump'].label).toBeTruthy();
    expect(CHECK_METADATA['earlyDump'].teaser).toBeTruthy();
  });

  it('has sniperDominance entry with label and teaser', () => {
    expect(CHECK_METADATA['sniperDominance']).toBeDefined();
    expect(CHECK_METADATA['sniperDominance'].label).toBeTruthy();
    expect(CHECK_METADATA['sniperDominance'].teaser).toBeTruthy();
  });

  it('has sellability entry with label and teaser', () => {
    expect(CHECK_METADATA['sellability']).toBeDefined();
    expect(CHECK_METADATA['sellability'].label).toBeTruthy();
    expect(CHECK_METADATA['sellability'].teaser).toBeTruthy();
  });
});

// ─── renderReasons ────────────────────────────────────────────────────────────

describe('renderReasons', () => {
  it('reads reasons from score.reasons (not score.topConcerns)', () => {
    const containerEl = document.createElement('div');
    containerEl.classList.add('hidden');
    const listEl = document.createElement('ul');
    const score = makeScore({ reasons: ['Reason A', 'Reason B', 'Reason C'] });

    renderReasons(score, containerEl, listEl);

    expect(containerEl.classList.contains('hidden')).toBe(false);
    expect(listEl.querySelectorAll('li').length).toBe(3);
    expect(listEl.querySelectorAll('li')[0].textContent).toBe('Reason A');
  });

  it('limits displayed reasons to top 3', () => {
    const containerEl = document.createElement('div');
    const listEl = document.createElement('ul');
    const score = makeScore({ reasons: ['R1', 'R2', 'R3', 'R4', 'R5'] });

    renderReasons(score, containerEl, listEl);

    expect(listEl.querySelectorAll('li').length).toBe(3);
  });

  it('hides the container when reasons array is empty', () => {
    const containerEl = document.createElement('div');
    containerEl.classList.remove('hidden');
    const listEl = document.createElement('ul');
    const score = makeScore({ reasons: [] });

    renderReasons(score, containerEl, listEl);

    expect(containerEl.classList.contains('hidden')).toBe(true);
  });

  it('hides the container when reasons is undefined', () => {
    const containerEl = document.createElement('div');
    containerEl.classList.remove('hidden');
    const listEl = document.createElement('ul');
    // Simulate a score object where reasons is missing
    const score = makeScore({ reasons: undefined as unknown as string[] });

    renderReasons(score, containerEl, listEl);

    expect(containerEl.classList.contains('hidden')).toBe(true);
  });
});

// ─── renderSubscores ──────────────────────────────────────────────────────────

describe('renderSubscores', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="subscore-contract">
        <div id="subscore-contract-bar" style="width: 0%"></div>
        <span id="subscore-contract-value">--/100</span>
      </div>
      <div id="subscore-marketStructure">
        <div id="subscore-marketStructure-bar" style="width: 0%"></div>
        <span id="subscore-marketStructure-value">--/100</span>
      </div>
      <div id="subscore-behavior">
        <div id="subscore-behavior-bar" style="width: 0%"></div>
        <span id="subscore-behavior-value">--/100</span>
      </div>
    `;
  });

  it('updates all three subscore values', () => {
    renderSubscores(makeScore({ subscores: { contract: 35, marketStructure: 55, behavior: 28 } }));

    expect(document.getElementById('subscore-contract-value')?.textContent).toBe('35/100');
    expect(document.getElementById('subscore-marketStructure-value')?.textContent).toBe('55/100');
    expect(document.getElementById('subscore-behavior-value')?.textContent).toBe('28/100');
  });

  it('sets bar widths to match score percentages', () => {
    renderSubscores(makeScore({ subscores: { contract: 35, marketStructure: 55, behavior: 28 } }));

    expect(document.getElementById('subscore-contract-bar')?.style.width).toBe('35%');
    expect(document.getElementById('subscore-marketStructure-bar')?.style.width).toBe('55%');
    expect(document.getElementById('subscore-behavior-bar')?.style.width).toBe('28%');
  });

  it('clamps bar values to 0–100', () => {
    renderSubscores(makeScore({ subscores: { contract: 150, marketStructure: -10, behavior: 50 } }));

    expect(document.getElementById('subscore-contract-bar')?.style.width).toBe('100%');
    expect(document.getElementById('subscore-marketStructure-bar')?.style.width).toBe('0%');
  });

  it('applies score-danger class for scores at or below 29', () => {
    renderSubscores(makeScore({ subscores: { contract: 20, marketStructure: 55, behavior: 28 } }));
    expect(document.getElementById('subscore-contract-bar')?.classList.contains('score-danger')).toBe(true);
  });
});

// ─── getConfidenceDisplay ─────────────────────────────────────────────────────

describe('getConfidenceDisplay', () => {
  it('maps high → "All checks available" with empty className', () => {
    expect(getConfidenceDisplay('high')).toEqual({ text: 'All checks available', className: '' });
  });

  it('maps medium → "Some checks pending" with medium className', () => {
    expect(getConfidenceDisplay('medium')).toEqual({ text: 'Some checks pending', className: 'medium' });
  });

  it('maps low → "Limited blockchain data" with low className', () => {
    expect(getConfidenceDisplay('low')).toEqual({ text: 'Limited blockchain data', className: 'low' });
  });
});

// ─── renderAnalysisFooter ─────────────────────────────────────────────────────

describe('renderAnalysisFooter', () => {
  it('uses score.confidence for badge text — not score.cached', () => {
    const analyzedAtEl = document.createElement('span');
    const badgeEl = document.createElement('span');
    // cached=true but confidence='medium' — must show 'Some checks pending', not 'Cached data'
    const score = makeScore({ cached: true, confidence: 'medium', analyzedAt: '2026-03-16T10:00:00Z' });

    renderAnalysisFooter(score, analyzedAtEl, badgeEl);

    expect(badgeEl.textContent).toBe('Some checks pending');
    expect(badgeEl.classList.contains('medium')).toBe(true);
  });

  it('shows "Data: Complete" for high confidence', () => {
    const analyzedAtEl = document.createElement('span');
    const badgeEl = document.createElement('span');

    renderAnalysisFooter(makeScore({ confidence: 'high' }), analyzedAtEl, badgeEl);

    expect(badgeEl.textContent).toBe('All checks available');
    expect(badgeEl.className).toBe('confidence-badge');
  });

  it('shows "Data: Limited" for low confidence', () => {
    const analyzedAtEl = document.createElement('span');
    const badgeEl = document.createElement('span');

    renderAnalysisFooter(makeScore({ confidence: 'low' }), analyzedAtEl, badgeEl);

    expect(badgeEl.textContent).toBe('Limited blockchain data');
    expect(badgeEl.classList.contains('low')).toBe(true);
  });

  it('shows relative analyzed-at time', () => {
    const analyzedAtEl = document.createElement('span');
    const badgeEl = document.createElement('span');
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    renderAnalysisFooter(makeScore({ analyzedAt: fiveMinAgo }), analyzedAtEl, badgeEl);

    expect(analyzedAtEl.textContent).toBe('Analyzed 5m ago');
  });

  it('shows "Analyzed just now" for very recent timestamps', () => {
    const analyzedAtEl = document.createElement('span');
    const badgeEl = document.createElement('span');
    const justNow = new Date(Date.now() - 10 * 1000).toISOString();

    renderAnalysisFooter(makeScore({ analyzedAt: justNow }), analyzedAtEl, badgeEl);

    expect(analyzedAtEl.textContent).toBe('Analyzed just now');
  });
});
