// src/popup/render.ts
// Rendering functions extracted from popup/index.ts for testability.
// These functions have no module-level side effects and can be imported in tests.

import type { CheckResult, ConfidenceLevel, RiskLevel, Subscores, TokenScore } from '../shared/types';
import { buildCheckUrl } from '../shared/check-url';
import { type CheckCategory, getCheckCategory, CATEGORY_ORDER } from './check-categories';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHECK_ORDER = [
  'mintAuthority',
  'freezeAuthority',
  'liquidityLocked',
  'honeypotSimulation',
  'lpCreatorMatch',
  'topHolderConcentration',
  'tokenAge',
  'holderCount',
  'developerHistory',
  'insiderNetwork',
  'bundleDetection',
  'earlyDump',
  'sniperDominance',
  'bondingCurveStatus',
  'liquidityDepth',
  'metadataLegitimacy',
  'creatorWalletAge',
  'priceImpact',
  'updateAuthority',
  'creatorRetention',
  'liquidityRatio',
] as const;

export const CHECK_METADATA: Record<string, { label: string; teaser: string }> = {
  mintAuthority: {
    label: 'Mint Authority',
    teaser: 'Checks whether new tokens can still be minted after launch.',
  },
  freezeAuthority: {
    label: 'Freeze Authority',
    teaser: 'Checks whether token transfers can still be frozen by an authority.',
  },
  liquidityLocked: {
    label: 'Liquidity Lock',
    teaser: 'Checks whether liquidity appears locked or can still be removed.',
  },
  topHolderConcentration: {
    label: 'Top Holder Concentration',
    teaser: 'Checks whether a small number of wallets control too much supply.',
  },
  tokenAge: {
    label: 'Token Age',
    teaser: 'Checks how new the token is and whether it lacks trading history.',
  },
  holderCount: {
    label: 'Holder Count',
    teaser: 'Checks how widely the token is distributed across wallet holders.',
  },
  developerHistory: {
    label: 'Developer History',
    teaser: 'Checks if the developer has a history of rug pulls or suspicious activity.',
  },
  clusterControl: {
    label: 'Cluster Control',
    teaser: 'Detects if wallets are controlled by a single entity (cluster).',
  },
  earlyDump: {
    label: 'Early Dump',
    teaser: 'Checks if the developer or early wallets sold shortly after launch.',
  },
  sniperDominance: {
    label: 'Sniper Dominance',
    teaser: 'Checks what share of early buys came from sniper or bot wallets.',
  },
  sellability: {
    label: 'Sellability',
    teaser: 'Checks whether the token can actually be sold without anomalies.',
  },
  honeypotSimulation: {
    label: 'Honeypot Detection',
    teaser: 'Simulates a real sell transaction to detect if the token can actually be sold.',
  },
  lpCreatorMatch: {
    label: 'LP Creator Match',
    teaser: 'Checks if the token creator also controls the liquidity pool.',
  },
  bundleDetection: {
    label: 'Bundle Detection',
    teaser: 'Detects if the creator bundled token creation with insider buys.',
  },
  insiderNetwork: {
    label: 'Insider Network',
    teaser: 'Analyzes if top holders are funded by the same wallet (coordinated buying).',
  },
  bondingCurveStatus: {
    label: 'Bonding Curve',
    teaser: 'Checks if the token is still on the bonding curve or has graduated.',
  },
  liquidityDepth: {
    label: 'Liquidity Depth',
    teaser: 'Measures the actual USD value available in the liquidity pool.',
  },
  metadataLegitimacy: {
    label: 'Metadata Check',
    teaser: 'Checks token name, symbol and image for scam patterns or missing data.',
  },
  creatorWalletAge: {
    label: 'Creator Wallet Age',
    teaser: 'Checks how old the creator wallet is — fresh wallets are a red flag.',
  },
  priceImpact: {
    label: 'Price Status',
    teaser: 'Evaluates current market cap and token value relative to age.',
  },
  updateAuthority: {
    label: 'Update Authority',
    teaser: 'Checks if the token metadata can still be modified by the creator.',
  },
  creatorRetention: {
    label: 'Creator Holdings',
    teaser: 'Checks how much supply the creator wallet still holds.',
  },
  liquidityRatio: {
    label: 'Liquidity Ratio',
    teaser: 'Compares pool liquidity to market cap — low ratio means easy manipulation.',
  },
};

