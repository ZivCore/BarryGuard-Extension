// src/platforms/platform.interface.ts
import type { SelectedToken, TokenScore } from '../shared/types';

export interface IPlatform {
  readonly id: string;
  readonly name: string;
  readonly hostPattern: string[];
  matchesLocation(location: Location): boolean;
  extractTokenAddresses(): string[];
  getCurrentPageAddress(): string | null;
  buildSelectedToken(address: string, score: TokenScore): SelectedToken;
  renderScoreBadge(address: string, score: TokenScore): void;
  renderLoadingBadge(address: string): void;
  renderErrorBadge(address: string): void;
  renderLockedBadge(address: string): void;
  observeDOMChanges(callback: () => void): void;
  readonly chains?: string[];
  detectChainFromUrl?(url: string): string | null;
}
