/** @jest-environment node */
/**
 * STRUCTURAL GATE (Sampark + MCP integration brief, Step 2): every code path in src/
 * that can start a carrier call goes through the shared contact check.
 *
 * The class of bug: a second way to ring a parent that skips the opt-out list, the
 * 30-day cap or the 10:00–19:00 band — exactly how a parent who told Sampark to stop
 * could still be rung from the teacher path. A calling route added next year without
 * the check fails here on its first PR.
 *
 * How: every non-test source file is scanned for the signatures of starting a call on
 * each carrier we use. Each hit must be inside a function that either
 *   (a) runs the check before the hit — `checkContact(`, or `clearTeacherCall(`, which is
 *       itself required (below) to call checkContact and hand out a clearance only when
 *       allowed — or
 *   (b) takes a `ContactClearance` parameter, which only `clearanceFor(checkContact(…))`
 *       can make, so the dialling function cannot be reached without the check,
 * or the file must be on the short, reasoned allow-list below. An allow-list entry
 * whose file no longer dials fails too, so the list cannot go stale.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');

/** Calls that run the shared check. Every wrapper must itself call checkContact (asserted below). */
const CHECK_CALL = /\b(?:checkContact|clearTeacherCall)\s*\(/;

/** What starting a call looks like, per carrier. */
const DIAL_SIGNATURES: { carrier: string; re: RegExp }[] = [
    { carrier: 'Twilio (REST Create Call)', re: /\/Calls\.json/g },
    { carrier: 'Vobiz (teacher path client)', re: /\bplaceVobizCall\s*\(/g },
    { carrier: 'Vobiz (detailed client)', re: /\bplaceVobizCallDetailed\s*\(/g },
    { carrier: 'Vobiz (raw Call API)', re: /\/Account\/\$\{[^}]+\}\/Call\/`/g },
    { carrier: 'Exotel (voicebot start-call)', re: /process\.env\.VOICE_EXOTEL_CALL_URL\b/g },
    { carrier: 'Sampark carrier port', re: /\bcarrier\.place\s*\(/g },
];

/**
 * Files that contain a dial signature but are not a parent-call path. Each needs a reason.
 * Adding an entry is a decision a reviewer must see, so keep it rare.
 */
const ALLOWED: Record<string, string> = {
    'lib/vobiz/client.ts':
        'The Vobiz HTTP client itself (definitions of placeVobizCall / placeVobizCallDetailed). Its callers are checked here.',
    'app/api/demo-call/route.ts':
        'Public "Hear the Call" demo: rings the VISITOR\'S OWN number once, at their request, with their consent, behind ' +
        'DEMO_CALL_ENABLED, Turnstile and per-number cooldowns. Not a school-to-parent call. Flagged for review in the Step 2 PR.',
};

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name !== '__tests__' && e.name !== '__mocks__' && e.name !== 'node_modules') walk(full, out);
        } else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
            out.push(full);
        }
    }
    return out;
}

/** Blank out comments (keeping offsets), so a signature in a doc comment is not a dial. */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

/** Index of the bracket closing the one at `open` (same kind), or -1. */
function matching(src: string, open: number): number {
    const close = src[open] === '(' ? ')' : '}';
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === src[open]) depth++;
        else if (src[i] === close && --depth === 0) return i;
    }
    return -1;
}

/** The brace opening a body: the first "{" that ends its line after the parameters (a return type may hold braces). */
function bodyStart(src: string, from: number): number {
    const m = /\{[ \t]*\r?\n/.exec(src.slice(from));
    return m ? from + m.index : -1;
}

/** Start offset and header (name + parameters) of the innermost function or method whose body encloses `at`. */
function enclosingFunction(src: string, at: number): { start: number; header: string } | null {
    const re = /(?:async\s+)?function\s+\w+\s*(?:<[^>]*>)?\s*\(|(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\(|^[ \t]*(?:async\s+)?\w+\s*\(/gm;
    let best: { start: number; header: string } | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) && m.index < at) {
        // Parameters run to the matching ')' (a parameter type may itself hold braces); then the body.
        const paramsEnd = matching(src, m.index + m[0].length - 1);
        if (paramsEnd === -1) continue;
        const brace = bodyStart(src, paramsEnd);
        if (brace === -1 || brace > at) continue;
        if (matching(src, brace) > at) best = { start: m.index, header: src.slice(m.index, paramsEnd + 1) };
    }
    return best;
}

function judge(src: string, at: number): { ok: boolean; why: string } {
    const fn = enclosingFunction(src, at);
    if (!fn) return { ok: false, why: 'dials at module level' };
    if (/\bContactClearance\b/.test(fn.header)) return { ok: true, why: 'requires a ContactClearance' };
    return CHECK_CALL.test(src.slice(fn.start, at))
        ? { ok: true, why: 'checks before dialling' }
        : { ok: false, why: 'no check before dialling and no ContactClearance parameter' };
}

interface Hit { file: string; carrier: string; line: number; ok: boolean; why: string }

function scan(): Hit[] {
    const hits: Hit[] = [];
    for (const full of walk(SRC)) {
        const rel = path.relative(SRC, full).split(path.sep).join('/');
        const src = stripComments(fs.readFileSync(full, 'utf8'));
        for (const { carrier, re } of DIAL_SIGNATURES) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(src))) {
                const line = src.slice(0, m.index).split('\n').length;
                const verdict = ALLOWED[rel] ? { ok: true, why: 'allow-listed' } : judge(src, m.index);
                hits.push({ file: rel, carrier, line, ...verdict });
            }
        }
    }
    return hits;
}

describe('GATE: every carrier call in src/ goes through the shared contact check', () => {
    const hits = scan();

    it('finds the known dial points (the scan itself works)', () => {
        const files = new Set(hits.map((h) => h.file));
        for (const f of ['app/api/attendance/call/route.ts', 'lib/sampark/dispatch/dispatcher.ts', 'lib/vobiz/client.ts']) expect(files).toContain(f);
        const teacher = hits.filter((h) => h.file === 'app/api/attendance/call/route.ts').map((h) => h.carrier);
        expect(teacher).toEqual(expect.arrayContaining(['Twilio (REST Create Call)', 'Vobiz (teacher path client)', 'Exotel (voicebot start-call)']));
    });

    it('no dial point skips the check', () => {
        expect(hits.filter((h) => !h.ok).map((h) => `${h.file}:${h.line} [${h.carrier}] ${h.why}`)).toEqual([]);
    });

    it('clearTeacherCall is a real wrapper: it runs checkContact and hands out a clearance only via clearanceFor', () => {
        const src = stripComments(fs.readFileSync(path.join(SRC, 'lib', 'contact-policy', 'teacher.ts'), 'utf8'));
        const at = src.indexOf('export async function clearTeacherCall');
        expect(at).toBeGreaterThan(-1);
        const paramsEnd = matching(src, src.indexOf('(', at));
        const open = bodyStart(src, paramsEnd);
        const body = src.slice(open, matching(src, open));
        expect(body).toMatch(/\bcheckContact\s*\(/);
        expect(body).toMatch(/\bclearanceFor\s*\(/);
    });

    it('every allow-list entry still dials and has a reason (the list cannot go stale)', () => {
        for (const [file, reason] of Object.entries(ALLOWED)) {
            expect(hits.some((h) => h.file === file)).toBe(true);
            expect(reason.length).toBeGreaterThan(40);
        }
    });

    it('catches a new route that dials without the check (the gate fails when it should)', () => {
        const cases: [string, RegExp, boolean][] = [
            ['export async function POST(req) {\n  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {});\n  return r;\n}\n', /\/Calls\.json/, false],
            ['async function dial(cfg: X, c: ContactClearance) {\n  return placeVobizCall(cfg, {});\n}\n', /placeVobizCall\s*\(/, true],
            ['async function dial(cfg: X, t: { ok: true }) {\n  return placeVobizCall(cfg, {});\n}\n', /placeVobizCall\s*\(/, false],
            ['export async function POST() {\n  const d = await checkContact(input, store);\n  if (!d.allowed) return;\n  await carrier.place(x);\n}\n', /carrier\.place\s*\(/, true],
            ['export async function POST() {\n  await carrier.place(x);\n  await checkContact(input, store);\n}\n', /carrier\.place\s*\(/, false],
            ['const fire = async () => {\n  await fetch(process.env.VOICE_EXOTEL_CALL_URL, {});\n};\n', /VOICE_EXOTEL_CALL_URL/, false],
        ];
        for (const [src, re, ok] of cases) expect(judge(src, src.search(re)).ok).toBe(ok);
    });
});