const CHECK_DESCRIPTION_TRANSLATIONS: Record<string, string> = {
  'Niemand kann neue Tokens drucken.': 'No one can mint additional tokens.',
  'Neue Tokens koennen weiterhin gedruckt werden.': 'New tokens can still be minted.',
  'Neue Tokens können weiterhin gedruckt werden.': 'New tokens can still be minted.',
  'Keine Wallet kann eingefroren werden.': 'No wallet can be frozen.',
  'Wallets koennen weiterhin eingefroren werden.': 'Wallets can still be frozen.',
  'Wallets können weiterhin eingefroren werden.': 'Wallets can still be frozen.',
  'Die Liquiditaet ist gelockt.': 'Liquidity appears to be locked.',
  'Die Liquidität ist gelockt.': 'Liquidity appears to be locked.',
  'Die Liquiditaet kann jederzeit abgezogen werden.': 'Liquidity can be removed at any time.',
  'Die Liquidität kann jederzeit abgezogen werden.': 'Liquidity can be removed at any time.',
  'Wenige Wallets halten einen grossen Teil des Angebots.': 'A small number of wallets hold a large share of the supply.',
  'Wenige Wallets halten einen großen Teil des Angebots.': 'A small number of wallets hold a large share of the supply.',
  'Die Verteilung auf Wallets wirkt gesund.': 'The wallet distribution looks healthy.',
  'Token ist sehr neu.': 'The token is very new.',
  'Token hat bereits etwas Historie.': 'The token already has some trading history.',
  'Aeltere Tokens sind in der Regel weniger riskant.': 'Older tokens are generally less risky.',
  'Ältere Tokens sind in der Regel weniger riskant.': 'Older tokens are generally less risky.',
  'Es gibt bislang nur wenige Holder.': 'There are still only a few holders.',
  'Es gibt bereits viele Holder.': 'There are already many holders.',
};

const CHECK_DESCRIPTION_PATTERNS: Array<{ pattern: RegExp; translate: (m: RegExpMatchArray) => string }> = [
  {
    pattern: /^Eine einzelne Wallet h[äa]lt ([\d.,]+)% des Supply\.$/,
    translate: (m) => `A single wallet holds ${m[1]}% of the supply.`,
  },
  {
    pattern: /^Der Token wird von (\d+) Wallets gehalten\.$/,
    translate: (m) => `The token is held by ${m[1]} wallets.`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 29) return 'danger';
  if (score <= 54) return 'high';
  if (score <= 74) return 'caution';
  if (score <= 89) return 'moderate';
  return 'low';
}

function normalizeCheckLabel(checkKey: string, fallbackLabel?: string): string {
  return CHECK_METADATA[checkKey]?.label ?? fallbackLabel ?? checkKey;
}

function normalizeCheckDescription(description: string | undefined, checkKey: string): string {
  if (!description) {
    return CHECK_METADATA[checkKey]?.teaser ?? '';
  }

  if (CHECK_DESCRIPTION_TRANSLATIONS[description]) {
    return CHECK_DESCRIPTION_TRANSLATIONS[description];
  }

  for (const { pattern, translate } of CHECK_DESCRIPTION_PATTERNS) {
    const match = description.match(pattern);
    if (match) {
      return translate(match);
    }
  }

  return description;
}

function normalizeCheckText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function inferAuthorityStatus(
  check: CheckResult,
  safePatterns: string[],
  dangerPatterns: string[],
): CheckResult['status'] {
  if (typeof check.value === 'boolean') {
    return check.value ? 'danger' : 'success';
  }

  const text = `${normalizeCheckText(check.label)} ${normalizeCheckText(check.description)}`;

  for (const pattern of safePatterns) {
    if (text.includes(pattern)) return 'success';
  }

  for (const pattern of dangerPatterns) {
    if (text.includes(pattern)) return 'danger';
  }

  return check.status;
}

