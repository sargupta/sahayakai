/**
 * @jest-environment node
 *
 * Class gate: nothing in public/ may be a path the middleware refuses.
 *
 * Why: the service worker precaches every file in public/ (serwist's default
 * globPublicPatterns, see src/app/sw.ts). The middleware answers 404 in
 * production for internal developer surfaces (isInternalDevSurface). A file
 * that is both in public/ and refused makes the precache request fail, which
 * fails the service worker's install: installed PWAs stop updating and new
 * visitors get no offline support. That shipped on 2026-11-24 with
 * public/swagger.html and public/api-docs.html.
 *
 * Root-level *.map files are build output, not source, and serwist leaves
 * source maps out of the manifest, so only committed files are checked.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { isInternalDevSurface } from '@/lib/access/access-state';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function walk(dir: string, prefix = ''): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = `${prefix}/${name}`;
        if (statSync(full).isDirectory()) out.push(...walk(full, rel));
        else out.push(rel);
    }
    return out;
}

describe('public/ versus the middleware developer-surface block', () => {
    const files = walk(PUBLIC_DIR).filter((f) => !f.endsWith('.map'));

    it('finds the public directory', () => {
        expect(files.length).toBeGreaterThan(5);
        expect(files).toContain('/offline.html');
    });

    it('ships no file the middleware answers 404 for', () => {
        const refused = files.filter((f) => isInternalDevSurface(f));
        expect(refused).toEqual([]);
    });

    it('ships no file whose clean URL the middleware answers 404 for', () => {
        // The service worker's precache also answers the extension-less form
        // (cleanURLs), so /api-docs.html would shadow /api-docs.
        const refused = files
            .filter((f) => f.endsWith('.html'))
            .filter((f) => isInternalDevSurface(f.slice(0, -'.html'.length)));
        expect(refused).toEqual([]);
    });
});
