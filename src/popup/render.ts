// src/popup/render.ts
// Rendering functions extracted from popup/index.ts for testability.
// These functions have no module-level side effects and can be imported in tests.

import type { CheckResult, ConfidenceLevel, RiskLevel, Subscores, TokenScore } from '../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHECK_ORDER = [
  'mintAuthority',
  'freezeAuthority',
  'liquidityLocked',
  'topHolderConcentration',
  'tokenAge',
  'holderCount',
  'developerHistory',
  'clusterControl',
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

export function renderChecks(score: TokenScore, listEl: HTMLElement): void {
  listEl.innerHTML = '';

  const extraCheckKeys = Object.keys(score.checks).filter((k) => !CHECK_ORDER_SET.has(k));
  const allCheckKeys: string[] = [...CHECK_ORDER, ...extraCheckKeys];

  for (const checkKey of allCheckKeys) {
    const check = score.checks[checkKey] as CheckResult | undefined;
    if (!check && !CHECK_ORDER_SET.has(checkKey)) continue; // skip missing optional checks
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

    listEl.appendChild(item);
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
}
