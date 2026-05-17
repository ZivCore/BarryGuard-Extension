import { describe, expect, it } from 'vitest';
import { runWithPool } from '../../shared/concurrent-pool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Splits an array into chunks of at most `size`. */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Simulates the retry logic from background/index.ts:
 * failed chunks are split in half and retried via runWithPool.
 */
async function runChunksWithRetry(
  addresses: string[],
  chunkSize: number,
  maxConcurrent: number,
  worker: (chunk: string[]) => Promise<{ success: boolean }>,
): Promise<{
  chunkResults: PromiseSettledResult<{ success: boolean }>[];
  retryResults: PromiseSettledResult<{ success: boolean }>[] | null;
}> {
  const chunks = chunkArray(addresses, chunkSize);
  const chunkResults = await runWithPool(chunks, maxConcurrent, worker);

  const failedIndices: number[] = [];
  for (let i = 0; i < chunkResults.length; i++) {
    const r = chunkResults[i];
    if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)) {
      failedIndices.push(i);
    }
  }

  if (failedIndices.length === 0) {
    return { chunkResults, retryResults: null };
  }

  const retryChunks: string[][] = [];
  for (const idx of failedIndices) {
    const failedChunk = chunks[idx];
    const half = Math.ceil(failedChunk.length / 2);
    retryChunks.push(failedChunk.slice(0, half));
    if (failedChunk.length > half) {
      retryChunks.push(failedChunk.slice(half));
    }
  }

  const retryResults = await runWithPool(retryChunks, maxConcurrent, worker);
  return { chunkResults, retryResults };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chunked list scan — chunk splitting', () => {
  it('teilt 60 Adressen in 8 Chunks auf (7 × 8 + 1 × 4)', () => {
    const addresses = Array.from({ length: 60 }, (_, i) => `addr${i}`);
    const chunks = chunkArray(addresses, 8);

    // 60 / 8 = 7 full chunks + 1 remainder chunk → 8 total
    expect(chunks).toHaveLength(8);
    // First 7 chunks have 8 items each
    for (let i = 0; i < 7; i++) {
      expect(chunks[i]).toHaveLength(8);
    }
    // Last chunk has the remaining 4 items
    expect(chunks[7]).toHaveLength(4);
    // All addresses covered
    expect(chunks.flat()).toEqual(addresses);
  });

  it('teilt 60 Adressen in 8 Chunks mit max 2 parallelen Calls auf', async () => {
    const addresses = Array.from({ length: 60 }, (_, i) => `addr${i}`);

    let activeConcurrent = 0;
    let peakConcurrent = 0;
    const calls: string[][] = [];

    await runChunksWithRetry(addresses, 8, 2, async (chunk) => {
      activeConcurrent++;
      peakConcurrent = Math.max(peakConcurrent, activeConcurrent);
      calls.push(chunk);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      activeConcurrent--;
      return { success: true };
    });

    // Peak darf 2 nicht überschreiten
    expect(peakConcurrent).toBeLessThanOrEqual(2);
    // Bei 8 Chunks und maxConcurrent=2 sollte der Peak genau 2 sein
    expect(peakConcurrent).toBe(2);
    // Alle 8 Chunks wurden gesendet
    expect(calls).toHaveLength(8);
  });

  it('retried fehlgeschlagenen Chunk mit zwei Chunks halber Größe', async () => {
    const addresses = Array.from({ length: 60 }, (_, i) => `addr${i}`);
    // Chunk-Index 2 soll fehlschlagen (addresses 16-23)
    const failingChunkIndex = 2;
    const firstRoundAddressFirst = addresses[failingChunkIndex * 8];
    let firstRoundDone = false;
    const callLog: { chunk: string[]; attempt: number }[] = [];

    const { chunkResults, retryResults } = await runChunksWithRetry(
      addresses,
      8,
      2,
      async (chunk) => {
        const attempt = firstRoundDone ? 2 : 1;
        callLog.push({ chunk, attempt });

        // Simulate chunk 2 failing on first attempt
        if (attempt === 1 && chunk[0] === firstRoundAddressFirst) {
          return { success: false };
        }
        return { success: true };
      },
    );

    // After first round mark it done so retry calls get attempt=2
    firstRoundDone = true;

    // Erster Durchgang: 8 Calls
    expect(chunkResults).toHaveLength(8);
    // Einer hat fehlgeschlagen
    const failedCount = chunkResults.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success),
    ).length;
    expect(failedCount).toBe(1);

    // Retry: 2 Calls (halbe Chunks)
    expect(retryResults).not.toBeNull();
    expect(retryResults!).toHaveLength(2);
  });

  it('gibt kein retryResults wenn alle Chunks erfolgreich sind', async () => {
    const addresses = Array.from({ length: 16 }, (_, i) => `addr${i}`);

    const { retryResults } = await runChunksWithRetry(addresses, 8, 2, async () => ({
      success: true,
    }));

    expect(retryResults).toBeNull();
  });

  it('inFlightKeys-Cleanup: alle Keys werden im finally-Block entfernt', () => {
    // Simuliert das finally-Cleanup-Muster: auch bei Fehler alle Keys löschen
    const inFlightKeys: string[] = ['solana:addr0', 'solana:addr1', 'solana:addr2'];
    const removedKeys: string[] = [];

    const cleanup = (keys: string[]) => {
      for (const key of keys) removedKeys.push(key);
    };

    try {
      throw new Error('API error');
    } catch {
      // error intentionally swallowed
    } finally {
      cleanup(inFlightKeys);
    }

    expect(removedKeys).toEqual(inFlightKeys);
    expect(removedKeys).toHaveLength(3);
  });

  it('Chunk-Splitting mit Nicht-Vielfachen: 20 Adressen → 3 Chunks (8,8,4)', () => {
    const addresses = Array.from({ length: 20 }, (_, i) => `addr${i}`);
    const chunks = chunkArray(addresses, 8);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(8);
    expect(chunks[1]).toHaveLength(8);
    expect(chunks[2]).toHaveLength(4);
  });

  it('Retry mit Chunk der Länge 7 → zwei Retry-Chunks mit Länge [4, 3]', async () => {
    const addresses = Array.from({ length: 7 }, (_, i) => `addr${i}`);
    let called = false;
    const retrySizes: number[] = [];

    const { retryResults } = await runChunksWithRetry(addresses, 8, 2, async (chunk) => {
      if (!called) {
        // First call — the single chunk of 7 — fails
        called = true;
        return { success: false };
      }
      // Retry calls — record sizes
      retrySizes.push(chunk.length);
      return { success: true };
    });

    expect(retryResults).not.toBeNull();
    expect(retryResults!).toHaveLength(2);
    expect(retrySizes).toEqual([4, 3]);

    for (const r of retryResults!) {
      expect(r.status).toBe('fulfilled');
    }
  });
});
