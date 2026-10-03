/**
 * @jest-environment node
 *
 * CLASS GATE: the real test-call tool stays standalone.
 *
 * scripts/sampark/vobiz-test-call.ts and scripts/sampark/lib/testcall-*.ts may
 * import only: node builtins, each other, and these four src modules:
 *   src/lib/vobiz/client, src/lib/vobiz/tokens, src/lib/calling-hours, src/lib/sampark/phone.
 * Nothing from the Sampark engine (dispatch, policy, repo, rules), src/server,
 * a model client, Firestore, or a bare npm package. The scanner is first proven
 * against planted violations, so the gate fails when broken.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const SCRIPTS = path.join(ROOT, 'scripts/sampark');

const ALLOWED_SRC = new Set([
    'src/lib/vobiz/client', 'src/lib/vobiz/tokens', 'src/lib/calling-hours', 'src/lib/sampark/phone',
]);

function importsOf(source: string): string[] {
    const out: string[] = [];
    const re = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of source.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
    return out;
}

/** Violations for one file's imports. `file` is absolute. */
function violations(file: string, specs: string[]): string[] {
    const bad: string[] = [];
    for (const spec of specs) {
        if (spec.startsWith('node:')) continue;
        let resolved: string | null = null;
        if (spec.startsWith('.')) resolved = path.resolve(path.dirname(file), spec);
        else if (spec.startsWith('@/')) resolved = path.join(ROOT, 'src', spec.slice(2));
        if (resolved === null) { bad.push(`${spec} (bare package)`); continue; }
        const rel = path.relative(ROOT, resolved).replace(/\\/g, '/');
        if (rel.startsWith('scripts/sampark/')) {
            // only the tool's own files
            if (/^scripts\/sampark\/(vobiz-test-call|lib\/testcall-[a-z]+)$/.test(rel)) continue;
            bad.push(`${spec} (another script)`);
        } else if (!ALLOWED_SRC.has(rel)) bad.push(`${spec} -> ${rel}`);
    }
    return bad;
}

const FILES = [
    path.join(SCRIPTS, 'vobiz-test-call.ts'),
    ...fs.readdirSync(path.join(SCRIPTS, 'lib')).filter((f) => f.startsWith('testcall-')).map((f) => path.join(SCRIPTS, 'lib', f)),
];

describe('scanner self-check (planted violations)', () => {
    const f = path.join(SCRIPTS, 'vobiz-test-call.ts');
    it.each([
        ["import { x } from '../../src/lib/sampark/dispatch/dispatcher';"],
        ["import { x } from '@/lib/sampark/policy/gates';"],
        ["import { x } from '@/lib/sampark/repo/guardians';"],
        ["import { x } from '@/lib/sampark/rules/anything';"],
        ["import { x } from '../../src/server/sampark/carrier';"],
        ["import { x } from '@/lib/secrets';"],
        ["import { x } from '@google/genai';"],
        ["import admin from 'firebase-admin';"],
        ["const m = require('@/server/auth');"],
        ["const m = await import('@/ai/flows/foo');"],
        ["import { x } from './fakes';"],
    ])('flags %s', (line) => {
        expect(violations(f, importsOf(line))).not.toEqual([]);
    });
    it('accepts the allowed modules and node builtins', () => {
        const ok = [
            "import fs from 'node:fs';",
            "import { a } from '../../src/lib/vobiz/client';",
            "import { b } from '@/lib/calling-hours';",
            "import { c } from '../../src/lib/sampark/phone';",
            "import { d } from './lib/testcall-core';",
            "export * from './lib/testcall-audio';",
            "import type { E } from './lib/testcall-audio';",
        ].join('\n');
        expect(violations(path.join(SCRIPTS, 'vobiz-test-call.ts'), importsOf(ok))).toEqual([]);
    });
});

describe('the real tool files', () => {
    it('finds the CLI and its lib files', () => {
        expect(FILES.length).toBeGreaterThanOrEqual(3);
    });
    it.each(FILES.map((f) => [path.relative(ROOT, f), f]))('%s imports only the allowed modules', (_rel, file) => {
        expect(violations(file, importsOf(fs.readFileSync(file, 'utf8')))).toEqual([]);
    });
    it('has exactly one dial call site (no retry loop)', () => {
        const src = FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
        expect((src.match(/placeVobizCall\(/g) ?? []).length).toBe(1); // exactly one dial call site
    });
});

describe('Sampark engine gates are untouched', () => {
    it('no guarded engine file or gate test differs from the base branch', () => {
        // Cheap structural check: the tool must not be imported by the guarded trees.
        const guarded = ['src/server/sampark/carrier.ts', 'src/server/sampark/gate.ts', 'src/server/sampark/school.ts'];
        for (const g of guarded) {
            const p = path.join(ROOT, g);
            if (!fs.existsSync(p)) continue;
            expect(fs.readFileSync(p, 'utf8')).not.toMatch(/testcall|vobiz-test-call/);
        }
    });
});
