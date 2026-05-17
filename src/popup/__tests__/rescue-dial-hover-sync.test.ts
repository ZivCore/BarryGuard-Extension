/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyLegendFocusEffects,
  categoryToRingKey,
  renderLegendValues,
  renderTripleRings,
  ringKeyToCategory,
  setHoverSyncCallback,
  setRingFocus,
} from '../render';
import { renderChecks } from '../render';
import type { CheckCategory } from '../check-categories';
import type { TokenScore } from '../../shared/types';

// ─── DOM Helper ──────────────────────────────────────────────────────────────

function setupDom() {
  document.body.innerHTML = `
    <div id="rd-rings"></div>

    <div class="rd-legend-col" data-key="contract" tabindex="0">
      <span id="rd-legend-contract-value">--</span>
      <div class="rd-legend-rule"></div>
    </div>
    <div class="rd-legend-col" data-key="market" tabindex="0">
      <span id="rd-legend-market-value">--</span>
      <div class="rd-legend-rule"></div>
    </div>
    <div class="rd-legend-col" data-key="behavior" tabindex="0">
      <span id="rd-legend-behavior-value">--</span>
      <div class="rd-legend-rule"></div>
    </div>

    <div id="check-category-tabs">
      <button id="tab-contract" class="rd-tab" data-category="contract">
        <span id="tab-contract-count">0</span>
      </button>
      <button id="tab-marketStructure" class="rd-tab" data-category="marketStructure">
        <span id="tab-marketStructure-count">0</span>
      </button>
      <button id="tab-behavior" class="rd-tab" data-category="behavior">
        <span id="tab-behavior-count">0</span>
      </button>
    </div>

    <div id="checks-container">
      <div id="checks-list"></div>
    </div>
    <div id="checks-empty-state" class="hidden"></div>
  `;

  return {
    host: document.getElementById('rd-rings')!,
    legendContract: document.querySelector<HTMLElement>('.rd-legend-col[data-key="contract"]')!,
    legendMarket: document.querySelector<HTMLElement>('.rd-legend-col[data-key="market"]')!,
    legendBehavior: document.querySelector<HTMLElement>('.rd-legend-col[data-key="behavior"]')!,
    tabContract: document.getElementById('tab-contract') as HTMLButtonElement,
    tabMarket: document.getElementById('tab-marketStructure') as HTMLButtonElement,
    tabBehavior: document.getElementById('tab-behavior') as HTMLButtonElement,
    tabContainer: document.getElementById('check-category-tabs')!,
    checksList: document.getElementById('checks-list') as HTMLElement,
  };
}

function getRingGroup(host: HTMLElement, key: string): SVGGElement | null {
  return host.querySelector<SVGGElement>(`g[data-ring-key="${key}"]`);
}

function getArcPath(g: SVGGElement): SVGPathElement | null {
  return g.querySelector<SVGPathElement>('path[data-arc="true"]');
}

function getHitAreas(host: HTMLElement): NodeListOf<SVGPathElement> {
  return host.querySelectorAll<SVGPathElement>('path[stroke="transparent"]');
}

const DEFAULT_SUBSCORES = { contract: 50, market: 60, behavior: 70 };

