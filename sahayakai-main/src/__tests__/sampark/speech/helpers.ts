/** Test helpers for the Sampark speech tests: fake μ-law audio, a fake TTS response, a fake fetch. */

import { buildMulawWav } from '@/lib/sampark/speech/wav';

/** `seconds` of 8 kHz μ-law "audio" (arbitrary non-silent bytes). */
export function fakeMulawWav(seconds: number): Buffer {
    return buildMulawWav(Buffer.alloc(Math.round(seconds * 8000), 0x55));
}

export interface RecordedRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, any>;
}

/** A fetch stand-in that records requests and answers with the given JSON. */
export function fakeFetch(respond: (req: RecordedRequest) => { status?: number; json: unknown }) {
    const requests: RecordedRequest[] = [];
    const impl = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
        const req = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
        requests.push(req);
        const { status = 200, json } = respond(req);
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => json,
            text: async () => JSON.stringify(json),
        };
    }) as unknown as typeof fetch;
    return { impl, requests };
}
