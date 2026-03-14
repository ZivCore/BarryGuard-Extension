// src/shared/cache.ts
import type { TokenScore, TierLevel, CacheEntry } from './types';

const CACHE_KEY = 'barryguard_cache';
const MAX_ENTRIES = 1000;

const TTL_MS: Record<TierLevel, number> = {
  free:         5 * 60 * 1000,
  rescue_pass:  2 * 60 * 1000,
  pro:          2 * 60 * 1000,
};

export class TokenCache {
  private cache = new Map<string, CacheEntry>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const stored = await chrome.storage.local.get(CACHE_KEY);
      if (stored[CACHE_KEY]) {
        this.cache = new Map(Object.entries(stored[CACHE_KEY] as Record<string, CacheEntry>));
        this.evictExpired();
      }
    } catch {
      // storage unavailable — continue with empty cache
    }
    this.initialized = true;
  }

  async get(address: string, tier: TierLevel): Promise<TokenScore | null> {
    await this.init();
    const entry = this.cache.get(address);
    if (!entry) return null;

    if (entry.tier !== tier) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > TTL_MS[tier]) {
      this.cache.delete(address);
      await this.persist();
      return null;
    }
    return entry.score;
  }

  async set(address: string, score: TokenScore, tier: TierLevel): Promise<void> {
    await this.init();
    // FIFO eviction when at capacity
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(address, { score, timestamp: Date.now(), tier });
    await this.persist();
  }

  private evictExpired(): void {
    const maxTtl = Math.max(...Object.values(TTL_MS));
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxTtl) this.cache.delete(key);
    }
  }

  private async persist(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [CACHE_KEY]: Object.fromEntries(this.cache.entries()),
      });
    } catch {
      // ignore persistence failures
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await chrome.storage.local.remove(CACHE_KEY);
  }

  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: MAX_ENTRIES };
  }
}

export const tokenCache = new TokenCache();
