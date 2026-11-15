/**
 * Read a request body as UTF-8 text, refusing it once it passes `maxBytes`.
 *
 * Public webhook routes checked `content-length` and then called `req.text()`, but a
 * chunked request carries no content-length, so the whole body (hundreds of MB) was
 * buffered before any size check ran. This reads the stream and stops at the cap.
 * Returns null when the body is too large.
 */
export async function readBodyCapped(req: { headers: { get(name: string): string | null }; body?: ReadableStream<Uint8Array> | null; text(): Promise<string> }, maxBytes: number): Promise<string | null> {
    const declared = Number(req.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > maxBytes) return null;
    const stream = req.body;
    if (!stream || typeof (stream as ReadableStream<Uint8Array>).getReader !== 'function') {
        // No stream available (some test doubles): fall back, still enforcing the cap.
        const text = await req.text();
        return Buffer.byteLength(text, 'utf8') > maxBytes ? null : text;
    }
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}
