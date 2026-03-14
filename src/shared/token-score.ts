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

function sanitizeCheckResult(value: unknown): CheckResult | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const status = record.status;
  const label = sanitizeString(record.label);
  const description = sanitizeString(record.description);
  const tier = record.tier;

  if (
    !VALID_CHECK_STATUSES.has(status as CheckResult['status'])
    || !label
    || !description
    || !VALID_TIERS.has(tier as TierLevel)
  ) {
    return null;
  }

  return {
    status: status as CheckResult['status'],
    value: record.value,
    label,
    description,
    tier: tier as TierLevel,
    ...(record.locked === true ? { locked: true } : {}),
  };
}

function sanitizeChecks(value: unknown): Record<string, CheckResult> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).flatMap(([key, candidate]) => {
      const check = sanitizeCheckResult(candidate);
      return check ? [[key, check]] : [];
    }),
  );
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
    checks: sanitizeChecks(record.checks),
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