function inferLiquidityStatus(check: CheckResult): CheckResult['status'] {
  if (typeof check.value === 'boolean') {
    return check.value ? 'success' : 'danger';
  }

  const text = `${normalizeCheckText(check.label)} ${normalizeCheckText(check.description)}`;
  const dangerPatterns = ['nicht gelockt', 'not locked', 'can be removed', 'removed at any time', 'abgezogen'];
  const safePatterns = ['geburnt', 'burned', 'burnt', 'gelockt', 'locked', '>30 tage', '>30 days'];

  for (const pattern of dangerPatterns) {
    if (text.includes(pattern)) return 'danger';
  }

  for (const pattern of safePatterns) {
    if (text.includes(pattern)) return 'success';
  }

  return check.status;
}

function getDisplayCheckStatus(checkKey: string, check: CheckResult): CheckResult['status'] {
  switch (checkKey) {
    case 'mintAuthority':
      return inferAuthorityStatus(
        check,
        ['deaktiv', 'disabled', 'no one can mint', 'cannot mint', "can't mint"],
        [' aktiv', ' active', 'can still be minted', 'creator can mint', 'can mint new tokens'],
      );
    case 'freezeAuthority':
      return inferAuthorityStatus(
        check,
        ['deaktiv', 'disabled', 'no wallet can be frozen', 'cannot be frozen', "can't be frozen"],
        [' aktiv', ' active', 'can still be frozen', 'creator can freeze', 'wallets can still be frozen'],
      );
    case 'liquidityLocked':
      return inferLiquidityStatus(check);
    default:
      return check.status;
  }
}

export function getExplorerUrl(chain: string, address: string): string {
  const base: Record<string, string> = {
    solana: 'https://solscan.io/token',
    ethereum: 'https://etherscan.io/token',
    bsc: 'https://bscscan.com/token',
    base: 'https://basescan.org/token',
  };
  return `${base[chain] ?? base.solana}/${address}`;
}

// ─── Exported rendering functions ─────────────────────────────────────────────

/**
 * Maps a confidence level to display text and CSS class name.
 * Per spec: high="Data: Complete" (green), medium="Data: Partial" (orange), low="Data: Limited" (red)
 */
export function getConfidenceDisplay(confidence: ConfidenceLevel): { text: string; className: string } {
  switch (confidence) {
    case 'high':
      return { text: 'All checks available', className: '' };
    case 'medium':
      return { text: 'Some checks pending', className: 'medium' };
    case 'low':
      return { text: 'Limited blockchain data', className: 'low' };
    default:
      return { text: 'Some checks pending', className: 'medium' };
  }
}

/**
 * Renders all checks from score.checks into listEl.
 * Icons: ✅ safe, ⚠️ warning, ❌ danger (per spec).
 */
const CHECK_ORDER_SET = new Set<string>(CHECK_ORDER);

