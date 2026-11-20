/**
 * Saving a generated artifact to the Library must never cost the teacher the artifact.
 *
 * Class gate for the quiz generator's 500 (found in the 2026-11 demo-readiness pass): it was the
 * one flow whose Library save ran outside a try block, so when Storage was unavailable the three
 * generated variants were thrown away and the teacher saw "AI generation failed". Every flow that
 * writes to Storage must do it inside a try, so a failed save degrades to "not saved" instead.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const FLOWS = join(__dirname, '..', '..', '..', 'ai', 'flows');

/** Is the character offset `at` inside a `try { … }` block of `src`? (brace matching; good enough for our flows) */
function insideTry(src: string, at: number): boolean {
    const tryRe = /\btry\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = tryRe.exec(src)) && m.index < at) {
        let depth = 0;
        for (let i = m.index + m[0].length - 1; i < src.length; i++) {
            const ch = src[i];
            if (ch === '{') depth += 1;
            else if (ch === '}') {
                depth -= 1;
                if (depth === 0) {
                    if (i > at) return true;
                    break;
                }
            }
        }
    }
    return false;
}

const files = readdirSync(FLOWS).filter((f) => f.endsWith('.ts'));
const saves = files.flatMap((file) => {
    const src = readFileSync(join(FLOWS, file), 'utf8');
    return [...src.matchAll(/await\s+getStorageInstance\(\)/g)].map((m) => ({ file, at: m.index ?? 0, src }));
});

describe('generator flows guard their Library save', () => {
    it('finds the Storage writes', () => {
        expect(saves.length).toBeGreaterThan(8);
    });

    it('performs every Storage write inside a try block', () => {
        const unguarded = saves
            .filter((s) => !insideTry(s.src, s.at))
            .map((s) => `${s.file}:${s.src.slice(0, s.at).split('\n').length}`);
        expect(unguarded).toEqual([]);
    });
});
