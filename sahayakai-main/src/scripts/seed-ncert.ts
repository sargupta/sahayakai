/**
 * Seed script: writes all NCERT chapter data to Firestore
 * Collections: NCERT_CHAPTERS/{id}, ncert_textbooks/{id}
 *
 * Safe to re-run, and reconciling: chapters that have disappeared from the
 * static data since the last run are marked `isActive: false` rather than left
 * behind. Before 2026-08 this used a bare set({ merge: true }), so a run made
 * after a syllabus change left the retired chapters live in Firestore forever —
 * that is how 30 pre-NCF Hindi chapters outlived PR #111.
 *
 * Run: npx tsx --env-file=.env.local src/scripts/seed-ncert.ts
 */

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { allNCERTChapters, boardOf, type NCERTChapter } from '@/data/ncert';
import { NCERT_CHAPTERS, NCERT_TEXTBOOKS } from '@/lib/ncert/collections';

const BATCH_SIZE = 400; // Firestore max is 500; stay comfortably under it

/** Enrich a chapter with defaults for fields that may not be set in the static data */
function enrich(chapter: NCERTChapter): Record<string, unknown> {
    return {
        ...chapter,
        // Board is a property of the chapter, never inferred from its subject —
        // NCERT publishes regional-language books and state boards publish their
        // own editions of NCERT books. See ChapterBoard in @/data/ncert.
        board: boardOf(chapter),
        isActive: chapter.isActive ?? true,
        // textbookEdition is already set explicitly in all source files; ?? is a safety fallback only
        textbookEdition: chapter.textbookEdition ?? (chapter.grade <= 8 ? 'NCF-2023' : 'Rationalized-2022'),
        dataVersion: chapter.dataVersion ?? (chapter.grade <= 8 ? '2025-ncert-ncf' : '2025-ncert-rationalized'),
        seededAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
}

/** Build the ncert_textbooks reference documents from chapter data */
function buildTextbooks(chapters: NCERTChapter[]): Map<string, Record<string, unknown>> {
    const books = new Map<string, Record<string, unknown>>();

    for (const ch of chapters) {
        const key = `${ch.subject.toLowerCase().replace(/\s+/g, '-')}-${ch.textbookName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (!books.has(key)) {
            books.set(key, {
                id: key,
                name: ch.textbookName,
                subject: ch.subject,
                grades: [ch.grade],
                edition: ch.textbookEdition ?? (ch.grade <= 8 ? 'NCF-2023' : 'Rationalized-2022'),
                board: boardOf(ch),
                seededAt: FieldValue.serverTimestamp(),
            });
        } else {
            // Accumulate grades
            const existing = books.get(key)!;
            const grades = existing.grades as number[];
            if (!grades.includes(ch.grade)) {
                grades.push(ch.grade);
                grades.sort((a, b) => a - b);
            }
        }
    }

    return books;
}

async function main() {
    const db = await getDb();

    const activeChapters = allNCERTChapters.filter(c => c.isActive !== false);
    const inactiveChapters = allNCERTChapters.filter(c => c.isActive === false);

    console.log(`\nNCERT Seed — 2025-26 Syllabus`);
    console.log(`  Total chapters:    ${allNCERTChapters.length}`);
    console.log(`  Active chapters:   ${activeChapters.length}`);
    console.log(`  Inactive (removed): ${inactiveChapters.length}`);

    // --- Subject breakdown ---
    const bySubject = new Map<string, number>();
    for (const ch of allNCERTChapters) {
        bySubject.set(ch.subject, (bySubject.get(ch.subject) ?? 0) + 1);
    }
    console.log('\n  By subject:');
    for (const [subj, count] of [...bySubject.entries()].sort()) {
        console.log(`    ${subj.padEnd(25)} ${count}`);
    }

    // --- Seed ncert_chapters ---
    console.log('\nSeeding ncert_chapters...');
    let written = 0;
    let batchIndex = 0;

    while (written < allNCERTChapters.length) {
        const slice = allNCERTChapters.slice(written, written + BATCH_SIZE);
        const batch = db.batch();

        for (const chapter of slice) {
            const ref = db.collection(NCERT_CHAPTERS).doc(chapter.id);
            batch.set(ref, enrich(chapter), { merge: true });
        }

        await batch.commit();
        batchIndex++;
        written += slice.length;
        console.log(`  Batch ${batchIndex}: ${slice.length} chapters (total: ${written})`);
    }

    // --- Reconcile: retire chapters no longer in the static data ---
    // set({ merge: true }) above can only add and update. Without this pass a
    // syllabus change leaves the superseded chapters live in Firestore, where
    // they outrank the corrected static data in the chapter selector.
    console.log('\nReconciling removed chapters...');
    const staticIds = new Set(allNCERTChapters.map(c => c.id));
    const existing = await db.collection(NCERT_CHAPTERS).select('isActive').get();
    const stale = existing.docs.filter(d => !staticIds.has(d.id) && d.get('isActive') !== false);

    if (stale.length === 0) {
        console.log('  Nothing to retire — Firestore matches the static data.');
    } else {
        let retired = 0;
        while (retired < stale.length) {
            const slice = stale.slice(retired, retired + BATCH_SIZE);
            const batch = db.batch();
            for (const doc of slice) {
                batch.set(doc.ref, {
                    isActive: false,
                    retiredAt: FieldValue.serverTimestamp(),
                    retiredReason: 'absent-from-static-data',
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            await batch.commit();
            retired += slice.length;
        }
        console.log(`  Retired ${stale.length} chapters absent from the static data:`);
        for (const d of stale.slice(0, 40)) console.log(`    ${d.id}`);
        if (stale.length > 40) console.log(`    … and ${stale.length - 40} more`);
    }

    // --- Seed ncert_textbooks ---
    console.log('\nSeeding ncert_textbooks...');
    const textbooks = buildTextbooks(allNCERTChapters);
    let tbWritten = 0;
    let tbBatch = db.batch();

    for (const [id, data] of textbooks) {
        const ref = db.collection(NCERT_TEXTBOOKS).doc(id);
        tbBatch.set(ref, data, { merge: true });
        tbWritten++;

        if (tbWritten % BATCH_SIZE === 0) {
            await tbBatch.commit();
            tbBatch = db.batch();
            console.log(`  Committed ${tbWritten} textbook records`);
        }
    }
    if (tbWritten % BATCH_SIZE !== 0) {
        await tbBatch.commit();
    }
    console.log(`  Textbooks seeded: ${textbooks.size}`);

    console.log('\n✓ Seed complete!');
    console.log(`  ncert_chapters: ${allNCERTChapters.length} docs`);
    console.log(`  ncert_textbooks: ${textbooks.size} docs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
