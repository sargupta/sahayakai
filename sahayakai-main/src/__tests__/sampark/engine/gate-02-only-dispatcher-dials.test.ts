/**
 * @jest-environment node
 *
 * CLASS GATE 2 — only the dispatcher may make a carrier place a call.
 *
 *  (a) Only these files may import a carrier module (`src/lib/sampark/dispatch/*-carrier`,
 *      today simulated-carrier, in phase 2 vobiz-carrier), by alias or relative path:
 *        src/lib/sampark/dispatch/dispatcher.ts
 *        src/lib/sampark/dispatch/<the carrier module itself>
 *        src/server/sampark/carrier.ts          (the carrier factory)
 *        tests
 *  (b) Under every Sampark source tree (including the phase 2a voice webhooks,
 *      src/app/api/webhooks/sampark-voice/), `.place(` — a call to Carrier.place —
 *      appears only in those same (non-test) files.
 *  (c) Phase 2a: a raw Vobiz dialler (`placeVobizCall`, or any variant of it such as
 *      the hardening sprint's `placeVobizCallDetailed`) is named, in any Sampark
 *      tree, only by the Vobiz carrier module — a webhook or service that dialled
 *      Vobiz directly would bypass the dispatcher (and its claim) entirely.
 *  (d) Phase 2a: the Vobiz carrier module is imported only by the carrier factory
 *      (and tests) — not even the dispatcher, which receives carriers through
 *      `carrierFor`, so the factory's mode/flag/test-phone checks cannot be skipped.
 *
 * The scanner is exercised against planted violations first, so the gate is
 * proven to fail when broken, not just to pass on today's tree.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(ROOT, 'src');

const DIALER_FILES = new Set([
    'src/lib/sampark/dispatch/dispatcher.ts',
    'src/server/sampark/carrier.ts',
]);
const CARRIER_MODULE = /^src\/lib\/sampark\/dispatch\/[^/]+-carrier(?:\/index)?$/;
const VOBIZ_CARRIER = 'src/lib/sampark/dispatch/vobiz-carrier';
const CARRIER_FACTORY = 'src/server/sampark/carrier.ts';
const SAMPARK_TREES = [
    'src/lib/sampark/',
    'src/server/sampark/',
    'src/app/api/sampark/',
    'src/app/api/jobs/sampark-',
    'src/app/api/webhooks/sampark-voice/',
    'src/app/sampark/',
    'src/components/sampark/',
];

function isTest(rel: string): boolean {
    return rel.includes('/__tests__/') || /\.test\.tsx?$/.test(rel);
}

function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function specifiers(code: string): string[] {
    const out: string[] = [];
    const patterns = [
        /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
        /\bimport\s*['"]([^'"]+)['"]/g,
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\bjest\.(?:mock|requireActual)\s*\(\s*['"]([^'"]+)['"]/g,
    ];
    for (const re of patterns) for (const m of code.matchAll(re)) out.push(m[1]);
    return out;
}

function resolveSpecifier(fromRel: string, spec: string): string | null {
    let rel: string;
    if (spec.startsWith('@/')) rel = `src/${spec.slice(2)}`;
    else if (spec.startsWith('.')) rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    return rel.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
}

function isOwnCarrierModule(rel: string): boolean {
    return CARRIER_MODULE.test(rel.replace(/\.tsx?$/, ''));
}

function violations(files: { rel: string; code: string }[]): string[] {
    const found: string[] = [];
    for (const { rel, code } of files) {
        if (isTest(rel)) continue;
        const allowed = DIALER_FILES.has(rel) || isOwnCarrierModule(rel);
        const clean = stripComments(code);
        for (const spec of specifiers(clean)) {
            const target = resolveSpecifier(rel, spec);
            if (target && CARRIER_MODULE.test(target) && !allowed) found.push(`${rel} imports carrier module ${spec}`);
            else if (target === VOBIZ_CARRIER && rel !== CARRIER_FACTORY && !isOwnCarrierModule(rel)) {
                found.push(`${rel} imports the Vobiz carrier outside the carrier factory`);
            }
        }
        const inSampark = SAMPARK_TREES.some((t) => rel.startsWith(t));
        if (inSampark && !allowed && /\.place\s*\(/.test(clean)) {
            found.push(`${rel} calls .place(`);
        }
        // Any dialler of the Vobiz client: placeVobizCall, placeVobizCallDetailed, and whatever comes next.
        const dialler = /\bplaceVobizCall\w*/.exec(clean);
        if (inSampark && rel !== `${VOBIZ_CARRIER}.ts` && dialler) {
            found.push(`${rel} names ${dialler[0]}`);
        }
    }
    return found;
}

