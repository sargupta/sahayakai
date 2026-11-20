/**
 * Class gate: every route reads the caller's address through src/lib/client-address.ts, and the
 * helper picks the entry our own infrastructure appended.
 *
 * The bugs this catches:
 *  - the public VIDYA voice route and the demo-call route took the FIRST X-Forwarded-For entry
 *    for their per-address rate limits. That entry is whatever the client sent, so anyone could
 *    pick a fresh address per request and walk around the limit.
 *  - the first fix took the LAST entry. Behind our global load balancer that is the load
 *    balancer's own address, so every visitor would share one bucket.
 *  - the first version of this gate looked only for an 'x-forwarded-for' literal, so a route could
 *    go back to keying its limit on `x-real-ip` (as the public-session limiter did before the
 *    fix), `cf-connecting-ip`, `true-client-ip` or `forwarded`. Nothing in front of Cloud Run sets
 *    those, so the client chooses them, and the gate stayed green.
 * The gate fails if any source file outside the helper reads any client address header (or
 * `request.ip`) itself, if the helper trusts a client-supplied entry on either path into Cloud
 * Run, or if a production deploy step stops telling the app which address is our load balancer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { clientAddress } from '@/lib/client-address';

const SRC = path.resolve(__dirname, '..', '..');
const HELPER = path.join(SRC, 'lib', 'client-address.ts');
/** Every header a client can send to claim an address, and NextRequest's own `ip`. */
const ADDRESS_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'true-client-ip', 'x-client-ip', 'x-cluster-client-ip', 'fastly-client-ip', 'x-appengine-user-ip'];
const READS_HEADER = new RegExp(`["'\`](?:${ADDRESS_HEADERS.join('|')})["'\`]|\\b(?:req|request)\\.ip\\b`, 'i');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p);
        return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
}

const req = (headers: Record<string, string>) => ({ headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } as unknown as Headers });

describe('gate: the caller address comes from one helper', () => {
    const LB = '34.50.150.243';
    const prod = { TRUSTED_PROXY_ADDRESSES: LB };

    it('behind the load balancer, takes the client the load balancer saw', () => {
        expect(clientAddress(req({ 'x-forwarded-for': `203.0.113.9, ${LB}` }), prod)).toBe('203.0.113.9');
        // A client cannot choose its address by sending one, even one that looks like ours.
        expect(clientAddress(req({ 'x-forwarded-for': `6.6.6.6, 203.0.113.9, ${LB}` }), prod)).toBe('203.0.113.9');
        expect(clientAddress(req({ 'x-forwarded-for': `6.6.6.6, ${LB}, 203.0.113.9, ${LB}` }), prod)).toBe('203.0.113.9');
    });

    it('straight to run.app, takes the client Google\'s front end saw', () => {
        expect(clientAddress(req({ 'x-forwarded-for': '203.0.113.9' }), prod)).toBe('203.0.113.9');
        expect(clientAddress(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), prod)).toBe('203.0.113.9');
        // Sending our load balancer's address does not make the client's own entry skippable.
        expect(clientAddress(req({ 'x-forwarded-for': `${LB}, 203.0.113.9` }), prod)).toBe('203.0.113.9');
    });

    it('two visitors behind the load balancer never share a bucket', () => {
        const a = clientAddress(req({ 'x-forwarded-for': `203.0.113.9, ${LB}` }), prod);
        const b = clientAddress(req({ 'x-forwarded-for': `198.51.100.4, ${LB}` }), prod);
        expect(a).not.toBe(b);
    });

    it('never reads x-real-ip, which nothing in front of us sets', () => {
        expect(clientAddress(req({ 'x-real-ip': '198.51.100.4' }), prod)).toBe('unknown');
        expect(clientAddress(req({}), prod)).toBe('unknown');
    });

    it('every production deploy step names our load balancer', () => {
        const cloudbuild = readFileSync(path.resolve(SRC, '..', 'cloudbuild.yaml'), 'utf8');
        const envLines = cloudbuild.split('\n').filter((l) => /--(update|set)-env-vars=/.test(l) && !l.trim().startsWith('#'));
        expect(envLines.length).toBe(2); // asia-southeast1 and asia-south1
        for (const line of envLines) {
            const value = line.match(/TRUSTED_PROXY_ADDRESSES=([^,\s]+)/)?.[1];
            expect(value).toBe(LB);
        }
    });

    it('recognises every way a route could read a client address itself', () => {
        for (const line of [
            "req.headers.get('x-forwarded-for')",
            "req.headers.get('x-real-ip') ?? clientAddress(req)",
            'headers().get("X-Real-IP")',
            'request.headers.get(`cf-connecting-ip`)',
            "h.get('true-client-ip')",
            "req.headers.get('forwarded')",
            'const ip = request.ip ?? null;',
        ]) expect({ line, caught: READS_HEADER.test(line) }).toEqual({ line, caught: true });
        expect(READS_HEADER.test("clientAddress(req) // via the helper, 'x-forwarded' prefix only")).toBe(false);
    });

    it('no source file outside the helper reads a client address header itself', () => {
        const files = sourceFiles(SRC);
        expect(files.length).toBeGreaterThan(500);
        const offenders = files.filter((f) => f !== HELPER && READS_HEADER.test(readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f));
        expect(offenders).toEqual([]);
    });
});
