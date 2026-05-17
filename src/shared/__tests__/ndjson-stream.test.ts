import { describe, expect, it, vi } from 'vitest';
import { readNdjsonStream } from '../ndjson-stream';
import type { SingleJsonFrame } from '../ndjson-stream';

// Hilfsfunktion: baut eine mock Response aus einem String mit gegebenem Content-Type.
function makeNdjsonResponse(body: string, contentType = 'application/x-ndjson'): Response {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(body);

  // Simuliert einen ReadableStream mit einem einzigen Chunk
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': contentType },
  });
}

// Hilfsfunktion: baut eine Response die Chunks einzeln liefert (Buffer-Test)
function makeChunkedNdjsonResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

describe('readNdjsonStream', () => {
  it('parst korrekt an \\n getrennte Frames', async () => {
    const body = [
      JSON.stringify({ type: 'token_result', address: 'abc' }),
      JSON.stringify({ type: 'summary', count: 1, elapsedMs: 100 }),
    ].join('\n') + '\n';

    const frames: unknown[] = [];
    await readNdjsonStream(makeNdjsonResponse(body), (f) => frames.push(f));

    expect(frames).toHaveLength(2);
    expect((frames[0] as { type: string }).type).toBe('token_result');
    expect((frames[1] as { type: string }).type).toBe('summary');
  });

  it('behält Buffer-Reste über Reads hinweg (unvollständige Zeilen)', async () => {
    // Erster Chunk endet mitten in einer Zeile
    const line1 = JSON.stringify({ type: 'token_result', address: 'addr1' });
    const line2 = JSON.stringify({ type: 'summary', count: 1, elapsedMs: 50 });
    const half = Math.ceil(line1.length / 2);
    const chunks = [
      line1.slice(0, half),
      line1.slice(half) + '\n' + line2 + '\n',
    ];

    const frames: unknown[] = [];
    await readNdjsonStream(makeChunkedNdjsonResponse(chunks), (f) => frames.push(f));

    expect(frames).toHaveLength(2);
    expect((frames[0] as { address: string }).address).toBe('addr1');
  });

  it('überspringt Bad Frames mit console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = 'not-json\n' + JSON.stringify({ type: 'summary', count: 0, elapsedMs: 0 }) + '\n';

    const frames: unknown[] = [];
    await readNdjsonStream(makeNdjsonResponse(body), (f) => frames.push(f));

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(frames).toHaveLength(1);
    expect((frames[0] as { type: string }).type).toBe('summary');

    warnSpy.mockRestore();
  });

  it('fällt bei application/json Content-Type auf Single-JSON-Fallback zurück', async () => {
    const payload = { analyses: [{ address: 'abc', score: 55 }] };
    const response = new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });

    const frames: unknown[] = [];
    await readNdjsonStream(response, (f) => frames.push(f));

    expect(frames).toHaveLength(1);
    const singleFrame = frames[0] as SingleJsonFrame;
    expect(singleFrame.type).toBe('__single_json__');
    expect(singleFrame.payload).toEqual(payload);
  });

  it('fällt bei fehlendem Content-Type-Header auf Single-JSON-Fallback zurück', async () => {
    const payload = { count: 0 };
    const response = new Response(JSON.stringify(payload));

    const frames: unknown[] = [];
    await readNdjsonStream(response, (f) => frames.push(f));

    expect(frames).toHaveLength(1);
    expect((frames[0] as SingleJsonFrame).type).toBe('__single_json__');
  });

  it('verarbeitet Frames ohne abschließendes \\n (Buffer-Remainder)', async () => {
    const body = JSON.stringify({ type: 'token_locked', address: 'xyz' }); // kein \n am Ende

    const frames: unknown[] = [];
    await readNdjsonStream(makeNdjsonResponse(body), (f) => frames.push(f));

    expect(frames).toHaveLength(1);
    expect((frames[0] as { type: string }).type).toBe('token_locked');
  });
});
