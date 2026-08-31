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
 *     `NCERT`. Karnataka prints its own Kannada edition of the NCERT Ganita
 *     Prakash, so Mathematics is not always CBSE; and KTBS publishes three
 *     Kannada readers for one grade (Siri, Tili, Nudi), so the subject does not
 *     even determine the book. No chapter could state which board prescribed it.
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
 *   - the bundled dataset must outrank a remote one in the UI merge rule;
 *   - a flatten may not overwrite what a chapter declares. Three of them
 *     hardcoded `isActive: true` (Mathematics, Science, Information
 *     Technology), so no chapter in those subjects could ever be retired, and
 *     the Mathematics one also replaced `textbookName` with a grade→name
 *     lookup — which is how Classes 1–5 displayed "Maths Mela 3" over chapters
 *     the data itself labels "Ganita ka Jadu / Math Magic 3".
 */

import * as fs from 'fs';
import * as path from 'path';
import { allNCERTChapters, getChaptersForGrade, getBoardsForCell, boardOf, DEFAULT_BOARD, type NCERTChapter } from '@/data/ncert';
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
        // data-level version becomes possible once the Karnataka lane lands:
        // Karnataka's Kannada edition of Ganita Prakash puts Mathematics on
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
        // Find the multi-book cells rather than naming them: which grades span
        // volumes changes as books are replaced (Class 9 Social Science became
        // a single integrated volume in 2026-27), but the ordering rule does not.
        const cells = new Map<string, NCERTChapter[]>();
        for (const c of allNCERTChapters) {
            if (c.isActive === false) continue;
            const k = `${c.grade}|${c.subject}`;
            if (!cells.has(k)) cells.set(k, []);
            cells.get(k)!.push(c);
        }
        const multiBook = [...cells.entries()].filter(
            ([, cs]) => new Set(cs.map((c) => c.textbookName)).size > 1,
        );
        expect(multiBook.length).toBeGreaterThan(0);

        for (const [key, cs] of multiBook) {
            const perNumber = new Map<number, number>();
            for (const c of cs) perNumber.set(c.number, (perNumber.get(c.number) ?? 0) + 1);
            if (![...perNumber.values()].some((n) => n > 1)) continue; // numbered continuously across volumes

            const [grade, subject] = key.split('|');
            const ordered = getChaptersForGrade(Number(grade), subject);
            const seen = new Set<string>();
            let current = '';
            for (const c of ordered) {
                if (c.textbookName !== current) {
                    expect(`${key}: ${c.textbookName}`).toBe(
                        seen.has(c.textbookName) ? 'not revisited' : `${key}: ${c.textbookName}`,
                    );
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

describe('A flatten may not overwrite what a chapter declares (class gate)', () => {
    // Mathematics and Science are stored as NCERTGrade[] and flattened into
    // NCERTChapter[]. Both flattens hardcoded `isActive: true` and derived
    // `textbookEdition` from the grade, which meant no chapter in either
    // subject could be retired — the mechanism every other subject uses to
    // supersede a book — and a grade holding both a retired and a current book
    // got one edition stamped across both. The Mathematics flatten also
    // replaced `textbookName` with a grade→name lookup, which is what let
    // Classes 1–5 display "Maths Mela 3" over chapters that the data itself
    // labels "Ganita ka Jadu / Math Magic 3".

    it('no flatten in the data layer hardcodes isActive', () => {
        const offenders: string[] = [];
        for (const file of sourceFiles().filter((f) => f.includes(`${path.sep}data${path.sep}ncert${path.sep}`))) {
            const src = fs.readFileSync(file, 'utf8');
            if (!src.includes('flatMap')) continue;
            src.split('\n').forEach((line, i) => {
                if (/^\s*isActive:\s*(true|false)\s*,\s*$/.test(line)) {
                    offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
                }
            });
        }
        expect(offenders).toEqual([]);
    });

    it('a declared retirement survives the flatten', () => {
        // Every subject that superseded a book at Class 9 must expose both the
        // new chapters and the retired ones. A flatten that drops `isActive`
        // silently republishes the old book.
        for (const subject of ['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies']) {
            const all = allNCERTChapters.filter((c) => c.grade === 9 && c.subject === subject);
            const active = all.filter((c) => c.isActive !== false);
            const retired = all.filter((c) => c.isActive === false);
            expect(`${subject} retired`).toBe(retired.length > 0 ? `${subject} retired` : 'none — flatten dropped it');
            expect(new Set(active.map((c) => c.textbookName)).size).toBe(1);
        }
    });

    it('no retired Class 9 book leaks back into the active list', () => {
        const retiredBooks = [
            'Mathematics (NCERT)', 'Ganit / Mathematics (NCERT)', 'Beehive', 'Science (NCERT)',
            'Kshitij Bhag I', 'India and the Contemporary World I', 'Contemporary India I',
            'Democratic Politics I', 'Economics',
        ];
        for (const subject of ['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies']) {
            const active = getChaptersForGrade(9, subject);
            for (const c of active) {
                expect(`${c.id}: ${c.textbookName}`).toBe(
                    retiredBooks.includes(c.textbookName) ? 'a current book' : `${c.id}: ${c.textbookName}`,
                );
            }
        }
    });

    it('Class 9 signature chapters of the retired books are gone from the active list', () => {
        const retired: Array<[string, string]> = [
            ['Mathematics', 'Number Systems'],
            ['English', 'The Fun They Had'],
            ['Science', 'Matter in Our Surroundings'],
            ['Hindi', 'दो बैलों की कथा'],           // Kshitij; Ganga reprints it, see below
            ['Social Studies', 'The French Revolution'],
        ];
        for (const [subject, title] of retired) {
            const active = getChaptersForGrade(9, subject);
            if (subject === 'Hindi') {
                // Ganga carries दो बैलों की कथा as its own chapter 1, so the title
                // is not a marker here — assert on the book instead.
                expect(active.every((c) => c.textbookName === 'Ganga')).toBe(true);
                continue;
            }
            expect(active.map((c) => c.title)).not.toContain(title);
        }
    });
});

describe('No retired book is served at any grade (class gate)', () => {
    // The half-migration class, generalised: a current book name may never sit
    // over a retired book's chapter list. PR #111 gated this for Classes 6-8 by
    // listing signature titles; that list has to grow every time a book changes
    // and says nothing about the grades nobody remembered. Assert on the book
    // name instead — every active chapter must name a book that is currently
    // prescribed, so a stale list cannot hide behind a fresh label.
    // Retirement is per grade, not per title: `Ganit / Mathematics (NCERT)` is
    // retired at Class 9 and still prescribed at Class 10, and `Science
    // (NCERT)` likewise. A flat title blocklist would either miss the Class 9
    // regression or falsely condemn Class 10.
    const RETIRED_BOOKS: Array<[RegExp, number[]]> = [
        // Pre-NCF primary — retired everywhere they appeared
        [/^Marigold/i, [1, 2, 3, 4, 5]],
        [/^Rimjhim/i, [1, 2, 3, 4, 5]],
        [/Math Magic|Ganita ka Jadu/i, [1, 2, 3, 4, 5]],
        [/^Looking Around/i, [3, 4, 5]],
        // Pre-NCF middle — retired by PR #111
        [/^Honeysuckle|^Honeydew|^Vasant|^Ruchira/i, [6, 7, 8]],
        // Superseded at Class 9 in 2026-27 only
        [/^Beehive$|^Moments$/, [9]],
        [/^Kshitij Bhag I$/, [9]],
        [/^Science \(NCERT\)$/, [9]],
        [/^Ganit \/ Mathematics \(NCERT\)$|^Mathematics \(NCERT\)$/, [9]],
        [/^India and the Contemporary World I$|^Contemporary India I$/, [9]],
        [/^Democratic Politics I$|^Economics$/, [9]],
    ];

    it('no active chapter names a book retired at its grade', () => {
        const offenders = allNCERTChapters
            .filter((c) => c.isActive !== false)
            .filter((c) => RETIRED_BOOKS.some(([re, grades]) => grades.includes(c.grade) && re.test(c.textbookName)))
            .map((c) => `${c.id} (G${c.grade} ${c.subject}): ${c.textbookName}`);

        expect(offenders).toEqual([]);
    });

    it('every grade that replaced a book still holds the retired chapters', () => {
        // Retire, do not delete — saved lesson plans reference the old ids.
        const replaced: Array<[number, string]> = [
            [1, 'Mathematics'], [2, 'Mathematics'], [3, 'Mathematics'], [4, 'Mathematics'], [5, 'Mathematics'],
            [1, 'English'], [2, 'English'], [3, 'English'], [4, 'English'], [5, 'English'],
            [1, 'Hindi'], [2, 'Hindi'], [3, 'Hindi'], [4, 'Hindi'], [5, 'Hindi'],
            [3, 'EVS'], [4, 'EVS'], [5, 'EVS'],
            [9, 'Mathematics'], [9, 'English'], [9, 'Science'], [9, 'Hindi'], [9, 'Social Studies'],
        ];
        for (const [grade, subject] of replaced) {
            const retired = allNCERTChapters.filter(
                (c) => c.grade === grade && c.subject === subject && c.isActive === false,
            );
            expect(`G${grade} ${subject}: ${retired.length}`).not.toBe(`G${grade} ${subject}: 0`);
        }
    });

    it('each replaced cell serves exactly one current book', () => {
        for (const grade of [1, 2, 3, 4, 5]) {
            for (const subject of ['Mathematics', 'English', 'Hindi']) {
                const books = new Set(getChaptersForGrade(grade, subject).map((c) => c.textbookName));
                expect(`G${grade} ${subject}: ${[...books].join(', ')}`).toBe(
                    `G${grade} ${subject}: ${[...books][0]}`,
                );
            }
        }
    });

    it('no chapter id is reused between a retired and a current book', () => {
        const byId = new Map<string, number>();
        for (const c of allNCERTChapters) byId.set(c.id, (byId.get(c.id) ?? 0) + 1);
        expect([...byId.entries()].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
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
