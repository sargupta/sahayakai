/**
 * CLASS GATE — a shared component that calls useSearchParams() carries its own Suspense boundary.
 *
 * Bug: ProviderSwitchPill (rendered by SamparkFrame and DemoFrame) called useSearchParams()
 * with no Suspense boundary, so `next build` failed to prerender /sampark/workspace and the
 * production build exited 1. A shared component cannot know whether its page has a
 * boundary, so every component under src/components that calls useSearchParams must also
 * render <Suspense> itself.
 */
import fs from 'fs';
import path from 'path';

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
    }
    return out;
}

it('every component calling useSearchParams() also renders <Suspense>', () => {
    const root = path.join(process.cwd(), 'src', 'components');
    const offenders = walk(root)
        .filter((f) => /useSearchParams\s*\(/.test(fs.readFileSync(f, 'utf8')))
        .filter((f) => !/<Suspense[\s>]/.test(fs.readFileSync(f, 'utf8')))
        .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
});
