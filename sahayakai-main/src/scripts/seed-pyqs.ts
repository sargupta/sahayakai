/**
 * PYQ Seeder Script
 *
 * Reads all JSON files from src/ai/data/pyq/ and writes each question as a plain
 * tagged document to the `pyq_questions` Firestore collection (idempotent — existing
 * docs are skipped). Retrieval is exact-match on tags (subject/class/chapter), so no
 * embeddings are generated.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/seed-pyqs.ts
 * or:
 *   npx tsx --env-file=.env.local src/scripts/seed-pyqs.ts
 *
 * Requirements:
 *   - .env.local with FIREBASE_SERVICE_ACCOUNT_KEY (or Secret Manager access)
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '@/lib/firebase-admin';
import { derivePYQDocId } from '@/lib/services/pyq-retrieval-service';
import type { PYQQuestion } from '@/lib/services/pyq-retrieval-service';
import { resolveChapterId } from '@/lib/ncert/validate-chapter';
import { classifyQuestionTopicsBatch } from '@/lib/services/topic-classifier';
import { validate, normaliseSubject, normaliseClass, normaliseType, canonicaliseBoard } from '@/lib/pyq/normalize';

// ─── Config ───────────────────────────────────────────────────────────────────

const COLLECTION = 'pyq_questions';
const PYQ_DATA_DIR = path.resolve(__dirname, '../ai/data/pyq');

// Firestore batch limit
const BATCH_SIZE = 500;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed-pyqs] Starting PYQ seeder...');
  console.log(`[seed-pyqs] Reading JSON files from: ${PYQ_DATA_DIR}`);

  if (!fs.existsSync(PYQ_DATA_DIR)) {
    console.error(`[seed-pyqs] ERROR: Directory not found: ${PYQ_DATA_DIR}`);
    process.exit(1);
  }

  const jsonFiles = fs
    .readdirSync(PYQ_DATA_DIR)
    .filter((f) => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log('[seed-pyqs] No JSON files found in pyq/ directory. Nothing to seed.');
    return;
  }

  console.log(`[seed-pyqs] Found ${jsonFiles.length} file(s): ${jsonFiles.join(', ')}`);

  // Collect all questions from all files
  const allQuestions: Array<Omit<PYQQuestion, 'id'>> = [];

  for (const file of jsonFiles) {
    const filePath = path.join(PYQ_DATA_DIR, file);
    let parsed: unknown;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error(`[seed-pyqs] Failed to parse ${file}:`, err);
      process.exit(1);
    }

    // Accept either an array at root or { questions: [...] }
    const questions: Omit<PYQQuestion, 'id'>[] = Array.isArray(parsed)
      ? (parsed as Omit<PYQQuestion, 'id'>[])
      : ((parsed as { questions: Omit<PYQQuestion, 'id'>[] }).questions ?? []);

    console.log(`[seed-pyqs]   ${file}: ${questions.length} question(s)`);
    allQuestions.push(...questions);
  }

  console.log(`[seed-pyqs] Total questions to process: ${allQuestions.length}`);

  // Validate + normalise (M10) BEFORE anything else — skip invalid rows with a
  // WARN (never process.exit; one bad row must not abort the whole seed) and
  // canonicalise subject/class/type/question so the write and the doc-id derived
  // here match what ingest/consolidate produce for the same logical question.
  const validQuestions: Array<Omit<PYQQuestion, 'id'>> = [];
  let invalidCount = 0;
  for (const q of allQuestions) {
    const result = validate(q);
    if (!result.valid) {
      invalidCount++;
      console.warn(`[seed-pyqs] ⚠ SKIP invalid question — ${result.reasons.join('; ')}`);
      continue;
    }
    q.subject = normaliseSubject(String(q.subject))!;
    q.class = normaliseClass(q.class)!;
    q.type = normaliseType(String(q.type))!;
    q.question = q.question.trim();
    validQuestions.push(q);
  }
  console.log(`[seed-pyqs] Valid: ${validQuestions.length} | Invalid (skipped): ${invalidCount}`);

  // Enrich with the stable chapterId (rename-proof join key, Phase 1) BEFORE
  // deriving doc ids, so both the dedup check and the write use the chapterId-
  // based id. Unmappable titles keep chapterId undefined → title fallback.
  let resolvedCount = 0;
  for (const q of validQuestions) {
    const cid = resolveChapterId(`Class ${q.class}`, q.subject, q.chapter);
    if (cid) {
      q.chapterId = cid;
      resolvedCount++;
    }
  }
  console.log(`[seed-pyqs] Resolved chapterId for ${resolvedCount}/${validQuestions.length} question(s).`);

  const db = await getDb();
  const collectionRef = db.collection(COLLECTION);

  // Check which doc IDs already exist (fetch all existing IDs in one list query)
  console.log('[seed-pyqs] Checking for existing documents...');
  const existingIds = new Set<string>();
  const existingSnapshot = await collectionRef.select().get(); // fetch IDs only
  for (const doc of existingSnapshot.docs) {
    existingIds.add(doc.id);
  }
  console.log(`[seed-pyqs] ${existingIds.size} existing document(s) found.`);

  // Filter to questions that need seeding
  const toSeed = validQuestions.filter((q) => {
    const id = derivePYQDocId(q);
    if (existingIds.has(id)) return false;
    return true;
  });

  console.log(`[seed-pyqs] Questions to seed (new): ${toSeed.length}`);

  if (toSeed.length === 0) {
    console.log('[seed-pyqs] All questions already seeded. Nothing to do.');
    return;
  }

  // Tag first-class topics (Phase 4) — ONE batched call per chapter, not per
  // question. Group by chapterId, classify, key results by doc id. Graceful: a
  // chapter's classify failing leaves those docs topicIds:[] (retry next run).
  const topicByDocId = new Map<string, { topicIds: string[]; topicClassVersion: string }>();
  {
    const byChapter = new Map<string, { id: string; question: string }[]>();
    for (const q of toSeed) {
      if (!q.chapterId) continue;
      const list = byChapter.get(q.chapterId) ?? [];
      list.push({ id: derivePYQDocId(q), question: q.question });
      byChapter.set(q.chapterId, list);
    }
    for (const [chapterId, qs] of byChapter) {
      try {
        for (const [id, r] of await classifyQuestionTopicsBatch({ chapterId, questions: qs })) topicByDocId.set(id, r);
      } catch (err) {
        console.warn(`[seed-pyqs] ⚠ topic classification failed for chapter ${chapterId} (${qs.length} q): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(`[seed-pyqs] Classified topics for ${topicByDocId.size} question(s) across ${byChapter.size} chapter(s).`);
  }

  // Process in batches
  let batchCount = 0;
  let writtenCount = 0;

  for (let batchStart = 0; batchStart < toSeed.length; batchStart += BATCH_SIZE) {
    const batchItems = toSeed.slice(batchStart, batchStart + BATCH_SIZE);
    const firestoreBatch = db.batch();

    batchCount++;
    console.log(
      `[seed-pyqs] Processing batch ${batchCount} ` +
        `(items ${batchStart + 1}–${batchStart + batchItems.length})...`
    );

    for (const q of batchItems) {
      const docId = derivePYQDocId(q);

      // Topics were classified per-chapter above; look up by doc id (default []).
      const topicIds = topicByDocId.get(docId)?.topicIds ?? [];
      const topicClassVersion = topicByDocId.get(docId)?.topicClassVersion;

      const docData = {
        question: q.question,
        subject: q.subject,
        class: q.class,
        year: q.year ?? null,
        chapter: q.chapter,
        ...(q.chapterId !== undefined && { chapterId: q.chapterId }),
        topicIds,
        ...(topicClassVersion ? { topicClassVersion } : {}),
        marks: q.marks,
        type: q.type,
        board: canonicaliseBoard(q.board ?? ''),
        ...(q.answer !== undefined && { answer: q.answer }),
        ...(q.frequency !== undefined && { frequency: q.frequency }),
        ...(q.section !== undefined && { section: q.section }),
        seededAt: new Date().toISOString(),
      };

      firestoreBatch.set(collectionRef.doc(docId), docData);
      writtenCount++;
    }

    await firestoreBatch.commit();
    console.log(`[seed-pyqs]   Batch ${batchCount} committed.`);
  }

  console.log('\n[seed-pyqs] Seeding complete.');
  console.log(`  Written : ${writtenCount}`);
  console.log(`  Already existed: ${existingIds.size}`);
}

main().catch((err) => {
  console.error('[seed-pyqs] Fatal error:', err);
  process.exit(1);
});
