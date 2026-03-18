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

const VALID_RISKS = new Set<RiskLevel>(['danger', 'high', 'caution', 'moderate', 'low']);
const RISK_ALIASES: Record<string, RiskLevel> = {
  medium: 'caution',
  critical: 'danger',
  safe: 'low',
};
const VALID_CHECK_STATUSES = new Set<CheckResult['status']>(['success', 'warning', 'danger']);
const CHECK_STATUS_ALIASES: Record<string, CheckResult['status']> = {
  safe: 'success',
  ok: 'success',
  good: 'success',
  pass: 'success',
  passed: 'success',
  risky: 'danger',
  unsafe: 'danger',
  bad: 'danger',
  fail: 'danger',
  failed: 'danger',
  caution: 'warning',
  warn: 'warning',
  concerning: 'warning',
};
const VALID_TIERS = new Set<TierLevel>(['free', 'rescue_pass', 'pro']);
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CHECK_FALLBACK_TIERS: Record<string, TierLevel> = {
  mintAuthority: 'free',
  freezeAuthority: 'free',
  liquidityLocked: 'free',
  topHolderConcentration: 'free',
  tokenAge: 'free',
  holderCount: 'free',
  developerHistory: 'free',
  clusterControl: 'free',
  liquidityDepth: 'free',
  earlyDump: 'free',
  sniperDominance: 'free',
  sellability: 'free',
};
const CHECK_ORDER = [
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
  developerhistory: 'developerHistory',
  developer_history: 'developerHistory',
  'developer-history': 'developerHistory',
  clustercontrol: 'clusterControl',
  cluster_control: 'clusterControl',
  'cluster-control': 'clusterControl',
  earlydump: 'earlyDump',
  early_dump: 'earlyDump',
  'early-dump': 'earlyDump',
  sniperdominance: 'sniperDominance',
  sniper_dominance: 'sniperDominance',
  'sniper-dominance': 'sniperDominance',
  sniperbot: 'sniperDominance',
  sniper_bot: 'sniperDominance',
  sniperBot: 'sniperDominance',
  'sniper-bot': 'sniperDominance',
  bot_dominance: 'sniperDominance',
  sell_ability: 'sellability',
  'sell-ability': 'sellability',
  sellable: 'sellability',
  honeypotsimulation: 'honeypotSimulation',
  honeypot_simulation: 'honeypotSimulation',
  'honeypot-simulation': 'honeypotSimulation',
  honeypot: 'honeypotSimulation',
  lpcreatormatch: 'lpCreatorMatch',
  lp_creator_match: 'lpCreatorMatch',
  'lp-creator-match': 'lpCreatorMatch',
  bundledetection: 'bundleDetection',
  bundle_detection: 'bundleDetection',
  'bundle-detection': 'bundleDetection',
  insidernetwork: 'insiderNetwork',
  insider_network: 'insiderNetwork',
  'insider-network': 'insiderNetwork',
  bondingcurvestatus: 'bondingCurveStatus',
  bonding_curve_status: 'bondingCurveStatus',
  'bonding-curve-status': 'bondingCurveStatus',
  liquiditydepth: 'liquidityDepth',
  liquidity_depth: 'liquidityDepth',
  'liquidity-depth': 'liquidityDepth',
  metadatalegitimacy: 'metadataLegitimacy',
  metadata_legitimacy: 'metadataLegitimacy',
  'metadata-legitimacy': 'metadataLegitimacy',
  creatorwalletage: 'creatorWalletAge',
  creator_wallet_age: 'creatorWalletAge',
  'creator-wallet-age': 'creatorWalletAge',
  priceimpact: 'priceImpact',
  price_impact: 'priceImpact',
  'price-impact': 'priceImpact',
  updateauthority: 'updateAuthority',
  update_authority: 'updateAuthority',
  'update-authority': 'updateAuthority',
  creatorretention: 'creatorRetention',
  creator_retention: 'creatorRetention',
  'creator-retention': 'creatorRetention',
  liquidityratio: 'liquidityRatio',
  liquidity_ratio: 'liquidityRatio',
  'liquidity-ratio': 'liquidityRatio',
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

function sanitizeSubscores(value: unknown): Record<string, number> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const key of ['contract', 'marketStructure', 'market_structure', 'behavior']) {
    const val = record[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      const normalizedKey = key === 'market_structure' ? 'marketStructure' : key;
      result[normalizedKey] = val;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeConfidence(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'high' || trimmed === 'medium' || trimmed === 'low') {
    return trimmed;
  }
  return undefined;
}

function sanitizeReasons(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const filtered = value.filter((v): v is string => typeof v === 'string' && v.trim()).map((v) => v.trim());
  return filtered.length > 0 ? filtered : undefined;
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

  if (key === 'holderCount') {
    if (text.includes('wenige holder') || text.includes('few holder')) {
      return 'warning';
    }

    if (text.includes('viele holder') || text.includes('many holder')) {
      return 'success';
    }

    // Numeric value fallback: few holders is risky
    if (typeof value === 'number') {
      return value < 500 ? 'warning' : 'success';
    }
  }

  if (key === 'tokenAge') {
    if (
      text.includes('sehr neu')
      || text.includes('very new')
      || text.includes('etwas historie')
      || text.includes('some trading history')
    ) {
      return 'warning';
    }

    if (
      text.includes('weniger riskant')
      || text.includes('less risky')
      || text.includes('ältere')
      || text.includes('aeltere')
      || text.includes('older token')
    ) {
      return 'success';
    }

    // Numeric value fallback: any age value present means the check was evaluated
    if (typeof value === 'number' && value >= 0) {
      return 'warning';
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
  const rawStatus = typeof record.status === 'string' ? record.status.trim().toLowerCase() : '';
  const normalizedStatus = VALID_CHECK_STATUSES.has(rawStatus as CheckResult['status'])
    ? rawStatus as CheckResult['status']
    : CHECK_STATUS_ALIASES[rawStatus] ?? null;
  const status = normalizedStatus ?? inferFallbackCheckStatus(key, record.value, label, description);
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

function hasPlaceholderNumericValue(key: string, value: unknown): boolean {
  return typeof value === 'number'
    && value === 0
    && (key === 'topHolderConcentration' || key === 'holderCount');
}

export function isTokenScoreLikelyIncomplete(score: TokenScore): boolean {
  if (score.confidence === 'high') return false;

  for (const key of CHECK_ORDER) {
    const check = score.checks[key];
    if (!check) {
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
  const rawRisk = typeof record.risk === 'string' ? record.risk.trim().toLowerCase() : '';
  const resolvedRisk: RiskLevel | null = VALID_RISKS.has(rawRisk as RiskLevel)
    ? rawRisk as RiskLevel
    : (RISK_ALIASES[rawRisk] ?? null);
  const score = typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : null;
  const normalizedChain = chain?.toLowerCase();

  if (
    !address
    || !SOLANA_ADDRESS_RE.test(address)
    || normalizedChain !== 'solana'
    || score === null
    || !resolvedRisk
    || (options.expectedAddress && address !== options.expectedAddress)
  ) {
    return null;
  }

  const analyzedAt = sanitizeString(record.analyzedAt);
  const token = sanitizeTokenMetadata(record.token);
  const subscores = sanitizeSubscores(record.subscores);
  const reasons = sanitizeReasons(record.reasons);
  const confidence = sanitizeConfidence(record.confidence);
  const tokenName = sanitizeString(record.tokenName);
  const tokenSymbol = sanitizeString(record.tokenSymbol);
  const tokenLogoUrl = sanitizeString(record.tokenLogoUrl);

  return {
    address,
    chain: normalizedChain,
    score,
    risk: resolvedRisk,
    subscores: subscores ?? { contract: 0, marketStructure: 0, behavior: 0 },
    checks: sanitizeChecks(record.checks, record),
    reasons: reasons ?? [],
    confidence: confidence ?? 'medium',
    cached: record.cached === true,
    ...(analyzedAt ? { analyzedAt } : {}),
    ...(tokenName ? { tokenName } : {}),
    ...(tokenSymbol ? { tokenSymbol } : {}),
    ...(tokenLogoUrl ? { tokenLogoUrl } : {}),
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

  const candidates = [record.results, record.scores, record.tokens, record.data, record.analyses];
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
