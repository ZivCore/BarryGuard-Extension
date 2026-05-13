/**
 * dedup-store.ts
 *
 * Persistent dedup state for the background service worker using
 * chrome.storage.session.  Unlike module-level variables, session storage
 * survives service-worker restarts within the same browser session, so the
 * in-flight and recent-post dedup layers remain active after idle wake-ups.
 *
 * Fallback: if chrome.storage.session is unavailable (browser bug / test env
 * without a full mock), in-memory Maps are used with a console.warn.
 */

const INFLIGHT_KEY = '_inflightAddresses';
const RECENT_POSTS_KEY = '_recentPostTimestamps';

// ---------------------------------------------------------------------------
// In-memory fallback (used when chrome.storage.session is unavailable)
// ---------------------------------------------------------------------------

let _fallbackInflight: Set<string> | null = null;
let _fallbackRecentPosts: Map<string, number> | null = null;

function getFallbackInflight(): Set<string> {
  if (!_fallbackInflight) {
    _fallbackInflight = new Set();
  }
  return _fallbackInflight;
}

function getFallbackRecentPosts(): Map<string, number> {
  if (!_fallbackRecentPosts) {
    _fallbackRecentPosts = new Map();
  }
  return _fallbackRecentPosts;
}

function isSessionStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage != null &&
    chrome.storage.session != null
  );
}

// ---------------------------------------------------------------------------
// Public API — inflight set
// ---------------------------------------------------------------------------

/**
 * Read the in-flight address set from session storage.
 * Returns an empty Set on any error or if storage is unavailable.
 */
export async function getInflightSet(): Promise<Set<string>> {
  if (!isSessionStorageAvailable()) {
    console.warn('[dedup-store] chrome.storage.session unavailable — using in-memory fallback');
    return new Set(getFallbackInflight());
  }
  try {
    const result = await chrome.storage.session.get(INFLIGHT_KEY);
    const raw = result[INFLIGHT_KEY];
    if (Array.isArray(raw)) {
      return new Set(raw as string[]);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/**
 * Write the in-flight address set to session storage.
 */
export async function setInflightSet(set: Set<string>): Promise<void> {
  if (!isSessionStorageAvailable()) {
    _fallbackInflight = new Set(set);
    return;
  }
  try {
    await chrome.storage.session.set({ [INFLIGHT_KEY]: [...set] });
  } catch {
    // Best-effort — ignore write failures
  }
}

/**
 * Atomic read-modify-write for the inflight set.
 * Loads the current set, applies the mutator, then writes it back.
 *
 * NOTE: chrome.storage.session has no CAS (compare-and-swap) primitive.
 * This is best-effort: it eliminates the in-process race within a single
 * call, but two concurrent withInflightSet() invocations may still race
 * because each performs read → mutate → write in separate microtask
 * batches.  The Service-Worker single-threaded event loop makes this
 * acceptable for normal scan flows; do not rely on this for hard
 * mutual-exclusion guarantees.
 */
export async function withInflightSet(mutator: (set: Set<string>) => void): Promise<void> {
  if (!isSessionStorageAvailable()) {
    const set = getFallbackInflight();
    mutator(set);
    return;
  }
  const set = await getInflightSet();
  mutator(set);
  await setInflightSet(set);
}

// ---------------------------------------------------------------------------
// Public API — recent-post timestamps
// ---------------------------------------------------------------------------

/**
 * Read the recent-post timestamp map from session storage.
 * Returns an empty Map on any error or if storage is unavailable.
 */
export async function getRecentPosts(): Promise<Map<string, number>> {
  if (!isSessionStorageAvailable()) {
    console.warn('[dedup-store] chrome.storage.session unavailable — using in-memory fallback');
    return new Map(getFallbackRecentPosts());
  }
  try {
    const result = await chrome.storage.session.get(RECENT_POSTS_KEY);
    const raw = result[RECENT_POSTS_KEY];
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
      return new Map(Object.entries(raw as Record<string, number>));
    }
    return new Map();
  } catch {
    return new Map();
  }
}

/**
 * Write the recent-post timestamp map to session storage.
 */
export async function setRecentPosts(map: Map<string, number>): Promise<void> {
  if (!isSessionStorageAvailable()) {
    _fallbackRecentPosts = new Map(map);
    return;
  }
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of map) {
      obj[k] = v;
    }
    await chrome.storage.session.set({ [RECENT_POSTS_KEY]: obj });
  } catch {
    // Best-effort — ignore write failures
  }
}

/**
 * Atomic read-modify-write for the recent-posts map.
 * Loads the current map, applies the mutator, then writes it back.
 *
 * NOTE: chrome.storage.session has no CAS (compare-and-swap) primitive.
 * This is best-effort: it eliminates the in-process race within a single
 * call, but two concurrent withRecentPosts() invocations may still race
 * because each performs read → mutate → write in separate microtask
 * batches.  The Service-Worker single-threaded event loop makes this
 * acceptable for normal scan flows; do not rely on this for hard
 * mutual-exclusion guarantees.
 */
export async function withRecentPosts(mutator: (map: Map<string, number>) => void): Promise<void> {
  if (!isSessionStorageAvailable()) {
    const map = getFallbackRecentPosts();
    mutator(map);
    return;
  }
  const map = await getRecentPosts();
  mutator(map);
  await setRecentPosts(map);
}

/**
 * Remove entries from the recent-post map that are older than ttlMs.
 * This keeps storage size bounded during long browser sessions.
 */
export async function pruneRecentPosts(now: number, ttlMs: number): Promise<void> {
  await withRecentPosts((map) => {
    for (const [key, ts] of map) {
      if (now - ts > ttlMs) {
        map.delete(key);
      }
    }
  });
}
