/**
 * Seed script: writes all NCERT chapter data to Firestore
 * Collections: ncert_chapters/{id}, ncert_textbooks/{id}
 * Safe to re-run: uses set({ merge: true })
 *
 * Run: npx tsx --env-file=.env.local src/scripts/seed-ncert.ts
 */

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { allNCERTChapters, type NCERTChapter } from '@/data/ncert';

const BATCH_SIZE = 400; // Firestore max is 500; stay comfortably under it

/** Enrich a chapter with defaults for fields that may not be set in the static data */
function enrich(chapter: NCERTChapter): Record<string, unknown> {
    return {
        ...chapter,
        board: 'NCERT',
        isActive: chapter.isActive ?? true,
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
                board: 'NCERT',
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
            const ref = db.collection('ncert_chapters').doc(chapter.id);
            batch.set(ref, enrich(chapter), { merge: true });
        }

        await batch.commit();
        batchIndex++;
        written += slice.length;
        console.log(`  Batch ${batchIndex}: ${slice.length} chapters (total: ${written})`);
    }

    // --- Seed ncert_textbooks ---
    console.log('\nSeeding ncert_textbooks...');
    const textbooks = buildTextbooks(allNCERTChapters);
    let tbWritten = 0;
    let tbBatch = db.batch();

    for (const [id, data] of textbooks) {
        const ref = db.collection('ncert_textbooks').doc(id);
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
