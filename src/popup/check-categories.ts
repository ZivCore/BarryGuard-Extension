// src/popup/check-categories.ts
// Plan platform-overhaul 2026-05-06, Step 11: Tab-Reihe gespiegelt von der
// Mobile-Web-Token-Check-Variante (Contract / Market Structure / Behavior).
// This map mirrors `BarryGuard/src/lib/scoring/CheckFormatter.ts` category
// assignments so the popup tabs group checks the same way the website does.

export type CheckCategory = 'contract' | 'marketStructure' | 'behavior';

export const CHECK_CATEGORY_MAP: Record<string, CheckCategory> = {
  // Contract — token program authorities, metadata, on-chain code
  mintAuthority: 'contract',
  freezeAuthority: 'contract',
  updateAuthority: 'contract',
  metadataLegitimacy: 'contract',
  bondingCurveStatus: 'contract',

  // Market Structure — liquidity, holders, price impact
  liquidityLocked: 'marketStructure',
  lpCreatorMatch: 'marketStructure',
  topHolderConcentration: 'marketStructure',
  holderCount: 'marketStructure',
  liquidityDepth: 'marketStructure',
  liquidityRatio: 'marketStructure',
  priceImpact: 'marketStructure',

  // Behavior — actor history and runtime patterns
  tokenAge: 'behavior',
  developerHistory: 'behavior',
  honeypotSimulation: 'behavior',
  insiderNetwork: 'behavior',
  bundleDetection: 'behavior',
  earlyDump: 'behavior',
  sniperDominance: 'behavior',
  clusterControl: 'behavior',
  creatorWalletAge: 'behavior',
  creatorRetention: 'behavior',
  sellability: 'behavior',
};

export function getCheckCategory(checkKey: string): CheckCategory {
  return CHECK_CATEGORY_MAP[checkKey] ?? 'behavior';
}

export const CATEGORY_LABEL: Record<CheckCategory, string> = {
  contract: 'Contract',
  marketStructure: 'Market',
  behavior: 'Behavior',
};

export const CATEGORY_ORDER: CheckCategory[] = ['contract', 'marketStructure', 'behavior'];