// ─── Reset between tests ─────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  setRingFocus(null);
  setHoverSyncCallback(null as unknown as (c: CheckCategory) => void);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('rescue-dial-hover-sync', () => {
  // Test 1
  it('1: renderTripleRings renders one transparent hit-area path per ring with all subscores', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);
    const hitAreas = getHitAreas(host);
    expect(hitAreas.length).toBe(3);
  });

  // Test 2
  it('2: mouseenter on contract hit-area calls hoverSyncCallback with "contract"', () => {
    const { host } = setupDom();
    const stub = vi.fn();
    setHoverSyncCallback(stub);
    renderTripleRings(80, DEFAULT_SUBSCORES);

    const contractGroup = getRingGroup(host, 'contract')!;
    const hitArea = contractGroup.querySelector<SVGPathElement>('path[stroke="transparent"]')!;
    hitArea.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(stub).toHaveBeenCalledWith('contract');
  });

  // Test 3
  it('3: mouseenter on market hit-area calls hoverSyncCallback with "marketStructure" (key mapping)', () => {
    const { host } = setupDom();
    const stub = vi.fn();
    setHoverSyncCallback(stub);
    renderTripleRings(80, DEFAULT_SUBSCORES);

    const marketGroup = getRingGroup(host, 'market')!;
    const hitArea = marketGroup.querySelector<SVGPathElement>('path[stroke="transparent"]')!;
    hitArea.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(stub).toHaveBeenCalledWith('marketStructure');
  });

  // Test 4
  it('4: mouseenter on behavior hit-area dims contract+market (opacity 0.28), thickens behavior arc to 14', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);

    const behaviorGroup = getRingGroup(host, 'behavior')!;
    const hitArea = behaviorGroup.querySelector<SVGPathElement>('path[stroke="transparent"]')!;
    hitArea.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const contractGroup = getRingGroup(host, 'contract')!;
    const marketGroup = getRingGroup(host, 'market')!;

    expect(contractGroup.style.opacity).toBe('0.28');
    expect(marketGroup.style.opacity).toBe('0.28');
    expect(behaviorGroup.style.opacity).toBe('1');

    // ring.w = 12, focused arc = 12 + 2 = 14
    expect(getArcPath(behaviorGroup)?.getAttribute('stroke-width')).toBe('14');
    expect(getArcPath(contractGroup)?.getAttribute('stroke-width')).toBe('12');
    expect(getArcPath(marketGroup)?.getAttribute('stroke-width')).toBe('12');
  });

  // Test 5
  it('5: mouseleave resets all ring opacities to 1 and arc strokes to 12', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);

    const behaviorGroup = getRingGroup(host, 'behavior')!;
    const hitArea = behaviorGroup.querySelector<SVGPathElement>('path[stroke="transparent"]')!;
    hitArea.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    hitArea.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    for (const key of ['contract', 'market', 'behavior']) {
      const g = getRingGroup(host, key)!;
      expect(g.style.opacity).toBe('1');
      const arc = getArcPath(g);
      if (arc) {
        expect(arc.getAttribute('stroke-width')).toBe('12');
      }
    }
  });

  // Test 6
  it('6: setRingFocus via categoryToRingKey("marketStructure") dims contract+behavior, thickens market arc', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);
    setRingFocus(categoryToRingKey('marketStructure'));

    const contractGroup = getRingGroup(host, 'contract')!;
    const marketGroup = getRingGroup(host, 'market')!;
    const behaviorGroup = getRingGroup(host, 'behavior')!;

    expect(contractGroup.style.opacity).toBe('0.28');
    expect(behaviorGroup.style.opacity).toBe('0.28');
    expect(marketGroup.style.opacity).toBe('1');
    expect(getArcPath(marketGroup)?.getAttribute('stroke-width')).toBe('14');
  });

  // Test 7
  it('7: setRingFocus("market") then setRingFocus(null) resets all opacities to 1 and strokes to 12', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);
    setRingFocus('market');
    setRingFocus(null);

    for (const key of ['contract', 'market', 'behavior']) {
      const g = getRingGroup(host, key)!;
      expect(g.style.opacity).toBe('1');
      const arc = getArcPath(g);
      if (arc) {
        expect(arc.getAttribute('stroke-width')).toBe('12');
      }
    }
  });

  // Test 8
  it('8: behavior ring with null subscore has no hit-area; other rings still have hit-areas', () => {
    const { host } = setupDom();
    renderTripleRings(80, { contract: 50, market: 60, behavior: null });

    const behaviorGroup = getRingGroup(host, 'behavior')!;
    expect(behaviorGroup.querySelector<SVGPathElement>('path[stroke="transparent"]')).toBeNull();

    expect(getHitAreas(host).length).toBe(2);
  });

  // Test 9
  it('9: legend column with null subscore has data-disabled="true", tabindex="-1", mouseenter does not call stub', () => {
    const { legendBehavior } = setupDom();
    const stub = vi.fn();
    setHoverSyncCallback(stub);

    renderLegendValues({ contract: 50, market: 60, behavior: null });

    expect(legendBehavior.getAttribute('data-disabled')).toBe('true');
    expect(legendBehavior.getAttribute('tabindex')).toBe('-1');

    legendBehavior.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(stub).not.toHaveBeenCalled();
  });

  // Test 10
  it('10: renderChecks with only contract checks gives rd-tab-disabled + aria-disabled on market+behavior tabs', () => {
    setupDom();

    const score: TokenScore = {
      address: 'So11111111111111111111111111111111111111112',
      chain: 'solana',
      score: 42,
      risk: 'high',
      subscores: { contract: 35, marketStructure: 55, behavior: 28 },
      checks: {
        mintAuthority: {
          status: 'danger',
          value: true,
          label: 'Mint authority active',
          description: 'Creator can mint.',
          tier: 'free',
          category: 'contract',
        },
        freezeAuthority: {
          status: 'success',
          value: false,
          label: 'Freeze authority disabled',
          description: 'No freeze.',
          tier: 'free',
          category: 'contract',
        },
      },
      reasons: [],
      confidence: 'medium',
      cached: false,
      analyzedAt: '2026-01-01T00:00:00Z',
    };

    const listEl = document.getElementById('checks-list') as HTMLElement;
    renderChecks(score, listEl);

    const tabMarket = document.getElementById('tab-marketStructure') as HTMLButtonElement;
    const tabBehavior = document.getElementById('tab-behavior') as HTMLButtonElement;

    expect(tabMarket.classList.contains('rd-tab-disabled')).toBe(true);
    expect(tabMarket.getAttribute('aria-disabled')).toBe('true');
    expect(tabBehavior.classList.contains('rd-tab-disabled')).toBe(true);
    expect(tabBehavior.getAttribute('aria-disabled')).toBe('true');
  });

  // Test 11
  it('11: click on contract legend column calls stub with "contract"; second click also calls stub (idempotent)', () => {
    const { legendContract } = setupDom();
    const stub = vi.fn();
    setHoverSyncCallback(stub);

    renderLegendValues({ contract: 50, market: 60, behavior: 70 });

    legendContract.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith('contract');

    stub.mockClear();
    legendContract.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(stub).toHaveBeenCalledWith('contract');
  });

  // Test 12
  it('12: second renderTripleRings call resets focus to 1 and produces exactly 3 hit-areas', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);
    setRingFocus('contract');

    // Verify dimming happened
    expect(getRingGroup(host, 'market')!.style.opacity).toBe('0.28');

    // Second render (token change)
    renderTripleRings(80, { contract: 40, market: 30, behavior: 20 });

    for (const key of ['contract', 'market', 'behavior']) {
      expect(getRingGroup(host, key)!.style.opacity).toBe('1');
    }

    expect(getHitAreas(host).length).toBe(3);
  });

  // Test 13 — Codex-Finding 2
  it('13: after re-render with behavior=null, mouseenter on behavior legend is silenced by disabled gate', () => {
    const { legendBehavior } = setupDom();
    const stub = vi.fn();
    setHoverSyncCallback(stub);

    // First render — behavior has a value, listener binds
    renderLegendValues({ contract: 50, market: 60, behavior: 70 });

    legendBehavior.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(stub).toHaveBeenCalledWith('behavior');
    stub.mockClear();

    // Re-render same DOM node with behavior = null
    renderLegendValues({ contract: 50, market: 60, behavior: null });

    expect(legendBehavior.getAttribute('data-disabled')).toBe('true');

    legendBehavior.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(stub).not.toHaveBeenCalled();
  });

  // Test 14 — Codex-Finding 3
  it('14: setRingFocus then renderTripleRings resets all ring opacities to 1 (focus-reset at render start)', () => {
    const { host } = setupDom();
    renderTripleRings(80, DEFAULT_SUBSCORES);

    // Stale focus from previous token
    setRingFocus('contract');
    expect(getRingGroup(host, 'market')!.style.opacity).toBe('0.28');

    // Any render path calls renderTripleRings which resets focus first
    renderTripleRings(80, { contract: 55, market: 65, behavior: 75 });

    for (const key of ['contract', 'market', 'behavior']) {
      expect(getRingGroup(host, key)!.style.opacity).toBe('1');
    }
  });
});
