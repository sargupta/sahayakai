/**
 * Class gate: a translation that quotes another UI label quotes it in its own language.
 *
 * The bug this catches: the demo's Practice notice told teachers to press "Start calling now" in
 * English in all ten locales, while the button itself is translated, so a Hindi teacher was told
 * to look for a button that does not exist on screen. Any translated value that still quotes an
 * English string which is itself a key (a label the UI translates) is the same bug.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LOCALES = path.resolve(__dirname, '..', '..', 'locales');
const files = readdirSync(LOCALES).filter((f) => f.endsWith('.json'));
/** Quoted runs: "…", “…” or ‘…’ (not apostrophes inside words). */
const QUOTED = /["“]([^"”\n]{3,80})["”]|‘([^’\n]{3,80})’/g;

function quotedEnglishLabels(value: string, keys: Set<string>): string[] {
    const out: string[] = [];
    for (const m of value.matchAll(QUOTED)) {
        const q = (m[1] ?? m[2]).trim();
        if (/[A-Za-z]/.test(q) && keys.has(q)) out.push(q);
    }
    return out;
}

describe('gate: quoted UI labels are translated inside translations', () => {
    it('finds the locale files at all', () => {
        expect(files.length).toBeGreaterThanOrEqual(10);
    });

    it('recognises the bug it guards against', () => {
        const keys = new Set(['Start calling now']);
        expect(quotedEnglishLabels('दबाएँ "Start calling now"।', keys)).toEqual(['Start calling now']);
        expect(quotedEnglishLabels('दबाएँ "अभी कॉल करना शुरू करें"।', keys)).toEqual([]);
    });

    it.each(files)('%s quotes no label in English', (file) => {
        const dict = JSON.parse(readFileSync(path.join(LOCALES, file), 'utf8')) as Record<string, string>;
        const keys = new Set(Object.keys(dict));
        const bad = Object.entries(dict)
            .filter(([key, value]) => typeof value === 'string' && value !== key)
            .flatMap(([key, value]) => quotedEnglishLabels(value, keys).filter((q) => dict[q] && dict[q] !== q).map((q) => `${key.slice(0, 50)} → "${q}"`));
        expect(bad).toEqual([]);
    });
});
