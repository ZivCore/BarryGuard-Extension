import { describe, expect, it } from 'vitest';
import { runWithPool } from '../concurrent-pool';

describe('runWithPool', () => {
  it('verarbeitet alle Items und gibt Ergebnisse in Input-Reihenfolge zurück', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithPool(items, 2, async (n) => n * 10);

    expect(results).toHaveLength(5);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 20 });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 30 });
    expect(results[3]).toEqual({ status: 'fulfilled', value: 40 });
    expect(results[4]).toEqual({ status: 'fulfilled', value: 50 });
  });

  it('lässt maximal maxConcurrent Worker gleichzeitig laufen (peak = 2)', async () => {
    let activeConcurrent = 0;
    let peakConcurrent = 0;
    const items = [1, 2, 3, 4, 5];

    await runWithPool(items, 2, async (n) => {
      activeConcurrent++;
      peakConcurrent = Math.max(peakConcurrent, activeConcurrent);
      // Kurze asynchrone Pause simuliert Arbeit
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      activeConcurrent--;
      return n;
    });

    expect(peakConcurrent).toBeLessThanOrEqual(2);
    // Bei 5 Items und maxConcurrent=2 sollte der Peak genau 2 erreichen
    expect(peakConcurrent).toBe(2);
  });

  it('gibt rejected Items als { status: rejected, reason: ... } zurück', async () => {
    const items = [1, 2, 3];
    const results = await runWithPool(items, 2, async (n) => {
      if (n === 2) throw new Error('Item 2 failed');
      return n * 10;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: 'fulfilled', value: 30 });
  });

  it('gibt leeres Array für leere Input-Liste zurück', async () => {
    const results = await runWithPool([], 3, async (n: number) => n);
    expect(results).toEqual([]);
  });

  it('funktioniert mit maxConcurrent > items.length (kein overflow)', async () => {
    const items = [1, 2];
    const results = await runWithPool(items, 10, async (n) => n + 1);
    expect(results).toEqual([
      { status: 'fulfilled', value: 2 },
      { status: 'fulfilled', value: 3 },
    ]);
  });

  it('läuft auch wenn alle Items fehlschlagen', async () => {
    const items = [1, 2, 3];
    const results = await runWithPool(items, 2, async () => {
      throw new Error('always fails');
    });

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe('rejected');
    }
  });
});