function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) acc.push(full);
    }
    return acc;
}

describe('class gate 2 — the scanner catches every shape of violation', () => {
    const planted = (rel: string, code: string) => violations([{ rel, code }]);

    it.each([
        ['alias import', "import { createSimulatedCarrier } from '@/lib/sampark/dispatch/simulated-carrier';"],
        ['type-only import', "import type { X } from '@/lib/sampark/dispatch/simulated-carrier';"],
        ['re-export', "export * from '@/lib/sampark/dispatch/vobiz-carrier';"],
        ['dynamic import', "const m = await import('@/lib/sampark/dispatch/vobiz-carrier');"],
        ['require', "const m = require('@/lib/sampark/dispatch/simulated-carrier');"],
        ['multi-line import', "import {\n  createSimulatedCarrier,\n} from '@/lib/sampark/dispatch/simulated-carrier';"],
    ])('flags a %s outside the dialer', (_label, code) => {
        expect(planted('src/app/api/sampark/[orgId]/campaigns/route.ts', code)).toHaveLength(1);
    });

    it('flags a relative import from a sibling module', () => {
        expect(planted('src/lib/sampark/dispatch/helpers.ts', "import { createSimulatedCarrier } from './simulated-carrier';")).toHaveLength(1);
        expect(planted('src/lib/sampark/audience.ts', "import x from './dispatch/simulated-carrier';")).toHaveLength(1);
    });

    it('flags a direct carrier.place( call anywhere in the Sampark trees outside the dialer', () => {
        expect(planted('src/server/sampark/campaigns.ts', 'await carrier.place({ call, destinationE164, audioSeconds });')).toEqual([
            'src/server/sampark/campaigns.ts calls .place(',
        ]);
        expect(planted('src/app/api/jobs/sampark-dispatch/route.ts', 'await c.place (req)')).toHaveLength(1);
    });

    it('scans the phase 2a voice webhooks too', () => {
        expect(planted('src/app/api/webhooks/sampark-voice/answer/route.ts', 'await carrier.place(req);')).toEqual([
            'src/app/api/webhooks/sampark-voice/answer/route.ts calls .place(',
        ]);
        expect(planted('src/app/api/webhooks/sampark-voice/status/route.ts', "import { createVobizNoticeCarrier } from '@/lib/sampark/dispatch/vobiz-carrier';")).toHaveLength(1);
    });

    it('flags any Sampark module other than the Vobiz carrier that names placeVobizCall', () => {
        const direct = "import { placeVobizCall } from '@/lib/vobiz/client'; await placeVobizCall(config, opts);";
        expect(planted('src/server/sampark/voice.ts', direct)).toEqual(['src/server/sampark/voice.ts names placeVobizCall']);
        expect(planted('src/app/api/webhooks/sampark-voice/gather/route.ts', direct)).toHaveLength(1);
        expect(planted('src/server/sampark/carrier.ts', direct)).toEqual(['src/server/sampark/carrier.ts names placeVobizCall']);
        expect(planted('src/lib/sampark/dispatch/vobiz-carrier.ts', direct)).toEqual([]);
        // Outside the Sampark trees (the teacher parent-call path) it is not this gate's business.
        expect(planted('src/app/api/attendance/call/route.ts', direct)).toEqual([]);
    });

    it('flags the detailed dialler (hardening H7) the same way', () => {
        const detailed = "import { placeVobizCallDetailed } from '@/lib/vobiz/client'; await placeVobizCallDetailed(config, opts);";
        expect(planted('src/server/sampark/voice.ts', detailed)).toEqual(['src/server/sampark/voice.ts names placeVobizCallDetailed']);
        expect(planted('src/server/sampark/jobs.ts', detailed)).toHaveLength(1);
        expect(planted('src/lib/sampark/dispatch/vobiz-carrier.ts', detailed)).toEqual([]);
        // hangupVobizCall ends a leg; it never places one.
        expect(planted('src/server/sampark/hangup.ts', "import { hangupVobizCall } from '@/lib/vobiz/client';")).toEqual([]);
    });

    it('flags the dispatcher importing the Vobiz carrier: carriers reach it only through carrierFor', () => {
        expect(planted('src/lib/sampark/dispatch/dispatcher.ts', "import { createVobizNoticeCarrier } from './vobiz-carrier';")).toEqual([
            'src/lib/sampark/dispatch/dispatcher.ts imports the Vobiz carrier outside the carrier factory',
        ]);
        expect(planted('src/server/sampark/carrier.ts', "import { createVobizNoticeCarrier } from '@/lib/sampark/dispatch/vobiz-carrier';")).toEqual([]);
    });

    it('allows the dispatcher, the carrier module itself, the carrier factory and tests', () => {
        const ok = "import { createSimulatedCarrier } from '@/lib/sampark/dispatch/simulated-carrier'; await carrier.place(req);";
        expect(planted('src/lib/sampark/dispatch/dispatcher.ts', ok)).toEqual([]);
        expect(planted('src/server/sampark/carrier.ts', ok)).toEqual([]);
        expect(planted('src/lib/sampark/dispatch/vobiz-carrier.ts', ok)).toEqual([]);
        expect(planted('src/__tests__/sampark/engine/x.test.ts', ok)).toEqual([]);
    });

    it('ignores comments and unrelated modules', () => {
        expect(planted('src/lib/sampark/audience.ts', "// see carrier.place( in the dispatcher\n/* import '@/lib/sampark/dispatch/simulated-carrier' */")).toEqual([]);
        expect(planted('src/lib/sampark/audience.ts', "import { applyCallEvent } from '@/lib/sampark/dispatch/state';")).toEqual([]);
        expect(planted('src/components/map.tsx', 'marker.place(x)')).toEqual([]);
    });
});

