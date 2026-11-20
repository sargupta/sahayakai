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
        '/api/webhooks/sampark-voice/answer',
        '/api/webhooks/elevenlabs-riya',
    ])('app forwards %s', (u) => expect(ok(app, u)).toBe(true));
    it.each([
        '/', '/sampark/sargvision-local/riya', '/api/sampark/sargvision-local/riya',
        '/api/sampark/sargvision-local/batch-calls', '/api/webhooks/razorpay', '/api/webhooks/vobiz-riyaX',
        '/api/auth/session', '/_next/static/x.js',
    ])('app refuses %s', (u) => expect(ok(app, u)).toBe(false));
    it('bridge forwards only the Vobiz stream', () => {
        expect(ok(bridge, '/telephony/vobiz/stream?t=abc')).toBe(true);
        for (const u of ['/healthz', '/v1/vidya-voice/stream', '/docs', '/telephony/vobiz/streamX']) expect(ok(bridge, u)).toBe(false);
    });
    it('strips cookies on both gates', () => {
        expect(SRC.match(/stripCookies: true/g)?.length).toBe(2);
    });
});
