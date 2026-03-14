// src/platforms/platform.interface.ts
import type { TokenScore } from '../shared/types';

export interface IPlatform {
  readonly name: string;
  readonly hostPattern: string[];
  extractTokenAddresses(): string[];
  renderScoreBadge(address: string, score: TokenScore): void;
  observeDOMChanges(callback: () => void): void;
}