describe('class gate 2 — the source tree', () => {
    it('only the dispatcher (and the carrier factory) import a carrier or call .place(', () => {
        const files = walk(SRC).map((full) => ({ rel: path.relative(ROOT, full).split(path.sep).join('/'), code: fs.readFileSync(full, 'utf8') }));
        expect(files.length).toBeGreaterThan(100);
        expect(files.some((f) => f.rel === 'src/lib/sampark/dispatch/dispatcher.ts')).toBe(true);
        expect(violations(files)).toEqual([]);
    });

    it('the dispatcher really is where .place( happens (the gate is not vacuous)', () => {
        const code = stripComments(fs.readFileSync(path.join(SRC, 'lib/sampark/dispatch/dispatcher.ts'), 'utf8'));
        expect(code).toMatch(/\.place\s*\(/);
    });

    it('the Vobiz carrier exists, dials through placeVobizCallDetailed, and the factory is what constructs it', () => {
        const carrier = stripComments(fs.readFileSync(path.join(ROOT, `${VOBIZ_CARRIER}.ts`), 'utf8'));
        expect(carrier).toMatch(/\bplaceVobizCallDetailed\b/);
        const factory = stripComments(fs.readFileSync(path.join(ROOT, CARRIER_FACTORY), 'utf8'));
        expect(factory).toMatch(/\bcreateVobizNoticeCarrier\s*\(/);
    });
});
