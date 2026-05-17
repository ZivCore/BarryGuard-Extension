// src/shared/concurrent-pool.ts
//
// Einfacher Concurrency-Pool: verarbeitet Items mit maximal `maxConcurrent`
// parallelen Workern. Sobald ein Worker fertig ist (resolved oder rejected),
// startet der nächste aus der Warteschlange. Das Result-Array hat dieselbe
// Reihenfolge wie das Input-Array.

/**
 * Führt `worker` für jedes Item in `items` aus, mit maximal `maxConcurrent`
 * gleichzeitig laufenden Promises.
 *
 * @returns Promise.allSettled-kompatibles Array in Input-Reihenfolge.
 */
export async function runWithPool<T, R>(
  items: T[],
  maxConcurrent: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) {
    return [];
  }

  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const item = items[index];
      try {
        results[index] = { status: 'fulfilled', value: await worker(item) };
      } catch (err) {
        results[index] = { status: 'rejected', reason: err };
      }
    }
  }

  const workerCount = Math.min(maxConcurrent, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(runWorker());
  }
  await Promise.all(workers);

  return results;
}
