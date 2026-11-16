/**
 * Class gate: the NCERT curriculum tables never load with the home page or the root layout.
 *
 * The bug this catches: the onboarding hook behind the dashboard imported
 * `@/lib/contextual-suggestions` statically, which imports `@/data/ncert`, so every subject's
 * chapters for every class shipped in the first-load bundle of `/`. When the NCF-2023 books
 * landed (#131) that bundle grew to 2406 kB against CI's 2250 kB budget. The tables may only be
 * reached through a dynamic `import()`, which the bundler splits into a chunk loaded on demand.
 *
 * The gate walks the static import graph (value imports and re-exports; `import type` and
 * `import()` are not followed) from the entry files below and fails if it reaches
 * src/data/ncert/. CI's byte budget catches the same bug only after a full build, and cannot say
 * which import caused it; this names the chain.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', '..');
const ENTRIES = ['app/page.tsx', 'app/layout.tsx', 'app/error.tsx', 'app/not-found.tsx'].filter((p) => existsSync(path.join(SRC, p))).map((p) => path.join(SRC, p));
const CURRICULUM = path.join(SRC, 'data', 'ncert') + path.sep;

/** A CommonJS require() is as static as an import for the bundler. */
const REQUIRE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Value imports and re-exports, minus type-only ones. Dynamic import() is deliberately not matched. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

function resolve(spec: string, from: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
    else return null; // a package: not our source
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
        if (existsSync(c) && statSync(c).isFile()) return c;
    }
    return null;
}

/** Every source file statically reachable from `entries`, with the chain that reached it. */
function reachable(entries: string[]): Map<string, string[]> {
    const seen = new Map<string, string[]>();
    const queue: Array<[string, string[]]> = entries.map((e) => [e, [path.relative(SRC, e)]]);
    while (queue.length) {
        const [file, chain] = queue.shift()!;
        if (seen.has(file)) continue;
        seen.set(file, chain);
        const text = readFileSync(file, 'utf8');
        for (const m of [...text.matchAll(STATIC_IMPORT), ...text.matchAll(REQUIRE)]) {
            const next = resolve(m[1], file);
            if (next && !seen.has(next)) queue.push([next, [...chain, path.relative(SRC, next)]]);
        }
    }
    return seen;
}

describe('gate: the home page does not load the curriculum tables', () => {
    it('walks the real graph at all', () => {
        // A gate that follows nothing reports green forever.
        const fromHome = reachable(ENTRIES);
        expect(fromHome.has(path.join(SRC, 'components', 'dashboard', 'dashboard-home.tsx'))).toBe(true);
        const fromSuggestions = reachable([path.join(SRC, 'lib', 'contextual-suggestions.ts')]);
        expect([...fromSuggestions.keys()].some((f) => f.startsWith(CURRICULUM))).toBe(true);
    });

    it('ignores type-only imports and dynamic import()', () => {
        const text = "import type { A } from '@/data/ncert/index';\nconst m = () => import('@/data/ncert/index');\nexport type { B } from './x';";
        expect([...text.matchAll(STATIC_IMPORT)].map((m) => m[1])).toEqual([]);
        expect([...("import { a } from '@/x';\nexport { b } from './y';\nimport './z';").matchAll(STATIC_IMPORT)].map((m) => m[1])).toEqual(['@/x', './y', './z']);
        expect([..."const n = require('@/data/ncert/index');".matchAll(REQUIRE)].map((m) => m[1])).toEqual(['@/data/ncert/index']);
    });

    it('no file reachable from the home page or the root layout is a curriculum table', () => {
        const hits = [...reachable(ENTRIES).entries()].filter(([f]) => f.startsWith(CURRICULUM)).map(([, chain]) => chain.join(' -> '));
        expect(hits).toEqual([]);
    });
});
