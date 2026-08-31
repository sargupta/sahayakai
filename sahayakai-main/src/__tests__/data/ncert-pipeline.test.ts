/**
 * Class gates for the curriculum data pipeline.
 *
 * WHAT HAPPENED
 * Three separate defects let a *correct* syllabus dataset reach zero teachers,
 * and each of them passed CI at the time:
 *
 *  1. Split-brain collections. `seed-ncert.ts` wrote `ncert_chapters` while the
 *     read path (`@/server/ncert`) and `/api/migrate-ncert` queried
 *     `ncert_curriculum`. Nothing read what the seed wrote. Every syllabus
 *     correction landed in a collection no request touched.
 *
 *  2. Board inferred from subject. `enrich()` hardcoded a set of eight
 *     "regional" subjects and stamped them `State-SCERT`, everything else
 *     `NCERT`. That is wrong in both directions — NCERT publishes a Class 9
 *     Kannada reader, and Karnataka prints its own Kannada edition of the
 *     NCERT Ganita Prakash — so no chapter could state which board prescribed
 *     it.
 *
 *  3. Stale server data outranking the build. The chapter selector took
 *     Firestore whenever it returned *at least as many* chapters as the bundle.
 *     `ncert_curriculum` held a pre-NCF snapshot, so Class 6 Hindi kept serving
 *     Vasant chapters for months after PR #111 replaced them — while
 *     `ncert.test.ts` asserted, correctly and uselessly, that those same titles
 *     were absent from the static module the UI never read.
 *
 * WHAT THESE GATES CATCH
 * Not the three instances. The classes:
 *   - no curriculum collection name may be written as an inline string, so a
 *     reader and a writer can never again drift apart unnoticed;
 *   - every chapter must carry a board that is a real board, and the board must
 *     not be derivable from the subject alone;
 *   - the bundled dataset must outrank a remote one in the UI merge rule.
 */

import * as fs from 'fs';
import * as path from 'path';
import { allNCERTChapters, getChaptersForGrade, getBoardsForCell, boardOf, DEFAULT_BOARD } from '@/data/ncert';
import { NCERT_CHAPTERS, NCERT_TEXTBOOKS, NCERT_CHAPTERS_LEGACY } from '@/lib/ncert/collections';
import { EDUCATION_BOARDS } from '@/types';

const SRC = path.resolve(__dirname, '../..');

/** Every .ts/.tsx file under src/, excluding tests. */
function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
                walk(full);
            } else if (/\.tsx?$/.test(entry.name)) {
                out.push(full);
            }
        }
    };
    walk(SRC);
    return out;
}

describe('Curriculum collections are named in exactly one place (class gate)', () => {
    const files = sourceFiles();
    const COLLECTION_MODULE = path.join(SRC, 'lib/ncert/collections.ts');

    it.each([NCERT_CHAPTERS, NCERT_TEXTBOOKS, NCERT_CHAPTERS_LEGACY])(
        'no source file inlines the collection name %s',
        (collection) => {
            const offenders = files
                .filter((f) => f !== COLLECTION_MODULE)
                .filter((f) => fs.readFileSync(f, 'utf8').includes(`'${collection}'`))
                .map((f) => path.relative(SRC, f));

            expect(offenders).toEqual([]);
        },
    );

    it('the three collection names are distinct', () => {
        const names = [NCERT_CHAPTERS, NCERT_TEXTBOOKS, NCERT_CHAPTERS_LEGACY];
        expect(new Set(names).size).toBe(names.length);
    });

    it('nothing reads the retired legacy collection', () => {
        // The migration route may write to it to retire it; no getter may read it.
        const readers = files
            .filter((f) => f !== COLLECTION_MODULE)
            .filter((f) => f !== path.join(SRC, 'app/api/migrate-ncert/route.ts'))
            .filter((f) => fs.readFileSync(f, 'utf8').includes('NCERT_CHAPTERS_LEGACY'))
            .map((f) => path.relative(SRC, f));

        expect(readers).toEqual([]);
    });
});