export function renderChecks(
  score: TokenScore,
  listEl: HTMLElement,
  _tier: string = 'pro',
  activeCategory: CheckCategory | null = null,
): void {
  listEl.innerHTML = '';
  const isPaid = _tier !== 'free';

  const extraCheckKeys = Object.keys(score.checks).filter((k) => !CHECK_ORDER_SET.has(k));
  const allCheckKeys: string[] = [...CHECK_ORDER, ...extraCheckKeys];

  // Plan platform-overhaul 2026-05-06, Step 11: count visible checks per
  // category and update the tab badges; filter the rendered list to the
  // active category. activeCategory=null preserves backward-compatible
  // behaviour (render every check) for tests and legacy callers.
  const counts: Record<CheckCategory, number> = { contract: 0, marketStructure: 0, behavior: 0 };
  for (const key of allCheckKeys) {
    const c = score.checks[key] as CheckResult | undefined;
    if (!c && !CHECK_ORDER_SET.has(key)) continue;
    counts[getCheckCategory(key)] += 1;
  }
  for (const category of CATEGORY_ORDER) {
    const badge = document.getElementById(`tab-${category}-count`);
    if (badge) badge.textContent = String(counts[category]);
  }

  for (const checkKey of allCheckKeys) {
    const check = score.checks[checkKey] as CheckResult | undefined;
    if (!check && !CHECK_ORDER_SET.has(checkKey)) continue; // skip missing optional checks
    if (activeCategory && getCheckCategory(checkKey) !== activeCategory) continue;

    // Gating is handled server-side via API response (locked flag)
    const isLockedCheck = check?.locked === true;

    const label = normalizeCheckLabel(checkKey, check?.label);
    const description = normalizeCheckDescription(check?.description, checkKey);

    const item = document.createElement('div');
    item.className = 'check-item';

    if (!check) {
      const icon = document.createElement('div');
      icon.className = 'check-icon warning';
      icon.textContent = '⚠️';

      const labelEl = document.createElement('div');
      labelEl.className = 'check-label';
      labelEl.textContent = label;

      const descEl = document.createElement('div');
      descEl.className = 'check-description';
      descEl.textContent = score.cached === false
        ? 'Still analyzing. This factor will update automatically.'
        : 'This factor has not been returned yet.';

      const content = document.createElement('div');
      content.className = 'check-content';
      content.append(labelEl, descEl);
      item.append(icon, content);
    } else {
      const displayStatus = getDisplayCheckStatus(checkKey, check);
      const statusClass = displayStatus === 'success' ? 'success' : displayStatus === 'warning' ? 'warning' : 'danger';
      // Icons per spec: ✅ safe, ⚠️ warning, ❌ danger
      const statusIcon = displayStatus === 'success' ? '✅' : displayStatus === 'warning' ? '⚠️' : '❌';

      const icon = document.createElement('div');
      icon.className = `check-icon ${statusClass}`;
      icon.textContent = statusIcon;

      const labelEl = document.createElement('div');
      labelEl.className = 'check-label';
      labelEl.textContent = label;

      const descEl = document.createElement('div');
      descEl.className = 'check-description';
      descEl.textContent = description;

      const content = document.createElement('div');
      content.className = 'check-content';
      content.append(labelEl, descEl);
      item.append(icon, content);
    }

    // Locked checks should only render as upgrade overlays for free/anonymous viewers.
    // Paid users can briefly see stale free-tier payloads during auth/cache refreshes;
    // in that case show a neutral pending state instead of an upsell.
    if (isLockedCheck && !isPaid) {
      item.className = 'check-item check-item-locked';

      const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lockSvg.setAttribute('width', '14');
      lockSvg.setAttribute('height', '14');
      lockSvg.setAttribute('viewBox', '0 0 24 24');
      lockSvg.setAttribute('fill', 'none');
      lockSvg.setAttribute('stroke', 'currentColor');
      lockSvg.setAttribute('stroke-width', '2');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '3'); rect.setAttribute('y', '11');
      rect.setAttribute('width', '18'); rect.setAttribute('height', '11');
      rect.setAttribute('rx', '2'); rect.setAttribute('ry', '2');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
      lockSvg.append(rect, path);

      const text = document.createElement('span');
      text.textContent = 'Upgrade for full report';

      const overlayLink = document.createElement('a');
      overlayLink.href = 'https://barryguard.com/pricing';
      overlayLink.target = '_blank';
      overlayLink.rel = 'noopener noreferrer';
      overlayLink.className = 'check-upgrade-overlay';
      overlayLink.append(lockSvg, text);
      item.appendChild(overlayLink);
    } else if (isLockedCheck && isPaid) {
      const descriptionEl = item.querySelector('.check-description');
      if (descriptionEl) {
        descriptionEl.textContent = 'Refreshing full check details for your plan.';
      }
    }

    listEl.appendChild(item);
  }

  // For free/anonymous: add "View full analysis" CTA directly after the locked check
  if (!isPaid) {
    const ctaHref = buildCheckUrl(score.chain, score.address);
    if (ctaHref) {
      const ctaWrapper = document.createElement('div');
      ctaWrapper.style.cssText = 'padding: 8px 0 0;';

      const ctaLink = document.createElement('a');
      ctaLink.href = ctaHref;
      ctaLink.target = '_blank';
      ctaLink.rel = 'noopener noreferrer';
      ctaLink.className = 'view-full-analysis-btn';
      ctaLink.textContent = 'View full analysis on barryguard.com ↗';

      ctaWrapper.appendChild(ctaLink);
      listEl.appendChild(ctaWrapper);
    }
    // Wenn ctaHref === null: CTA-Wrapper gar nicht anlegen/anhaengen.
  }
}

