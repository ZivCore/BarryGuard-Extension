// src/shared/types.ts

export type RiskLevel = 'high' | 'medium' | 'low';
export type TierLevel = 'free' | 'rescue_pass' | 'pro';
export type ApiErrorType = 'plan_gate' | 'rate_limit' | 'cooldown' | 'server' | 'network';

export interface TierCapabilities {
  singleTokenAnalysis: boolean;
  tokenListAnalysis: boolean;
}

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  imageUrl?: string;
}

export interface CheckResult {
  status: 'success' | 'warning' | 'danger';
  value: unknown;
  label: string;
  description: string;
  tier: TierLevel;
  locked?: boolean;
}

export interface TokenScore {
  address: string;
  chain: string;
  score: number;
  risk: RiskLevel;
  checks: Record<string, CheckResult>;
  cached: boolean;
  analyzedAt?: string;
  token?: TokenMetadata;
}

export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  tier: TierLevel;
  capabilities?: TierCapabilities;
  listRequestLimit?: number;
  singleTokenCooldownSeconds?: number;
  singleTokenHourlyLimit?: number;
  stripeCustomerId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  customerPortalUrl?: string;
}

export interface HourlyUsageState {
  bucketKey: string;
  tier: TierLevel;
  audience: 'anonymous' | 'authenticated';
  used: number;
  limit: number;
  updatedAt: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  errorType?: ApiErrorType;
  retryAfterSeconds?: number;
}

export interface CacheEntry {
  score: TokenScore;
  timestamp: number;
  tier: TierLevel;
}

export interface SelectedToken {
  address: string;
  score: TokenScore;
  metadata?: TokenMetadata;
}

export interface TokenListAnalysisData {
  scores: TokenScore[];
  cachedAddresses: string[];
}
