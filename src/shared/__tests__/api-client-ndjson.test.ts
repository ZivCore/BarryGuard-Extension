import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BarryGuardApiClient } from '../api-client';
import type { AnalyzeListStreamFrame } from '../types';

// ---------------------------------------------------------------------------
// Fetch-Mock Helpers
// ---------------------------------------------------------------------------

function makeNdjsonResponse(lines: object[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

function makeSingleJsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BarryGuardApiClient.analyzeTokenList', () => {
  let client: BarryGuardApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new BarryGuardApiClient();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Streaming mode
  // -------------------------------------------------------------------------

  it('setzt Accept: application/x-ndjson Header wenn onStreamFrame gesetzt', async () => {
    fetchMock.mockResolvedValueOnce(
      makeNdjsonResponse([{ type: 'summary', count: 0, elapsedMs: 10 }]),
    );

    await client.analyzeTokenList(['addr1'], 'solana', false, undefined, () => {});

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/x-ndjson');
  });

  it('liefert NDJSON-Frames per onStreamFrame-Callback', async () => {
    const summaryFrame = { type: 'summary', count: 2, elapsedMs: 50 };
    const tokenFrame1 = { type: 'token_result', address: 'addr1', result: {} };
    const tokenFrame2 = { type: 'token_result', address: 'addr2', result: {} };

    fetchMock.mockResolvedValueOnce(
      makeNdjsonResponse([tokenFrame1, tokenFrame2, summaryFrame]),
    );

    const frames: AnalyzeListStreamFrame[] = [];
    const result = await client.analyzeTokenList(
      ['addr1', 'addr2'],
      'solana',
      false,
      undefined,
      (frame) => frames.push(frame),
    );

    expect(result.success).toBe(true);
    expect(frames).toHaveLength(3);
    expect(frames[0].type).toBe('token_result');
    expect(frames[1].type).toBe('token_result');
    expect(frames[2].type).toBe('summary');
  });

  it('gibt { success: true, data: undefined } zurück im Streaming-Modus', async () => {
    fetchMock.mockResolvedValueOnce(
      makeNdjsonResponse([{ type: 'summary', count: 0, elapsedMs: 5 }]),
    );

    const result = await client.analyzeTokenList(
      ['addr1'],
      'solana',
      false,
      undefined,
      () => {},
    );

    expect(result.success).toBe(true);
    expect((result as { data?: unknown }).data).toBeUndefined();
  });

  it('gibt { success: false } bei HTTP-Fehler im Streaming-Modus zurück', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const frames: AnalyzeListStreamFrame[] = [];
    const result = await client.analyzeTokenList(
      ['addr1'],
      'solana',
      false,
      undefined,
      (f) => frames.push(f),
    );

    expect(result.success).toBe(false);
    expect(frames).toHaveLength(0);
  });

  it('fällt auf __single_json__-Frame zurück wenn Content-Type application/json ist', async () => {
    const payload = { analyses: [{ address: 'addr1', score: 80 }] };
    fetchMock.mockResolvedValueOnce(makeSingleJsonResponse(payload));

    const frames: AnalyzeListStreamFrame[] = [];
    await client.analyzeTokenList(
      ['addr1'],
      'solana',
      false,
      undefined,
      (f) => frames.push(f),
    );

    expect(frames).toHaveLength(1);
    expect(frames[0].type).toBe('__single_json__');
    expect((frames[0] as { type: string; payload: unknown }).payload).toEqual(payload);
  });

  // -------------------------------------------------------------------------
  // Single-JSON mode (ohne onStreamFrame)
  // -------------------------------------------------------------------------

  it('sendet kein Accept: application/x-ndjson ohne onStreamFrame', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSingleJsonResponse({ analyses: [] }),
    );

    await client.analyzeTokenList(['addr1'], 'solana', false, undefined, undefined);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBeUndefined();
  });

  it('verwendet bisheriges Verhalten (Single-JSON) ohne onStreamFrame', async () => {
    const payload = { analyses: [{ address: 'addr1', score: 70 }] };
    fetchMock.mockResolvedValueOnce(makeSingleJsonResponse(payload));

    const result = await client.analyzeTokenList(['addr1'], 'solana', false, undefined, undefined);

    expect(result.success).toBe(true);
    expect((result as { data?: unknown }).data).toEqual(payload);
  });
});
