/** @jest-environment node */
/**
 * Class gate: `.gcloudignore` must never drop application source from a `gcloud builds submit`
 * upload. An unanchored `scripts/*` once matched src/lib/sampark/scripts/ and the build failed
 * with "Module not found". Every exclusion that names a directory also used under src/ must be
 * anchored to the app root (leading slash).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function dirNamesUnder(dir: string, out = new Set<string>()): Set<string> {
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            out.add(name);
            dirNamesUnder(full, out);
        }
    }
    return out;
}

describe('.gcloudignore keeps application source', () => {
    const rules = readFileSync(path.join(ROOT, '.gcloudignore'), 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'));
    const srcDirs = dirNamesUnder(path.join(ROOT, 'src'));

    it('no unanchored rule names a directory that also exists inside src/', () => {
        const offenders = rules.filter((r) => {
            if (r.startsWith('/')) return false;
            const first = r.replace(/\/\*?$/, '').split('/')[0];
            return srcDirs.has(first);
        });
        expect(offenders).toEqual([]);
    });

    it('the top-level scripts/ exclusion is anchored', () => {
        expect(rules).toContain('/scripts/*');
        expect(rules).not.toContain('scripts/*');
        expect(rules).not.toContain('scripts/');
    });
});