/**
 * Renders top concerns from score.reasons (not topConcerns — that field doesn't exist).
 * Shows top 3 reasons per spec. Hides container if reasons is empty.
 */
export function renderReasons(score: TokenScore, containerEl: HTMLElement, listEl: HTMLElement): void {
  const reasons = score.reasons ?? [];

  if (reasons.length === 0) {
    containerEl.classList.add('hidden');
    return;
  }

  containerEl.classList.remove('hidden');
  listEl.innerHTML = '';

  for (const reason of reasons.slice(0, 3)) {
    const li = document.createElement('li');
    li.textContent = reason;
    listEl.appendChild(li);
  }
}

/**
 * Renders subscore bars and values for contract / marketStructure / behavior.
 * Uses DOM IDs: subscore-contract, subscore-marketStructure, subscore-behavior
 * (popup.html must use these IDs — not the old subscore-contractRisk/behaviorRisk names).
 */
export function renderSubscores(score: TokenScore): void {
  const subscores = score.subscores ?? {} as Partial<Subscores>;

  for (const category of Object.keys(subscores) as (keyof Subscores)[]) {
    const value = subscores[category];
    if (value === undefined || value === null) continue;

    const bar = document.getElementById(`subscore-${category}-bar`);
    const valueEl = document.getElementById(`subscore-${category}-value`);

    if (bar && valueEl) {
      const clamped = Math.max(0, Math.min(100, Math.round(value)));
      bar.style.width = `${clamped}%`;
      bar.classList.remove('score-danger', 'score-high', 'score-caution', 'score-moderate', 'score-low');
      bar.classList.add(`score-${getRiskLevel(clamped)}`);
      valueEl.textContent = `${clamped}/100`;
    }
  }
}

/**
 * Renders the analysis footer: relative "analyzed X ago" time and confidence badge.
 * Uses score.confidence (not score.cached) per spec.
 */
export function renderAnalysisFooter(
  score: TokenScore,
  analyzedAtEl: HTMLElement | null,
  confidenceBadgeEl: HTMLElement | null,
): void {
  // Analyzed-at relative time
  if (analyzedAtEl && score.analyzedAt) {
    const date = new Date(score.analyzedAt);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    let timeText: string;
    if (diffMins < 1) {
      timeText = 'Analyzed just now';
    } else if (diffMins < 60) {
      timeText = `Analyzed ${diffMins}m ago`;
    } else if (diffHours < 24) {
      timeText = `Analyzed ${diffHours}h ago`;
    } else {
      timeText = date.toLocaleDateString();
    }
    if (score.cached === true) {
      timeText += ' · cached snapshot';
    }
    analyzedAtEl.textContent = timeText;
  }

  // Confidence badge — uses score.confidence per spec
  if (confidenceBadgeEl) {
    const { text, className } = getConfidenceDisplay(score.confidence ?? 'medium');
    confidenceBadgeEl.textContent = text;
    confidenceBadgeEl.className = 'confidence-badge';
    if (className) {
      confidenceBadgeEl.classList.add(className);
    }
  }

  // Coverage risk / data quality — shown below confidence when high or severe
  const coverageEl = document.getElementById('coverage-risk');
  if (coverageEl) {
    const cr = score.coverageRisk;
    if (cr && (cr === 'high' || cr === 'severe')) {
      const label = cr === 'severe' ? 'Very limited' : 'Limited';
      coverageEl.textContent = `Data quality: ${label}`;
      coverageEl.className = 'rd-coverage-risk visible';
    } else if (cr === 'moderate') {
      coverageEl.textContent = 'Data quality: Partial';
      coverageEl.className = 'rd-coverage-risk moderate visible';
    } else {
      coverageEl.textContent = '';
      coverageEl.className = 'rd-coverage-risk';
    }
  }
}