describe('Every chapter states its board (class gate)', () => {
    it('every explicit board is a real EducationBoard', () => {
        const invalid = allNCERTChapters
            .filter((c) => c.board !== undefined)
            .filter((c) => !(EDUCATION_BOARDS as readonly string[]).includes(c.board!))
            .map((c) => `${c.id}: ${c.board}`);

        expect(invalid).toEqual([]);
    });

    it('the default board is itself a real EducationBoard', () => {
        expect(EDUCATION_BOARDS as readonly string[]).toContain(DEFAULT_BOARD);
    });

    it('no chapter carries the retired pseudo-boards', () => {
        // 'NCERT' and 'State-SCERT' are textbook *editions*, not boards. They
        // were written into the board field by the old subject-derived guess.
        const retired = ['NCERT', 'State-SCERT'];
        const offenders = allNCERTChapters
            .filter((c) => c.board !== undefined && retired.includes(c.board as string))
            .map((c) => c.id);

        expect(offenders).toEqual([]);
    });

    it('no source file computes a board with a conditional', () => {
        // The shape of the original defect, verbatim:
        //     board: isStateBoard ? 'State-SCERT' : 'NCERT'
        // A board is read off the chapter, never branched to. Any line that
        // mentions `board` and picks between two board literals is the same
        // mistake wearing a different condition.
        //
        // (Today every subject happens to sit on a single board, so no
        // data-level assertion could catch a reintroduction. This can. The
        // data-level version becomes possible once Class 9 Kannada lands:
        // NCERT's ತಿಳಿ ಕನ್ನಡ and Karnataka's ಸಿರಿ ಕನ್ನಡ put one subject on
        // two boards, and `boardOf` must then distinguish them.)
        const BOARD_LITERALS = [...EDUCATION_BOARDS, 'NCERT', 'State-SCERT'];
        const isBoardLiteral = (s: string) => BOARD_LITERALS.includes(s);

        const offenders: string[] = [];
        for (const file of sourceFiles()) {
            const lines = fs.readFileSync(file, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (!/\bboard\b/i.test(line)) return;
                if (!line.includes('?') || !line.includes(':')) return;
                const literals = [...line.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter(isBoardLiteral);
                if (new Set(literals).size >= 2) {
                    offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
                }
            });
        }

        expect(offenders).toEqual([]);
    });

    it('no source file keeps a subject→board lookup table', () => {
        // The other half of the original defect: the STATE_SCERT_SUBJECTS set
        // that fed the conditional above.
        const offenders: string[] = [];
        for (const file of sourceFiles()) {
            const src = fs.readFileSync(file, 'utf8');
            const names = [...src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
            for (const name of names) {
                if (/SUBJECTS?_(?:TO_)?BOARD|BOARD_(?:BY|FOR|PER)_SUBJECT|SCERT_SUBJECTS|STATE_SUBJECTS/i.test(name)) {
                    offenders.push(`${path.relative(SRC, file)}: ${name}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('regional-language chapters name their actual state board, not a generic one', () => {
        const expected: Record<string, string> = {
            Kannada: 'Karnataka State Board (KSEEB)',
            Tamil: 'Tamil Nadu State Board (SSLC)',
            Telugu: 'Telangana State Board (TSBIE)',
            Marathi: 'Maharashtra State Board (MSBSHSE)',
            Bengali: 'West Bengal State Board (WBBSE)',
            Gujarati: 'Gujarat State Board (GSEB)',
            Punjabi: 'Punjab State Board (PSEB)',
            Malayalam: 'Kerala State Board (SCERT)',
        };
        for (const [subject, board] of Object.entries(expected)) {
            const chapters = allNCERTChapters.filter(
                (c) => c.subject === subject && c.textbookEdition === 'State-SCERT',
            );
            expect(chapters.length).toBeGreaterThan(0);
            for (const c of chapters) {
                expect(`${c.id}:${boardOf(c)}`).toBe(`${c.id}:${board}`);
            }
        }
    });

    it('every chapter has a textbookEdition — no silent grade-based fallback', () => {
        // Sanskrit shipped with this field unset, so the seed script guessed the
        // edition from the grade. A guess that happens to be right is still a guess.
        const missing = allNCERTChapters.filter((c) => !c.textbookEdition).map((c) => c.id);
        expect(missing).toEqual([]);
    });
});

describe('Board-aware chapter queries (class gate)', () => {
    it('filtering by board never returns another board’s chapters', () => {
        for (const board of getBoardsForCell(6, 'Kannada')) {
            const chapters = getChaptersForGrade(6, 'Kannada', board);
            expect(chapters.length).toBeGreaterThan(0);
            for (const c of chapters) expect(boardOf(c)).toBe(board);
        }
    });

    it('omitting the board returns at least as many chapters as any single board', () => {
        const all = getChaptersForGrade(6, 'Kannada');
        for (const board of getBoardsForCell(6, 'Kannada')) {
            expect(all.length).toBeGreaterThanOrEqual(getChaptersForGrade(6, 'Kannada', board).length);
        }
    });

    it('a board with no chapters at a cell returns empty, not a fallback', () => {
        // Silently falling back to another board's book is the failure this
        // whole phase exists to prevent.
        expect(getChaptersForGrade(6, 'Kannada', 'Kerala State Board (SCERT)')).toEqual([]);
    });

    it('a multi-book subject is never ordered by chapter number alone', () => {
        // Class 9 and 10 Social Science span four books that each number from 1.
        // Any ordering keyed only on `number` interleaves four "Chapter 1"s, so
        // the read path must group by book first. This asserts the data really
        // does reuse numbers, which is what makes the naive sort wrong.
        for (const grade of [9, 10]) {
            const chapters = getChaptersForGrade(grade, 'Social Studies');
            const books = new Set(chapters.map((c) => c.textbookName));
            expect(books.size).toBeGreaterThan(1);

            const perNumber = new Map<number, number>();
            for (const c of chapters) perNumber.set(c.number, (perNumber.get(c.number) ?? 0) + 1);
            expect([...perNumber.values()].some((n) => n > 1)).toBe(true);
        }

        // Both sources must use the one comparator, so a cell served from
        // Firestore and the same cell served from the bundle are in the same
        // order — not merely the same set.
        const reader = fs.readFileSync(path.join(SRC, 'server/ncert.ts'), 'utf8');
        expect(reader).not.toMatch(/\.sort\(\(a, b\) => a\.number - b\.number\)/);
        expect(reader).toMatch(/\.sort\(compareChapters\)/);

        for (const grade of [9, 10]) {
            const ordered = getChaptersForGrade(grade, 'Social Studies');
            // Chapters of one book must be contiguous and ascending.
            const seen = new Set<string>();
            let current = '';
            for (const c of ordered) {
                if (c.textbookName !== current) {
                    expect(seen.has(c.textbookName)).toBe(false); // book not revisited
                    seen.add(c.textbookName);
                    current = c.textbookName;
                }
            }
            const byBook = new Map<string, number[]>();
            for (const c of ordered) {
                if (!byBook.has(c.textbookName)) byBook.set(c.textbookName, []);
                byBook.get(c.textbookName)!.push(c.number);
            }
            for (const nums of byBook.values()) {
                expect(nums).toEqual([...nums].sort((a, b) => a - b));
            }
        }
    });
});

describe('The bundled dataset outranks remote data in the UI (class gate)', () => {
    const selector = fs.readFileSync(path.join(SRC, 'components/ncert-chapter-selector.tsx'), 'utf8');

    it('the selector does not prefer the server on chapter count', () => {
        // The exact shape of the pre-2026-08 bug: `serverChapters.length >=
        // staticChapters.length` handed the UI to whichever seed happened to be
        // largest, which was always the stale one.
        expect(selector).not.toMatch(/serverChapters\s*&&\s*serverChapters\.length\s*>=?\s*staticChapters\.length/);
        expect(selector).not.toMatch(/serverChapters\.length\s*>=?\s*staticChapters\.length/);
    });

    it('the selector consults the server only when the bundle has nothing', () => {
        expect(selector).toMatch(/staticChapters\.length\s*>\s*0\s*\?\s*staticChapters\s*:/);
    });
});
