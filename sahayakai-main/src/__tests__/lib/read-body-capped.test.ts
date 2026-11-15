/**
 * @jest-environment node
 *
 * Regression (P2, memory DoS): public webhooks buffered a chunked body of any size before
 * checking it. readBodyCapped stops reading at the cap even when no content-length is sent,
 * and the three raw-body webhooks use it.
 */
import fs from 'fs';
import path from 'path';
import { readBodyCapped } from '@/lib/http/read-body-capped';

function streamOf(chunks: number[], pulled: { n: number }) {
    let i = 0;
    return new ReadableStream<Uint8Array>({
        pull(ctrl) {
            if (i >= chunks.length) return ctrl.close();
            pulled.n++;
            ctrl.enqueue(new Uint8Array(chunks[i++]).fill(97));
        },
    }, { highWaterMark: 0 }); // pull only on read, so `pulled` counts real reads
}
const req = (body: ReadableStream<Uint8Array> | null, headers: Record<string, string> = {}, text = '') => ({
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    body,
    text: async () => text,
});

describe('readBodyCapped', () => {
    it('reads a body under the cap', async () => {
        expect(await readBodyCapped(req(streamOf([3, 2], { n: 0 })), 10)).toBe('aaaaa');
    });
    it('chunked body with no content-length: stops reading once past the cap', async () => {
        const pulled = { n: 0 };
        const out = await readBodyCapped(req(streamOf([400, 400, 400, 400, 400, 400], pulled)), 1000);
        expect(out).toBeNull();
        expect(pulled.n).toBeLessThan(6); // did not drain the whole stream
    });
    it('refuses a declared oversize body without reading it', async () => {
        const pulled = { n: 0 };
        expect(await readBodyCapped(req(streamOf([1], pulled), { 'content-length': '5000' }), 1000)).toBeNull();
        expect(pulled.n).toBe(0);
    });
    it('falls back to text() when no stream exists, still enforcing the cap', async () => {
        expect(await readBodyCapped(req(null, {}, 'ok'), 10)).toBe('ok');
        expect(await readBodyCapped(req(null, {}, 'x'.repeat(11)), 10)).toBeNull();
    });
});

it('every raw-body public webhook reads through readBodyCapped (no bare req.text())', () => {
    for (const f of [
        'src/app/api/webhooks/elevenlabs-riya/route.ts',
        'src/app/api/webhooks/vobiz-riya/event/route.ts',
        'src/app/api/webhooks/razorpay/route.ts',
    ]) {
        const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
        expect(src).toMatch(/readBodyCapped\(/);
        expect(src).not.toMatch(/await (req|request)\.text\(\)/);
    }
});