// ─── Mobile-Design Mirror Renderers (Step 11) ────────────────────────────────
// Mirror src/components/token-check/rescue-dial/* from BarryGuard web app.
// Each helper is independently exported for testability and to allow
// renderRescueDial() to compose them in the popup pipeline.

const RD_RISK_ORDER: RiskLevel[] = ['danger', 'high', 'caution', 'moderate', 'low'];

function rdRiskLevelForScore(score: number): RiskLevel {
  if (score >= 90) return 'low';
  if (score >= 75) return 'moderate';
  if (score >= 55) return 'caution';
  if (score >= 30) return 'high';
  return 'danger';
}

function rdSetRiskClass(el: HTMLElement | null, risk: RiskLevel | null, prefix: string): void {
  if (!el) return;
  for (const r of RD_RISK_ORDER) el.classList.remove(`${prefix}-${r}`);
  if (risk) el.classList.add(`${prefix}-${risk}`);
}

function rdFormatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${day} ${month} · ${hh}:${mm} UTC`;
  } catch {
    return '';
  }
}

/**
 * Render the top-header timestamp (UTC, formatted "DD MMM · HH:MM UTC").
 */
export function renderTopHeaderTimestamp(analyzedAt: string | undefined): void {
  const el = document.getElementById('rd-top-timestamp');
  if (!el) return;
  el.textContent = analyzedAt ? rdFormatTimestamp(analyzedAt) : '';
}

/**
 * Render the risk pill (label + colored dot) and apply risk-class to verdict
 * band parent.
 */
export function renderRiskPill(risk: RiskLevel, riskLabel: string): void {
  const pill = document.getElementById('score-donut-risk-label');
  if (!pill) return;
  const text = pill.querySelector<HTMLElement>('.rd-risk-pill-text');
  if (text) text.textContent = (riskLabel || risk).toUpperCase();
  pill.classList.remove('rd-risk-pill');
  pill.classList.add('rd-risk-pill');
  rdSetRiskClass(pill, risk, 'risk');
}

/**
 * Render the SVG triple-concentric rings inside #rd-rings.
 * Outer ring = Contract, middle = Market, inner = Behavior.
 * Disabled (null) subscores render as gray track only.
 */
export function renderTripleRings(
  score: number,
  subscores: { contract?: number | null; market?: number | null; behavior?: number | null },
): void {
  const host = document.getElementById('rd-rings');
  if (!host) return;

  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const GAP = 0.04;
  const NS = 'http://www.w3.org/2000/svg';

  const RINGS: Array<{ r: number; w: number; key: 'contract' | 'market' | 'behavior'; label: string }> = [
    { r: 92, w: 12, key: 'contract', label: 'Contract subscore' },
    { r: 74, w: 12, key: 'market', label: 'Market subscore' },
    { r: 56, w: 12, key: 'behavior', label: 'Behavior subscore' },
  ];

  const colorVar = (risk: RiskLevel) => `var(--rd-risk-${risk})`;

  const arcPath = (r: number, frac: number): string => {
    const a0 = -Math.PI / 2 + GAP;
    const sweep = Math.PI * 2 * (1 - (GAP * 2) / Math.PI);
    const a1 = a0 + sweep * frac;
    const x0 = CX + r * Math.cos(a0);
    const y0 = CY + r * Math.sin(a0);
    const x1 = CX + r * Math.cos(a1);
    const y1 = CY + r * Math.sin(a1);
    const large = sweep * frac > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  };

  const trackPath = (r: number): string => {
    const a0 = -Math.PI / 2 + GAP;
    const a1 = a0 + Math.PI * 2 - GAP * 2;
    const x0 = CX + r * Math.cos(a0);
    const y0 = CY + r * Math.sin(a0);
    const x1 = CX + r * Math.cos(a1);
    const y1 = CY + r * Math.sin(a1);
    return `M${x0},${y0} A${r},${r} 0 1 1 ${x1},${y1}`;
  };

  // Build SVG from scratch each render to avoid stale arcs.
  host.innerHTML = '';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(SIZE));
  svg.setAttribute('height', String(SIZE));
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Risk score ${score} out of 100`);

  for (const ring of RINGS) {
    const raw = subscores[ring.key];
    const hasValue = raw != null && Number.isFinite(raw);
    const v = hasValue ? Math.max(0, Math.min(100, raw as number)) : 0;
    const frac = hasValue ? v / 100 : 0;
    const trackEl = document.createElementNS(NS, 'path');
    trackEl.setAttribute('d', trackPath(ring.r));
    trackEl.setAttribute('stroke', 'var(--rd-line-strong)');
    trackEl.setAttribute('stroke-width', String(ring.w));
    trackEl.setAttribute('fill', 'none');
    trackEl.setAttribute('stroke-linecap', 'round');
    svg.appendChild(trackEl);

    if (hasValue && frac > 0) {
      const arc = document.createElementNS(NS, 'path');
      arc.setAttribute('d', arcPath(ring.r, frac));
      arc.setAttribute('stroke', colorVar(rdRiskLevelForScore(v)));
      arc.setAttribute('stroke-width', String(ring.w));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke-linecap', 'round');
      svg.appendChild(arc);
    }
  }

  // Center score number
  const txt = document.createElementNS(NS, 'text');
  txt.setAttribute('x', String(CX));
  txt.setAttribute('y', String(CY - 4));
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', 'var(--rd-ink)');
  txt.setAttribute('font-size', '40');
  txt.setAttribute('font-weight', '700');
  txt.setAttribute('letter-spacing', '-1.5');
  txt.textContent = String(Number.isFinite(score) ? Math.round(score) : 0);
  svg.appendChild(txt);

  const sub = document.createElementNS(NS, 'text');
  sub.setAttribute('x', String(CX));
  sub.setAttribute('y', String(CY + 14));
  sub.setAttribute('text-anchor', 'middle');
  sub.setAttribute('fill', 'var(--rd-ink-mute)');
  sub.setAttribute('font-size', '9.5');
  sub.setAttribute('font-weight', '600');
  sub.setAttribute('letter-spacing', '2');
  sub.textContent = 'SCORE / 100';
  svg.appendChild(sub);

  host.appendChild(svg);
}

