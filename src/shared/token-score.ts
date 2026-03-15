import type {
  CheckResult,
  RiskLevel,
  TierLevel,
  TokenMetadata,
  TokenScore,
} from './types';

type JsonRecord = Record<string, unknown>;
type TokenScoreSanitizationOptions = {
  expectedAddress?: string;
};
type TokenScoreExtractionOptions = {
  allowedAddresses?: Iterable<string>;
};

const VALID_RISKS = new Set<RiskLevel>(['high', 'medium', 'low']);
const VALID_CHECK_STATUSES = new Set<CheckResult['status']>(['success', 'warning', 'danger']);
const VALID_TIERS = new Set<TierLevel>(['free', 'rescue_pass', 'pro']);
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CHECK_FALLBACK_TIERS: Record<string, TierLevel> = {
  mintAuthority: 'free',
  freezeAuthority: 'free',
  liquidityLocked: 'free',
  topHolderConcentration: 'rescue_pass',
  tokenAge: 'rescue_pass',
  holderCount: 'rescue_pass',
};
const CHECK_ORDER = [
  'mintAuthority',
  'freezeAuthority',
  'liquidityLocked',
  'topHolderConcentration',
  'tokenAge',
  'holderCount',
] as const;
const FREE_VISIBLE_CHECKS = CHECK_ORDER.slice(0, 3);
const CHECK_KEY_ALIASES: Record<string, string> = {
  mintauthority: 'mintAuthority',
  mint_authority: 'mintAuthority',
  'mint-authority': 'mintAuthority',
  freezeauthority: 'freezeAuthority',
  freeze_authority: 'freezeAuthority',
  'freeze-authority': 'freezeAuthority',
  liquiditylocked: 'liquidityLocked',
  liquidity_locked: 'liquidityLocked',
  'liquidity-locked': 'liquidityLocked',
  liquiditylock: 'liquidityLocked',
  liquidity_lock: 'liquidityLocked',
  'liquidity-lock': 'liquidityLocked',
  topholderconcentration: 'topHolderConcentration',
  top_holder_concentration: 'topHolderConcentration',
  'top-holder-concentration': 'topHolderConcentration',
  tokenage: 'tokenAge',
  token_age: 'tokenAge',
  'token-age': 'tokenAge',
  holdercount: 'holderCount',
  holder_count: 'holderCount',
  'holder-count': 'holderCount',
};

function canonicalizeCheckKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\s+/g, '').toLowerCase();
  return CHECK_KEY_ALIASES[trimmed] ?? CHECK_KEY_ALIASES[normalized] ?? trimmed;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeTokenMetadata(value: unknown): TokenMetadata | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const name = sanitizeString(record.name);
  const symbol = sanitizeString(record.symbol);
  const imageUrl = sanitizeString(record.imageUrl);

  if (!name && !symbol && !imageUrl) {
    return undefined;
  }

  return {
    ...(name ? { name } : {}),
    ...(symbol ? { symbol } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function inferFallbackCheckStatus(
  key: string,
  value: unknown,
  label?: string,
  description?: string,
): CheckResult['status'] | null {
  if (typeof value === 'boolean') {
    if (key === 'mintAuthority' || key === 'freezeAuthority') {
      return value ? 'danger' : 'success';
    }

    if (key === 'liquidityLocked') {
      return value ? 'success' : 'danger';
    }
  }

  const text = `${label ?? ''} ${description ?? ''}`.toLowerCase();
  if (key === 'mintAuthority' || key === 'freezeAuthority') {
    if (
      text.includes('deaktiv')
      || text.includes('disabled')
      || text.includes('no one can mint')
      || text.includes('no wallet can be frozen')
    ) {
      return 'success';
    }

    if (
      text.includes('aktiv')
      || text.includes('active')
      || text.includes('can still be minted')
      || text.includes('can still be frozen')
    ) {
      return 'danger';
    }
  }

  if (key === 'liquidityLocked') {
    if (
      text.includes('gelockt')
      || text.includes('locked')
      || text.includes('burned')
      || text.includes('burnt')
    ) {
      return 'success';
    }

    if (
      text.includes('nicht gelockt')
      || text.includes('not locked')
      || text.includes('can be removed')
      || text.includes('removed at any time')
    ) {
      return 'danger';
    }
  }

  return null;
}

function toCheckRecord(value: unknown): JsonRecord | null {
  const record = asRecord(value);
  if (record) {
    return record;
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return { value };
  }

  return null;
}

function sanitizeCheckResult(key: string, value: unknown): CheckResult | null {
  const record = toCheckRecord(value);
  if (!record) {
    return null;
  }

  const label = sanitizeString(record.label);
  const description = sanitizeString(record.description);
  const fallbackTier = CHECK_FALLBACK_TIERS[key];
  const status = VALID_CHECK_STATUSES.has(record.status as CheckResult['status'])
    ? record.status as CheckResult['status']
    : inferFallbackCheckStatus(key, record.value, label, description);
  const tier = VALID_TIERS.has(record.tier as TierLevel) ? record.tier as TierLevel : fallbackTier;

  if (
    !status
    || !tier
  ) {
    return null;
  }

  return {
    status,
    value: record.value,
    label: label ?? '',
    description: description ?? '',
    tier: tier as TierLevel,
    ...(record.locked === true ? { locked: true } : {}),
  };
}

function extractTopLevelCheckCandidates(record: JsonRecord): JsonRecord {
  const candidates: JsonRecord = {};

  for (const [rawKey, value] of Object.entries(record)) {
    const canonicalKey = canonicalizeCheckKey(rawKey);
    if (!CHECK_FALLBACK_TIERS[canonicalKey]) {
      continue;
    }

    candidates[canonicalKey] = value;
  }

  return candidates;
}

function extractNestedCheckCandidates(record: JsonRecord): JsonRecord {
  const candidates: JsonRecord = {};
  const containers = [
    record.riskFactors,
    record.risk_factors,
    record.factors,
  ];

  for (const container of containers) {
    const containerRecord = asRecord(container);
    if (!containerRecord) {
      continue;
    }

    for (const [rawKey, value] of Object.entries(containerRecord)) {
      const canonicalKey = canonicalizeCheckKey(rawKey);
      if (!CHECK_FALLBACK_TIERS[canonicalKey]) {
        continue;
      }

      candidates[canonicalKey] = value;
    }
  }

  return candidates;
}

function sanitizeChecks(value: unknown, sourceRecord?: JsonRecord): Record<string, CheckResult> {
  const record = asRecord(value) ?? {};
  const mergedChecks = {
    ...extractTopLevelCheckCandidates(sourceRecord ?? {}),
    ...extractNestedCheckCandidates(sourceRecord ?? {}),
    ...record,
  };
  const normalizedChecks = new Map<string, CheckResult>();

  for (const [rawKey, candidate] of Object.entries(mergedChecks)) {
    const key = canonicalizeCheckKey(rawKey);
    const check = sanitizeCheckResult(key, candidate);
    if (!check) {
      continue;
    }

    const existing = normalizedChecks.get(key);
    if (!existing || (!existing.label && check.label) || (!existing.description && check.description)) {
      normalizedChecks.set(key, check);
    }
  }

  return Object.fromEntries(normalizedChecks.entries());
}

function getExpectedVisibleChecks(tier: TierLevel): readonly string[] {
  return tier === 'free' ? FREE_VISIBLE_CHECKS : CHECK_ORDER;
}

function hasPlaceholderNumericValue(key: string, value: unknown): boolean {
  return typeof value === 'number'
    && value === 0
    && (key === 'topHolderConcentration' || key === 'holderCount');
}

export function isTokenScoreLikelyIncomplete(score: TokenScore, viewerTier: TierLevel = 'free'): boolean {
  const expectedChecks = getExpectedVisibleChecks(viewerTier);
  for (const key of expectedChecks) {
    const check = score.checks[key];
    if (!check || check.locked === true) {
      return true;
    }

    if (check.value === null || check.value === undefined || check.value === '') {
      return true;
    }

    if (hasPlaceholderNumericValue(key, check.value)) {
      return true;
    }
  }

  return false;
}

export function sanitizeTokenScore(value: unknown, options: TokenScoreSanitizationOptions = {}): TokenScore | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const address = sanitizeString(record.address);
  const chain = sanitizeString(record.chain);
  const risk = record.risk;
  const score = typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : null;
  const normalizedChain = chain?.toLowerCase();

  if (
    !address
    || !SOLANA_ADDRESS_RE.test(address)
    || normalizedChain !== 'solana'
    || score === null
    || !VALID_RISKS.has(risk as RiskLevel)
    || (options.expectedAddress && address !== options.expectedAddress)
  ) {
    return null;
  }

  const analyzedAt = sanitizeString(record.analyzedAt);
  const token = sanitizeTokenMetadata(record.token);

  return {
    address,
    chain: normalizedChain,
    score,
    risk: risk as RiskLevel,
    checks: sanitizeChecks(record.checks, record),
    cached: record.cached === true,
    ...(analyzedAt ? { analyzedAt } : {}),
    ...(token ? { token } : {}),
  };
}

export function extractTokenScores(
  payload: unknown,
  options: TokenScoreExtractionOptions = {},
): TokenScore[] {
  const allowedAddresses = options.allowedAddresses ? new Set(options.allowedAddresses) : null;
  const singleScore = sanitizeTokenScore(payload);
  if (singleScore) {
    return !allowedAddresses || allowedAddresses.has(singleScore.address) ? [singleScore] : [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((candidate) => {
      const score = sanitizeTokenScore(candidate);
      return score && (!allowedAddresses || allowedAddresses.has(score.address)) ? [score] : [];
    });
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const candidates = [record.results, record.scores, record.tokens, record.data];
  for (const candidate of candidates) {
    const scores = extractTokenScores(candidate, options);
    if (scores.length > 0) {
      return scores;
    }
  }

  return Object.values(record).flatMap((candidate) => {
    const score = sanitizeTokenScore(candidate);
    return score && (!allowedAddresses || allowedAddresses.has(score.address)) ? [score] : [];
  });
}
