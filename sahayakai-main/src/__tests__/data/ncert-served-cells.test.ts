/**
 * Class gate: no curriculum cell changes or disappears without being declared.
 *
 * WHAT HAPPENED
 * The NCF-2023 syllabus fix (PR #131) was deployed from its branch on
 * 2026-08-31 and called live, but never merged. The next deploy from `main`
 * (2026-09-10) silently replaced it, and teachers were served stale chapters
 * in 72 of 115 (grade × subject) cells for two months. Nothing failed, because
 * every gate on `main` described `main`'s own data and was satisfied by it.
 *
 * While rebasing that fix, the old branch also lacked the 13 Class 12 History
 * chapters `main` had gained since the branch was cut. A careless conflict
 * resolution would have deleted a whole cell, and again nothing would have
 * failed: no existing gate knows which cells are supposed to exist.
 *
 * WHAT THIS GATE CATCHES
 * The class: "what the chapter picker serves changed, and nobody said so."
 * The manifest pins every cell's exact served count. Any data edit, merge,
 * rebase or flatten bug that changes what a teacher sees must update the
 * manifest in the same PR, so the change is visible in review, and a cell can
 * only become empty by being moved to `emptyByDecision` with a reason.
 */

import * as fs from 'fs';
import * as path from 'path';
import { allNCERTChapters, getChaptersForGrade } from '@/data/ncert';

interface Manifest {
    served: Record<string, number>;
    emptyByDecision: Record<string, string>;
}

const manifest: Manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'ncert-served-cells.manifest.json'), 'utf8'),
);

const cellKey = (grade: number, subject: string) => `${grade}|${subject}`;

/** Every cell the dataset knows about, including cells whose chapters are all retired. */
const knownCells = Array.from(
    new Set(allNCERTChapters.map((c) => cellKey(c.grade, c.subject))),
);

/** What the chapter picker serves for each known cell (no board filter, as the UI calls it). */
const servedNow: Record<string, number> = {};
for (const cell of knownCells) {
    const [grade, subject] = cell.split('|');
    const n = getChaptersForGrade(Number(grade), subject).length;
    if (n > 0) servedNow[cell] = n;
}

describe('Served curriculum cells match the declared manifest (class gate)', () => {
    it('every served cell and its chapter count is declared', () => {
        // On failure: if the change is intended, update `served` in
        // ncert-served-cells.manifest.json in this PR. If it is not, a merge,
        // rebase or flatten has changed what teachers see.
        expect(servedNow).toEqual(manifest.served);
    });

    it('a known cell that serves nothing is empty by declared decision, not by accident', () => {
        const undeclared = knownCells.filter(
            (cell) => !(cell in servedNow) && !(cell in manifest.emptyByDecision),
        );
        expect(undeclared).toEqual([]);
    });

    it('every declared-empty cell really is empty and gives a reason', () => {
        for (const [cell, reason] of Object.entries(manifest.emptyByDecision)) {
            expect(`${cell}: ${servedNow[cell] ?? 0}`).toBe(`${cell}: 0`);
            expect(reason.trim().length).toBeGreaterThan(20);
        }
    });

    it('no cell is both served and declared empty', () => {
        const both = Object.keys(manifest.emptyByDecision).filter((c) => c in manifest.served);
        expect(both).toEqual([]);
    });

    it('no declared cell has vanished from the dataset entirely', () => {
        // Deleting a cell's chapters outright (rather than retiring them) would
        // otherwise slip past the two checks above.
        const declared = [...Object.keys(manifest.served), ...Object.keys(manifest.emptyByDecision)];
        const vanished = declared.filter((cell) => !knownCells.includes(cell));
        expect(vanished).toEqual([]);
    });
});
