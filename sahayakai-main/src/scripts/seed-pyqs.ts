/**
 * PYQ Seeder Script
 *
 * Reads all JSON files from src/ai/data/pyq/, generates Vertex AI embeddings
 * for each question, and writes the documents to the `pyq_questions` Firestore
 * collection (idempotent — existing docs are skipped).
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/seed-pyqs.ts
 * or:
 *   npx tsx --env-file=.env.local src/scripts/seed-pyqs.ts
 *
 * Requirements:
 *   - .env.local with FIREBASE_SERVICE_ACCOUNT_KEY (or Secret Manager access)
 *   - The service account must have roles/aiplatform.user in GCP project
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbedding } from '@/lib/services/pyq-retrieval-service';
import type { PYQQuestion } from '@/lib/services/pyq-retrieval-service';

// ─── Config ───────────────────────────────────────────────────────────────────

const COLLECTION = 'pyq_questions';
const PYQ_DATA_DIR = path.resolve(__dirname, '../ai/data/pyq');

// Firestore batch limit
const BATCH_SIZE = 500;

// Pause between embedding API calls (ms) to avoid rate-limit bursts.
// 200ms = 5 QPS — leaves 50% headroom below the 10 QPS Vertex AI default quota.
const EMBED_DELAY_MS = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the text that will be embedded for a question.
 * Includes board/subject/class as prefix so cross-class/cross-subject questions
 * produce distinct vectors even when the question text is identical.
 * Format: "{board} {subject} Class {class} — {chapter} {topic}: {question}"
 */
function buildEmbedText(q: Omit<PYQQuestion, 'id'>): string {
  const topic = q.topic ?? ''; // guard against undefined rendering as "undefined"
  return `${q.board} ${q.subject} Class ${q.class} — ${q.chapter}${topic ? ` ${topic}` : ''}: ${q.question}`;
}

/**
 * Retry an async operation with exponential backoff.
 * Treats HTTP 429 responses (rate limit) as retryable.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 500
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('rate'));
      if (!isRateLimit || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[seed-pyqs]   Rate-limited (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  // unreachable but satisfies TypeScript
  throw new Error('withRetry: exhausted retries');
}

/**
 * Derive a stable document ID from the question so the script is idempotent.
 * Uses board-subject-class-chapter-type-year-marks-question hash.
 */
function deriveDocId(q: Omit<PYQQuestion, 'id'>): string {
  const raw = [
    q.board,
    q.subject,
    String(q.class),
    q.chapter,
    q.type,
    String(q.year ?? 'null'),
    String(q.marks),
    q.question.slice(0, 80),
  ].join('|');

  // Simple djb2-style hash — good enough for dedup; not crypto
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return `${q.board}_${q.subject}_c${q.class}_${hash.toString(16)}`;
}

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
  const toSeed = allQuestions.filter((q) => {
    const id = deriveDocId(q);
    if (existingIds.has(id)) return false;
    return true;
  });

  console.log(`[seed-pyqs] Questions to seed (new): ${toSeed.length}`);

  if (toSeed.length === 0) {
    console.log('[seed-pyqs] All questions already seeded. Nothing to do.');
    return;
  }

  // Process in batches
  let batchCount = 0;
  let skippedCount = 0;
  let writtenCount = 0;

  for (let batchStart = 0; batchStart < toSeed.length; batchStart += BATCH_SIZE) {
    const batchItems = toSeed.slice(batchStart, batchStart + BATCH_SIZE);
    const firestoreBatch = db.batch();

    batchCount++;
    console.log(
      `[seed-pyqs] Processing batch ${batchCount} ` +
        `(items ${batchStart + 1}–${batchStart + batchItems.length})...`
    );

    for (let i = 0; i < batchItems.length; i++) {
      const q = batchItems[i];
      const docId = deriveDocId(q);

      let embedding: number[];
      try {
        embedding = await withRetry(() => generateEmbedding(buildEmbedText(q)));
      } catch (err) {
        console.error(
          `[seed-pyqs]   ERROR generating embedding for doc ${docId} (all retries exhausted):`,
          err
        );
        skippedCount++;
        continue;
      }

      const docData = {
        question: q.question,
        subject: q.subject,
        class: q.class,
        year: q.year ?? null,
        chapter: q.chapter,
        topic: q.topic,
        marks: q.marks,
        type: q.type,
        board: q.board,
        ...(q.answer !== undefined && { answer: q.answer }),
        ...(q.frequency !== undefined && { frequency: q.frequency }),
        ...(q.section !== undefined && { section: q.section }),
        embedding: FieldValue.vector(embedding),
        seededAt: new Date().toISOString(),
      };

      firestoreBatch.set(collectionRef.doc(docId), docData);
      writtenCount++;

      if (i % 10 === 9) {
        console.log(
          `[seed-pyqs]   Embedded ${i + 1}/${batchItems.length} in batch ${batchCount}`
        );
      }

      // Rate-limit: small pause between embedding calls
      if (i < batchItems.length - 1) {
        await sleep(EMBED_DELAY_MS);
      }
    }

    await firestoreBatch.commit();
    console.log(`[seed-pyqs]   Batch ${batchCount} committed.`);
  }

  console.log('\n[seed-pyqs] Seeding complete.');
  console.log(`  Written : ${writtenCount}`);
  console.log(`  Skipped (embedding error): ${skippedCount}`);
  console.log(`  Already existed: ${existingIds.size}`);
}

main().catch((err) => {
  console.error('[seed-pyqs] Fatal error:', err);
  process.exit(1);
});
