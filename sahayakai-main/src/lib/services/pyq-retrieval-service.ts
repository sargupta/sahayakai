/**
 * PYQ Retrieval Service
 *
 * Provides semantic and filter-based retrieval of Past Year Questions (PYQs)
 * stored in the `pyq_questions` Firestore collection.
 *
 * Vector search uses Firestore's `findNearest` (Firebase Admin SDK v12+).
 * Embeddings are generated via Vertex AI text-embedding-004 REST API using
 * the service account credentials already present in firebase-admin.
 */

import { getDb, initializeFirebase } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION = 'pyq_questions';
const GCP_PROJECT = 'sahayakai-b4248';
// text-embedding-004 is only available in us-central1 as of 2026-03
const VERTEX_LOCATION = 'us-central1';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PYQQuestion {
  id: string;
  question: string;
  subject: 'mathematics' | 'science';
  class: 9 | 10;
  year: number | null;
  chapter: string;
  topic: string;
  marks: number;
  type: 'MCQ' | 'VSA' | 'SA' | 'LA' | 'case_study';
  board: string;
  answer?: string;
  frequency?: 'high' | 'medium' | 'low';
  section?: string; // 'Physics' | 'Chemistry' | 'Biology' for science
}

export interface PYQRetrievalOptions {
  subject: 'mathematics' | 'science';
  class: 9 | 10;
  chapter?: string;
  marks?: number;
  type?: string;
  limit?: number;
}

// Legacy alias so existing callers compiled against the stub still typecheck
export type RetrievePYQsOptions = PYQRetrievalOptions;

// ─── Embedding Generation ─────────────────────────────────────────────────────

/**
 * Generates a 768-dimensional embedding for the given text using
 * Vertex AI text-embedding-004 via REST API, authenticated with the
 * service account credential that firebase-admin was initialised with.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Ensure firebase-admin (and its credential) is initialised before accessing app()
  await initializeFirebase();

  const app = admin.app();
  const credential = app.options.credential as admin.credential.Credential;
  let tokenResult: { access_token: string; expires_in?: number };
  try {
    tokenResult = await credential.getAccessToken();
  } catch (err) {
    throw new Error(`Failed to acquire Vertex AI access token: ${String(err)}`);
  }

  const endpoint =
    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1` +
    `/projects/${GCP_PROJECT}/locations/${VERTEX_LOCATION}` +
    `/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${tokenResult.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ content: text }],
      parameters: { outputDimensionality: EMBEDDING_DIMENSION },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Vertex AI embedding request failed (${response.status}): ${body}`
    );
  }

  const json = (await response.json()) as {
    predictions: Array<{ embeddings: { values: number[] } }>;
  };

  const values = json.predictions?.[0]?.embeddings?.values;
  if (!values || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Unexpected embedding shape: got ${values?.length ?? 0} dims, ` +
        `expected ${EMBEDDING_DIMENSION}`
    );
  }

  return values;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function docToPYQ(id: string, data: FirebaseFirestore.DocumentData): PYQQuestion {
  return {
    id,
    question: data.question,
    subject: data.subject,
    class: data.class,
    year: data.year ?? null,
    chapter: data.chapter,
    topic: data.topic,
    marks: data.marks,
    type: data.type,
    board: data.board,
    answer: data.answer,
    frequency: data.frequency,
    section: data.section,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Semantic search: embeds `query`, runs Firestore vector search,
 * then post-filters by subject/class and optional chapter/marks/type.
 *
 * Firestore `findNearest` does not support additional `where` filters on the
 * same query, so hard filters are applied client-side after over-fetching.
 */
export async function retrievePYQs(
  query: string,
  options: PYQRetrievalOptions
): Promise<PYQQuestion[]> {
  const limit = options.limit ?? 10;
  // Over-fetch so post-filtering still returns enough results
  const fetchLimit = Math.min(limit * 5, 100);

  const db = await getDb();
  const collection = db.collection(COLLECTION);

  const queryEmbedding = await generateEmbedding(query);

  const vectorQuery = collection.findNearest({
    vectorField: 'embedding',
    queryVector: FieldValue.vector(queryEmbedding),
    limit: fetchLimit,
    distanceMeasure: 'COSINE',
  });

  const snapshot = await vectorQuery.get();

  const results: PYQQuestion[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.subject !== options.subject) continue;
    if (data.class !== options.class) continue;
    if (options.chapter && data.chapter !== options.chapter) continue;
    if (options.marks !== undefined && data.marks !== options.marks) continue;
    if (options.type && data.type !== options.type) continue;

    results.push(docToPYQ(doc.id, data));
    if (results.length >= limit) break;
  }

  if (results.length < limit) {
    console.warn(
      `[pyq-retrieval] retrievePYQs: returned ${results.length} < requested ${limit} ` +
        `— vector fetch cap (${fetchLimit}) may have filtered too aggressively`
    );
  }

  return results;
}

/**
 * Filter-based retrieval — no embedding needed.
 * Use when the caller already knows the exact chapter and wants a
 * representative set without a free-text semantic query.
 *
 * Results are ordered by frequency (high → medium → low) to surface
 * the most commonly tested questions first.
 */
export async function getPYQsByChapter(
  chapter: string,
  subject: string,
  classNum: number,
  limit = 20
): Promise<PYQQuestion[]> {
  const db = await getDb();

  // Fetch more than limit so we can sort by frequency correctly.
  // NOTE: orderBy('frequency') on a string enum is lexicographically wrong
  // ('medium' > 'low' > 'high'), so we sort client-side with a numeric rank.
  const snapshot = await db
    .collection(COLLECTION)
    .where('chapter', '==', chapter)
    .where('subject', '==', subject)
    .where('class', '==', classNum)
    .limit(limit * 3)
    .get();

  const freqRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = snapshot.docs
    .map((doc) => docToPYQ(doc.id, doc.data()))
    .sort((a, b) => {
      const ra = freqRank[a.frequency ?? ''] ?? 3;
      const rb = freqRank[b.frequency ?? ''] ?? 3;
      return ra - rb;
    });

  if (sorted.length < limit && snapshot.docs.length === limit * 3) {
    console.warn(
      `[pyq-retrieval] getPYQsByChapter: returned ${sorted.length} < requested ${limit} ` +
        `after sorting — fetch cap may have been hit`
    );
  }

  return sorted.slice(0, limit);
}
