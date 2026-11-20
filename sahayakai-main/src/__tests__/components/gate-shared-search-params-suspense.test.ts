/**
 * Class gate: a shared component that reads the URL's search params carries its own Suspense.
 *
 * The bug this catches: ProviderSwitchPill called useSearchParams() and both SamparkAI frames
 * render it outside every page's own <Suspense>, so `next build` refused to prerender
 * /sampark/choose-provider (missing-suspense-with-csr-bailout) and the whole production build
 * failed. A page can wrap its own content, but a component under src/components is rendered by
 * pages that cannot know it needs a boundary, so it must provide one itself. CI's production
 * build also catches this; this gate catches it in the unit suite, which runs everywhere.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const COMPONENTS = path.resolve(__dirname, '..', '..', 'components');

function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) return name === '__tests__' ? [] : files(p);
        return /\.tsx?$/.test(name) ? [p] : [];
    });
}

const CALLS = /\buseSearchParams\s*\(/;
const BOUNDARY = /<Suspense\b/;

describe('gate: shared components that read search params bring their own Suspense', () => {
    const all = files(COMPONENTS);

    it('scans the components at all', () => {
        expect(all.length).toBeGreaterThan(100);
        expect(all.some((f) => f.endsWith(path.join('sampark', 'provider-switch-pill.tsx')))).toBe(true);
    });

    it('recognises the bug it guards against', () => {
        expect(CALLS.test('const s = useSearchParams();') && !BOUNDARY.test('const s = useSearchParams();')).toBe(true);
    });

    it('every component file that calls useSearchParams() also renders a <Suspense> boundary', () => {
        const unguarded = all.filter((f) => { const t = readFileSync(f, 'utf8'); return CALLS.test(t) && !BOUNDARY.test(t); }).map((f) => path.relative(COMPONENTS, f));
        expect(unguarded).toEqual([]);
    });
});
