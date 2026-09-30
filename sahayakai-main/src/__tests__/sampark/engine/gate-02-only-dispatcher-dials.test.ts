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
 *  (b) Under every Sampark source tree, `.place(` — a call to Carrier.place —
 *      appears only in those same (non-test) files.
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
const SAMPARK_TREES = [
    'src/lib/sampark/',
    'src/server/sampark/',
    'src/app/api/sampark/',
    'src/app/api/jobs/sampark-',
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
        }
        if (SAMPARK_TREES.some((t) => rel.startsWith(t)) && !allowed && /\.place\s*\(/.test(clean)) {
            found.push(`${rel} calls .place(`);
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
});
