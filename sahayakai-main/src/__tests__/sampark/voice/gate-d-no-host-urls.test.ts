/**
 * @jest-environment node
 *
 * CLASS GATE (d) — no voice webhook builds a URL from the request (plan §16 row 21).
 *
 * The XML we return tells Vobiz where to fetch audio and where to post the
 * parent's keypress. If any of those URLs were derived from the incoming
 * request — its Host / X-Forwarded-Host header, `req.url`, `nextUrl.origin` —
 * anyone able to reach the webhook with a forged Host could point a live call
 * at their own server and harvest the next signed token. Every URL must come
 * from SAMPARK_PUBLIC_BASE_URL (samparkPublicBaseUrl) instead.
 *
 * The class, not the instance: every file of the voice runtime is scanned for
 * every way of reading the request's origin, and the scanner is first proven
 * to catch each shape on planted code (as gate-02 does), so it cannot pass
 * vacuously. Reading QUERY PARAMETERS (`nextUrl.searchParams`) is allowed —
 * that is how the token arrives — and is checked to stay allowed.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

/** The voice runtime: the four routes, the service, and the pure voice library. */
const SCANNED_DIRS = ['src/app/api/webhooks/sampark-voice', 'src/lib/sampark/voice'];
const SCANNED_FILES = ['src/server/sampark/voice.ts'];

const RULES: readonly [string, RegExp][] = [
    ['reads the Host / forwarding headers', /\.get\s*\(\s*['"`](?:host|x-forwarded-host|x-forwarded-proto|x-forwarded-port|x-original-host|forwarded|origin|referer)['"`]\s*\)/i],
    ['indexes the Host / forwarding headers', /\[\s*['"`](?:host|x-forwarded-host|x-forwarded-proto|forwarded)['"`]\s*\]/i],
    ['imports next/headers', /['"]next\/headers['"]/],
    ['uses the request URL', /\b(?:req|request)\s*\.\s*url\b/],
    ['uses the request origin through nextUrl', /\bnextUrl\s*\.\s*(?:origin|host|hostname|href|protocol|port|clone|basePath)\b/],
    ['constructs a URL object', /\bnew\s+URL\s*\(/],
    ['hard-codes an origin', /['"`]https?:\/\//],
];

function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function violations(files: { rel: string; code: string }[]): string[] {
    const found: string[] = [];
    for (const { rel, code } of files) {
        const clean = stripComments(code);
        for (const [label, re] of RULES) if (re.test(clean)) found.push(`${rel} ${label}`);
    }
    return found;
}

function walk(dir: string, acc: string[] = []): string[] {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.tsx?$/.test(entry.name)) acc.push(full);
    }
    return acc;
}

function voiceRuntimeFiles(): { rel: string; code: string }[] {
    const full = [...SCANNED_DIRS.flatMap((d) => walk(path.join(ROOT, d))), ...SCANNED_FILES.map((f) => path.join(ROOT, f))];
    return full.map((f) => ({ rel: path.relative(ROOT, f).split(path.sep).join('/'), code: fs.readFileSync(f, 'utf8') }));
}

describe('class gate (d) — the scanner catches every shape of violation', () => {
    const planted = (code: string) => violations([{ rel: 'src/app/api/webhooks/sampark-voice/answer/route.ts', code }]);

    it.each([
        ['Host header', "const host = req.headers.get('host');"],
        ['X-Forwarded-Host header', 'const h = request.headers.get("X-Forwarded-Host");'],
        ['Forwarded header', "const f = req.headers.get('forwarded');"],
        ['Origin header', "const o = req.headers.get('origin');"],
        ['header by index', "const h = nodeReq.headers['host'];"],
        ['next/headers', "import { headers } from 'next/headers';"],
        ['req.url', 'const u = new URL(req.url);'],
        ['request.url', 'const base = request.url.split("/api")[0];'],
        ['nextUrl.origin', 'const base = req.nextUrl.origin;'],
        ['nextUrl.host', 'const base = `https://${req.nextUrl.host}`;'],
        ['nextUrl.clone()', 'const u = req.nextUrl.clone(); u.pathname = "/gather";'],
        ['new URL(path, base)', "const u = new URL('/api/webhooks/sampark-voice/gather', someBase);"],
        ['hard-coded origin', "const base = 'https://sahayakai.com';"],
    ])('flags %s', (_label, code) => {
        expect(planted(code).length).toBeGreaterThanOrEqual(1);
    });

    it('allows reading query parameters and building from samparkPublicBaseUrl()', () => {
        const ok = [
            "const token = req.nextUrl.searchParams.get('t');",
            'const base = samparkPublicBaseUrl();',
            'return `${base}${SAMPARK_VOICE_PATHS.gather}?t=${encodeURIComponent(token)}`;',
            "const ct = req.headers.get('content-type');",
        ].join('\n');
        expect(planted(ok)).toEqual([]);
    });

    it('ignores comments', () => {
        expect(planted("// never: req.headers.get('host')\n/* nor new URL(req.url) or 'https://x' */")).toEqual([]);
    });
});

describe('class gate (d) — the voice runtime source', () => {
    const files = voiceRuntimeFiles();

    it('scans the four routes, the service and the voice library (the gate is not vacuous)', () => {
        const rels = files.map((f) => f.rel);
        for (const expected of [
            'src/app/api/webhooks/sampark-voice/answer/route.ts',
            'src/app/api/webhooks/sampark-voice/gather/route.ts',
            'src/app/api/webhooks/sampark-voice/status/route.ts',
            'src/app/api/webhooks/sampark-voice/clip/[file]/route.ts',
            'src/server/sampark/voice.ts',
            'src/lib/sampark/voice/xml.ts',
        ]) {
            expect(rels).toContain(expected);
        }
    });

    it('no file reads the request origin or builds a URL from it', () => {
        expect(violations(files)).toEqual([]);
    });

    it('the service builds its URLs from samparkPublicBaseUrl()', () => {
        const service = stripComments(files.find((f) => f.rel === 'src/server/sampark/voice.ts')?.code ?? '');
        expect(service).toMatch(/import\s*\{[^}]*\bsamparkPublicBaseUrl\b[^}]*\}\s*from\s*'@\/server\/sampark\/carrier'/);
        expect(service).toMatch(/samparkPublicBaseUrl\(\)/);
    });
});