/**
 * Render the 3-column legend (Contract/Market/Behavior subscores).
 * Each column has a top rule colored by its risk level + value/100.
 */
export function renderLegendValues(
  subscores: { contract?: number | null; market?: number | null; behavior?: number | null },
): void {
  const set = (key: 'contract' | 'market' | 'behavior') => {
    const raw = subscores[key];
    const hasValue = raw != null && Number.isFinite(raw);
    const v = hasValue ? Math.round(Math.max(0, Math.min(100, raw as number))) : null;
    const valueEl = document.getElementById(`rd-legend-${key}-value`);
    const col = document.querySelector<HTMLElement>(`.rd-legend-col[data-key="${key}"]`);
    if (valueEl) valueEl.textContent = v == null ? 'n/a' : String(v);
    if (col) {
      col.classList.toggle('is-disabled', !hasValue);
      rdSetRiskClass(col, hasValue ? rdRiskLevelForScore(v as number) : null, 'risk');
    }
  };
  set('contract');
  set('market');
  set('behavior');
}

/**
 * Render the verdict band (risk-headline + reasons list).
 * Apply risk-class to band parent for left-border + dot/headline color.
 */
export function renderVerdictBand(
  risk: RiskLevel,
  riskLabel: string,
  reasons: string[] | undefined | null,
  resolvedTier: string | undefined,
): void {
  const band = document.getElementById('rd-verdict-band');
  const head = document.getElementById('rd-verdict-headline');
  const list = document.getElementById('rd-verdict-reasons');
  if (band) rdSetRiskClass(band, risk, 'risk');
  if (head) head.textContent = (riskLabel || risk).toUpperCase();
  if (!list) return;
  list.innerHTML = '';
  const all = Array.isArray(reasons) ? reasons : [];
  const visibleLimit = resolvedTier === 'pro' || resolvedTier === 'rescue_pass' ? 8 : 5;
  for (const reason of all.slice(0, visibleLimit)) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = reason;
    li.appendChild(span);
    list.appendChild(li);
  }
}

