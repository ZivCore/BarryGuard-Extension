// src/shared/types.ts

export type RiskLevel = 'high' | 'medium' | 'low';
export type TierLevel = 'free' | 'rescue_pass' | 'pro';

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
  stripeCustomerId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CacheEntry {
  score: TokenScore;
  timestamp: number;
  tier: TierLevel;
}
