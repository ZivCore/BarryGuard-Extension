// src/shared/ndjson-stream.ts
//
// NDJSON-Stream-Reader für die Extension. Liest eine Fetch-Response zeilenweise
// und ruft `onFrame` für jeden geparsten JSON-Frame auf.
//
// Fallback: Enthält der Content-Type-Header nicht "application/x-ndjson",
// wird die gesamte Body als Single-JSON geparsed und als ein Frame vom Typ
// `__single_json__` zurückgegeben.

export interface SingleJsonFrame<P = unknown> {
  type: '__single_json__';
  payload: P;
}

/**
 * Liest eine Response als NDJSON-Stream und ruft `onFrame` pro geparster Zeile auf.
 *
 * Bei Fallback (kein NDJSON-Content-Type) wird ein einzelner `__single_json__`-Frame
 * erzeugt, damit der Aufrufer beide Pfade einheitlich behandeln kann.
 *
 * Abort-Sauberkeit: Wenn die Verbindung bricht, propagiert der Reader den Fehler.
 */
export async function readNdjsonStream<T>(
  response: Response,
  onFrame: (frame: T | SingleJsonFrame) => void,
): Promise<void> {
  const contentType = response.headers.get('content-type') ?? '';
  const isNdjson = contentType.includes('application/x-ndjson');

  if (!isNdjson) {
    // Fallback: Single-JSON
    const body = await response.json() as unknown;
    onFrame({ type: '__single_json__', payload: body } as SingleJsonFrame);
    return;
  }

  if (!response.body) {
    throw new Error('Response body is null — cannot read NDJSON stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
      }
      // Zeilen splitten und alle vollständigen Zeilen verarbeiten
      const lines = buffer.split('\n');
      // Letzte Zeile ist möglicherweise unvollständig — im Buffer behalten
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const frame = JSON.parse(trimmed) as T;
          onFrame(frame);
        } catch {
          console.warn('[barry:ndjson] Bad frame skipped:', trimmed.slice(0, 120));
        }
      }
      if (done) break;
    }
    // Verbleibenden Buffer verarbeiten (Stream ohne abschließendes \n)
    if (buffer.trim()) {
      try {
        const frame = JSON.parse(buffer.trim()) as T;
        onFrame(frame);
      } catch {
        console.warn('[barry:ndjson] Bad frame in buffer remainder skipped:', buffer.trim().slice(0, 120));
      }
    }
  } finally {
    // Reader freigeben (no-op wenn bereits geclosed, aber sicher)
    reader.releaseLock();
  }
}