function rdCompactNumber(n: number | null | undefined, opts?: { currency?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const prefix = opts?.currency ? '$' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${prefix}${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${Math.round(n)}`;
}

function rdFormatAge(check: CheckResult | undefined): string {
  if (!check) return '—';
  const desc = String(check.description ?? '').trim();
  const m = desc.match(/(\d+(?:\.\d+)?)\s*(second|sec|min|minute|hour|day|week|month|year)s?/i);
  if (m) {
    const num = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const map: Record<string, string> = {
      second: 's', sec: 's', min: 'm', minute: 'm',
      hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y',
    };
    return `${Math.round(num)}${map[unit] ?? ''}`;
  }
  if (typeof check.value === 'number' && Number.isFinite(check.value)) {
    const s = check.value;
    if (s >= 86400) return `${Math.floor(s / 86400)}d`;
    if (s >= 3600) return `${Math.floor(s / 3600)}h`;
    if (s >= 60) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s)}s`;
  }
  return desc || '—';
}

/**
 * Render the bottom data strip (HLD / LIQ / MCAP / AGE).
 * Pulls values from score.checks where available — falls back to '—'.
 */
export function renderDataStrip(score: TokenScore): void {
  const checks = score.checks ?? {};

  const holderCheck = checks.holderCount;
  let holders: number | null = null;
  if (holderCheck) {
    if (typeof holderCheck.value === 'number') holders = holderCheck.value;
    else {
      const m = String(holderCheck.description ?? '').match(/(\d[\d,]*)\s*(?:Wallets|holders|wallets)/i);
      if (m) holders = parseInt(m[1].replace(/,/g, ''), 10);
    }
  }

  const liqCheck = checks.liquidityDepth;
  let liquidity: number | null = null;
  if (liqCheck) {
    if (typeof liqCheck.value === 'number') liquidity = liqCheck.value;
    else {
      const m = String(liqCheck.description ?? '').match(/\$?([\d.,]+)\s*([KMB])?/i);
      if (m) {
        let v = parseFloat(m[1].replace(/,/g, ''));
        const mult = m[2]?.toUpperCase();
        if (mult === 'K') v *= 1_000;
        else if (mult === 'M') v *= 1_000_000;
        else if (mult === 'B') v *= 1_000_000_000;
        liquidity = Number.isFinite(v) ? v : null;
      }
    }
  }

  const mcapCheck = checks.priceImpact;
  let marketCap: number | null = null;
  if (mcapCheck) {
    const m = String(mcapCheck.description ?? '').match(/\$?([\d.,]+)\s*([KMB])?\s*(?:market cap|mcap|MC)/i);
    if (m) {
      let v = parseFloat(m[1].replace(/,/g, ''));
      const mult = m[2]?.toUpperCase();
      if (mult === 'K') v *= 1_000;
      else if (mult === 'M') v *= 1_000_000;
      else if (mult === 'B') v *= 1_000_000_000;
      marketCap = Number.isFinite(v) ? v : null;
    }
  }

  const setText = (id: string, value: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('rd-data-holders', rdCompactNumber(holders));
  setText('rd-data-liquidity', rdCompactNumber(liquidity, { currency: true }));
  setText('rd-data-marketcap', rdCompactNumber(marketCap, { currency: true }));
  setText('rd-data-age', rdFormatAge(checks.tokenAge));
}

/**
 * Composite Mobile-Design renderer — orchestrates all rd-* sections.
 * Call this from the popup after a token score is loaded.
 */
export function renderRescueDial(score: TokenScore, resolvedTier?: string): void {
  const risk = score.risk ?? getRiskLevel(score.score ?? 0);
  const riskLabel = risk;
  const subscores = {
    contract: score.subscores?.contract ?? null,
    market: score.subscores?.marketStructure ?? null,
    behavior: score.subscores?.behavior ?? null,
  };

  renderTopHeaderTimestamp(score.analyzedAt);
  renderRiskPill(risk, riskLabel);
  renderTripleRings(score.score ?? 0, subscores);
  renderLegendValues(subscores);
  renderVerdictBand(risk, riskLabel, score.reasons, resolvedTier);
  renderDataStrip(score);
}
