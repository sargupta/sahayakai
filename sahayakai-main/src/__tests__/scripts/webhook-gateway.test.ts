/** @jest-environment node */
/**
 * The real-call tunnels reach ONLY the provider webhooks and the bridge stream — never the dev
 * server's pages, APIs or development login (anyone with a tunnel URL could otherwise start calls).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'scripts/sampark/webhook-gateway.mjs'), 'utf8');
// The rule regexes, evaluated as the gateway does (module is ESM with a top-level server start).
const rules = (name: string): RegExp[] => {
    const m = SRC.match(new RegExp(`export const ${name} = \\[(.+?)\\];`));
    // eslint-disable-next-line no-new-func
    return new Function(`return [${m![1]}]`)() as RegExp[];
};
const ok = (rs: RegExp[], u: string) => rs.some((r) => r.test(u));

describe('webhook gateway allow-list', () => {
    const app = rules('APP_ALLOWED');
    const bridge = rules('BRIDGE_ALLOWED');
    it.each([
        '/api/webhooks/vobiz-riya/answer?t=x',
        '/api/webhooks/vobiz-riya/status?kind=hangup',
        '/api/webhooks/plivo-riya/answer?t=x',
        '/api/webhooks/plivo-riya/status?kind=ring&t=x',
        '/api/webhooks/exotel-riya/status?t=x',
        '/api/webhooks/sampark-voice/answer',
        '/api/webhooks/elevenlabs-riya',
    ])('app forwards %s', (u) => expect(ok(app, u)).toBe(true));
    it.each([
        '/', '/sampark/sargvision-local/riya', '/api/sampark/sargvision-local/riya',
        '/api/sampark/sargvision-local/batch-calls', '/api/webhooks/razorpay', '/api/webhooks/vobiz-riyaX',
        '/api/webhooks/plivo-riyaX', '/api/webhooks/exotel', '/api/sampark/provider',
        '/api/auth/session', '/_next/static/x.js',
    ])('app refuses %s', (u) => expect(ok(app, u)).toBe(false));
    it('bridge forwards only the carrier media streams', () => {
        for (const c of ['vobiz', 'plivo', 'exotel']) expect(ok(bridge, `/telephony/${c}/stream?t=abc`)).toBe(true);
        // Exotel drops the query string and opens the bare path (it authenticates from its first frames).
        expect(ok(bridge, '/telephony/exotel/stream')).toBe(true);
        for (const u of ['/healthz', '/v1/vidya-voice/stream', '/docs', '/telephony/vobiz/streamX', '/telephony/twilio/stream',
            '/telephony/exotel/stream/x', '/telephony/exotel/streamX']) expect(ok(bridge, u)).toBe(false);
    });
    it('strips cookies on both gates', () => {
        expect(SRC.match(/stripCookies: true/g)?.length).toBe(2);
    });
});
