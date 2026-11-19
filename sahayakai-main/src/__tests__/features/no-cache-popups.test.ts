/**
 * CLASS GATE — no popup ever tells the teacher a result came from a cache.
 *
 * Founder request (2026-11-17): generating a quick lesson plan showed "⚡ Instant Load —
 * Loaded from local DB cache." (and a "☁️ Community Cache" sibling). A cached result must
 * simply appear. This scans every toast(...) call in the app source for cache wording.
 */
import fs from 'fs';
import path from 'path';

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
        else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

it('no toast title or description mentions a cache', () => {
    const offenders: string[] = [];
    for (const f of walk(path.join(process.cwd(), 'src'))) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(/toast\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
            const fields = m[1].match(/(title|description)\s*:\s*[^,\n]+/g) ?? [];
            if (fields.some((x) => /cach|local DB|Instant Load/i.test(x))) offenders.push(path.relative(process.cwd(), f));
        }
    }
    expect(offenders).toEqual([]);
});
