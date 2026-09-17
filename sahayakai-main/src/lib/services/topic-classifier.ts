/**
 * @fileOverview Topic classifier — tags PYQs with the first-class topic(s) they
 * test, using the chapter's authored topic menu (Phase 4).
 *
 * **Batched by chapter (one Gemini call per chapter):** questions in different
 * chapters have different topic menus, so the batch unit is a single chapter —
 * its numbered menu appears once, followed by a numbered list of that chapter's
 * questions; the model returns choices per question. This turns a ~1,960-call
 * per-question backfill into ~one-call-per-chapter (~52–86). `BATCH_SIZE` sits
 * above the largest current chapter (102 q) so every chapter is one call today;
 * the cap only splits a pathologically large future chapter (graceful, no
 * truncation). A completeness guard re-asks any question the model skips so a
 * doc is never silently left untagged.
 *
 * Two entry points, by batch shape:
 *   - `classifyQuestionTopicsBatch` — one chapter's questions share one menu
 *     (backfill of the existing corpus, `seed-pyqs.ts`). ~one call per chapter.
 *   - `classifyQuestionsMixed` — a mixed set spanning several chapters, each menu
 *     inlined per question (`ingest-pyq-pdfs.ts`: one call for a whole PDF paper).
 * Callers group/collect docs, then stamp `{ topicIds, topicClassVersion }`.
 *
 * Discipline (§5.1): the model only ever picks menu NUMBERS; code maps
 * number → topicId here (a hallucinated id would become a wrong exam tag).
 * Menu includes retained-inactive topics so a question about a since-removed
 * topic can still map to what it actually tested.
 */

import { z } from 'genkit';

/** Stamp written alongside `topicIds`. Bump when the topic seed materially
 *  improves so the backfill re-classifies only stale docs (F8). */
export const TOPIC_CLASS_VERSION = 'v1';

/** Classification model — env-configurable (mirrors GENKIT_DEFAULT_MODEL in
 *  genkit.ts) so ops can swap without a code change. Default stays Flash; set
 *  TOPIC_CLASS_MODEL=googleai/gemini-flash-lite-latest to run on the 500-RPD
 *  Flash-Lite key (accuracy deferred, see PLAN-pyq-syllabus-change.md §16). */
const TOPIC_CLASS_MODEL = process.env.TOPIC_CLASS_MODEL || 'googleai/gemini-2.5-flash';

/** Questions per model call. Default 150 > the corpus's largest chapter (102),
 *  so every current chapter is exactly one call; the cap only splits a future
 *  outlier chapter rather than risking output truncation / dropped answers. */
const BATCH_SIZE = Math.max(1, Number(process.env.TOPIC_CLASS_BATCH_SIZE ?? 150));

/** Questions per call for the MIXED-menu ingest path (one PDF paper ≈ ≤40 q →
 *  one call). The cap only splits a pathologically large paper. */
const INGEST_BATCH_SIZE = Math.max(1, Number(process.env.INGEST_TOPIC_BATCH_SIZE ?? 60));

/** Menu entry shape returned by `getTopicMenu` — kept local so the pure mapper
 *  can be unit-tested without importing the (heavy) taxonomy module. */
type MenuEntry = { topicId: string; title: string; isActive: boolean };

const BatchClassifySchema = z.object({
  results: z
    .array(
      z.object({
        q: z.number().int().describe('The 1-based question number from the list, echoed back.'),
        choices: z
          .array(z.number().int())
          .describe('Menu numbers (1-based) of EVERY topic this question tests. Empty [] if none fit.'),
      }),
    )
    .describe('EXACTLY one entry per question in the list (any order).'),
});

// Lazily defined + cached so importing this module stays cold-start cheap
// (the Genkit instance is only built when a classification actually runs).
let _prompt: ReturnType<typeof defineBatchPrompt> | null = null;
function defineBatchPrompt(ai: typeof import('@/ai/genkit')['ai']) {
  return ai.definePrompt({
    name: 'classifyQuestionTopicsBatchPrompt',
    input: { schema: z.object({ menu: z.string(), questions: z.string() }) },
    output: { schema: BatchClassifySchema },
    config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 8192 },
    prompt: `You are tagging exam questions with the topic(s) each tests.

Below is a NUMBERED topic menu for ONE chapter, then a NUMBERED list of questions.
For EACH question, choose EVERY menu number whose topic it tests — a question may
test more than one. Return one result per question: its question number \`q\` and the
chosen menu numbers. If none of the topics fit a question, return \`choices: []\`.
Return a result for EVERY question number; do not skip any.

Topic menu:
{{menu}}

Questions:
{{questions}}
`,
  });
}

/**
 * Map 1-based menu choice numbers to topicIds — pure, no model, no I/O.
 * Drops out-of-range (hallucinated) numbers and dedupes. Empty in → empty out.
 */
export function mapChoicesToTopicIds(choices: number[], menu: MenuEntry[]): string[] {
  const ids = new Set<string>();
  for (const n of choices) {
    if (Number.isInteger(n) && n >= 1 && n <= menu.length) ids.add(menu[n - 1].topicId);
  }
  return [...ids];
}

/**
 * Reconcile a model batch response against the questions asked — pure, no I/O.
 * `byNum` maps 1-based question position → chosen menu numbers (only for the
 * questions the model actually returned). Returns the mapped topicIds per id and
 * the positions the model OMITTED (the completeness gap the caller must retry).
 */
export function reconcileBatch(
  chunk: { id: string }[],
  byNum: Map<number, number[]>,
  menu: MenuEntry[],
): { mapped: Map<string, string[]>; missingIdx: number[] } {
  const mapped = new Map<string, string[]>();
  const missingIdx: number[] = [];
  chunk.forEach((q, i) => {
    const choices = byNum.get(i + 1);
    if (choices === undefined) missingIdx.push(i);
    else mapped.set(q.id, mapChoicesToTopicIds(choices, menu));
  });
  return { mapped, missingIdx };
}

/**
 * Like `reconcileBatch`, but each question has its OWN menu (the mixed-menu ingest
 * path) — pure, no I/O. Maps each returned `q` through `chunk[q-1].menu`.
 */
export function mapMixedResults(
  chunk: { id: string; menu: MenuEntry[] }[],
  byNum: Map<number, number[]>,
): { mapped: Map<string, string[]>; missingIdx: number[] } {
  const mapped = new Map<string, string[]>();
  const missingIdx: number[] = [];
  chunk.forEach((item, i) => {
    const choices = byNum.get(i + 1);
    if (choices === undefined) missingIdx.push(i);
    else mapped.set(item.id, mapChoicesToTopicIds(choices, item.menu));
  });
  return { mapped, missingIdx };
}

/** One model call for a list of questions sharing `numberedMenu`. Returns a map
 *  of 1-based question index → chosen menu numbers (only for questions the model
 *  actually returned). */
async function runBatchOnce(
  questions: { question: string }[],
  numberedMenu: string,
): Promise<Map<number, number[]>> {
  const { ai, runResiliently } = await import('@/ai/genkit');
  if (!_prompt) _prompt = defineBatchPrompt(ai);
  const prompt = _prompt;

  const numbered = questions.map((q, i) => `(${i + 1}) ${q.question}`).join('\n\n');
  const { output } = await runResiliently(
    (o) =>
      prompt(
        { menu: numberedMenu, questions: numbered },
        { model: TOPIC_CLASS_MODEL, config: { ...o.config } },
      ),
    'topic.classify.batch',
  );

  const byNum = new Map<number, number[]>();
  for (const r of output?.results ?? []) {
    if (Number.isInteger(r.q)) byNum.set(r.q, Array.isArray(r.choices) ? r.choices : []);
  }
  return byNum;
}

/**
 * Classify a whole chapter's questions in one call (chunked at BATCH_SIZE).
 *
 * Returns a map from question `id` → `{ topicIds, topicClassVersion }`. A chapter
 * with no authored topics maps every id to `{ topicIds: [] }` WITHOUT a model call.
 *
 * Completeness guard: any question the model omits is re-asked once as its own
 * sub-batch; anything still missing is marked `topicIds: []` and logged — a doc is
 * never silently left untagged.
 */
export async function classifyQuestionTopicsBatch(input: {
  chapterId: string;
  questions: { id: string; question: string }[];
}): Promise<Map<string, { topicIds: string[]; topicClassVersion: string }>> {
  const out = new Map<string, { topicIds: string[]; topicClassVersion: string }>();
  const stamp = (id: string, topicIds: string[]) => out.set(id, { topicIds, topicClassVersion: TOPIC_CLASS_VERSION });

  if (input.questions.length === 0) return out;

  const { getTopicMenu } = await import('@/ai/data/ncert-chapters');
  const menu = getTopicMenu(input.chapterId);
  if (menu.length === 0) {
    for (const q of input.questions) stamp(q.id, []);
    return out;
  }

  const numberedMenu = menu.map((t, i) => `(${i + 1}) ${t.title}`).join('  ');

  for (let start = 0; start < input.questions.length; start += BATCH_SIZE) {
    const chunk = input.questions.slice(start, start + BATCH_SIZE);
    const byNum = await runBatchOnce(chunk, numberedMenu);
    const { mapped, missingIdx } = reconcileBatch(chunk, byNum, menu);
    for (const [id, ids] of mapped) stamp(id, ids);
    const missing = missingIdx.map((i) => chunk[i]);

    // Completeness retry — only when the model understood the format (returned
    // some, not all): re-ask just the omitted questions once. If the whole batch
    // came back empty, a retry would likely fail the same way — mark [] instead.
    let stillMissing = 0;
    if (missing.length > 0 && missing.length < chunk.length) {
      let retryByNum = new Map<number, number[]>();
      try {
        retryByNum = await runBatchOnce(missing, numberedMenu);
      } catch {
        // leave retry empty → all missing fall through to []
      }
      const retry = reconcileBatch(missing, retryByNum, menu);
      for (const [id, ids] of retry.mapped) stamp(id, ids);
      for (const i of retry.missingIdx) stamp(missing[i].id, []);
      stillMissing = retry.missingIdx.length;
    } else {
      stillMissing = missing.length;
      for (const q of missing) stamp(q.id, []);
    }

    if (stillMissing > 0) {
      console.warn(`[topic-classifier] ${input.chapterId}: ${stillMissing} question(s) not returned by the model → topicIds:[] (unmapped).`);
    }
  }

  return out;
}

// ─── Mixed-menu path (PDF ingest: one call for a whole paper) ────────────────
// A paper's questions span several chapters, each with its own menu, so a single
// call can't share one menu — each question carries its own menu inline.

let _mixedPrompt: ReturnType<typeof defineMixedPrompt> | null = null;
function defineMixedPrompt(ai: typeof import('@/ai/genkit')['ai']) {
  return ai.definePrompt({
    name: 'classifyQuestionsMixedPrompt',
    input: { schema: z.object({ block: z.string() }) },
    output: { schema: BatchClassifySchema },
    config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 8192 },
    prompt: `You are tagging exam questions with the topic(s) each tests.

Below is a NUMBERED list of questions. Each question has its OWN topic menu listed
directly under it. For EACH question, choose EVERY menu number (from THAT question's
own menu) whose topic it tests — a question may test more than one. Return one result
per question: its number \`q\` and the chosen menu numbers, relative to that question's
own menu. If none fit, return \`choices: []\`. Return a result for EVERY question.

{{block}}
`,
  });
}

/** One mixed-menu call: each entry renders its question + its own numbered menu.
 *  Returns 1-based question index → chosen menu numbers (per that question's menu). */
async function runMixedOnce(chunk: { question: string; menu: MenuEntry[] }[]): Promise<Map<number, number[]>> {
  const { ai, runResiliently } = await import('@/ai/genkit');
  if (!_mixedPrompt) _mixedPrompt = defineMixedPrompt(ai);
  const prompt = _mixedPrompt;

  const block = chunk
    .map((item, i) => {
      const menu = item.menu.map((t, j) => `(${j + 1}) ${t.title}`).join('  ');
      return `(${i + 1}) ${item.question}\n    topics: ${menu}`;
    })
    .join('\n\n');

  const { output } = await runResiliently(
    (o) => prompt({ block }, { model: TOPIC_CLASS_MODEL, config: { ...o.config } }),
    'topic.classify.mixed',
  );

  const byNum = new Map<number, number[]>();
  for (const r of output?.results ?? []) {
    if (Number.isInteger(r.q)) byNum.set(r.q, Array.isArray(r.choices) ? r.choices : []);
  }
  return byNum;
}

/**
 * Classify a mixed set of questions (spanning several chapters) in ONE call — the
 * PDF-ingest path. Each question carries its own chapter's menu inline. Questions
 * whose chapter has no authored topics map to `topicIds: []` without a model call.
 * Same completeness guard as the per-chapter path. Chunked at INGEST_BATCH_SIZE so
 * a normal paper (≤~40 q) is exactly one call.
 */
export async function classifyQuestionsMixed(
  questions: { id: string; chapterId: string; question: string }[],
): Promise<Map<string, { topicIds: string[]; topicClassVersion: string }>> {
  const out = new Map<string, { topicIds: string[]; topicClassVersion: string }>();
  const stamp = (id: string, topicIds: string[]) => out.set(id, { topicIds, topicClassVersion: TOPIC_CLASS_VERSION });
  if (questions.length === 0) return out;

  const { getTopicMenu } = await import('@/ai/data/ncert-chapters');
  const menuCache = new Map<string, MenuEntry[]>();
  const menuFor = (chapterId: string) => {
    let m = menuCache.get(chapterId);
    if (!m) menuCache.set(chapterId, (m = getTopicMenu(chapterId)));
    return m;
  };

  // Questions whose chapter has no menu → [] directly; the rest carry their menu.
  const toModel: { id: string; question: string; menu: MenuEntry[] }[] = [];
  for (const q of questions) {
    const menu = menuFor(q.chapterId);
    if (menu.length === 0) stamp(q.id, []);
    else toModel.push({ id: q.id, question: q.question, menu });
  }

  for (let start = 0; start < toModel.length; start += INGEST_BATCH_SIZE) {
    const chunk = toModel.slice(start, start + INGEST_BATCH_SIZE);
    const byNum = await runMixedOnce(chunk);
    const { mapped, missingIdx } = mapMixedResults(chunk, byNum);
    for (const [id, ids] of mapped) stamp(id, ids);
    const missing = missingIdx.map((i) => chunk[i]);

    let stillMissing = 0;
    if (missing.length > 0 && missing.length < chunk.length) {
      let retryByNum = new Map<number, number[]>();
      try {
        retryByNum = await runMixedOnce(missing);
      } catch {
        // leave empty → all missing fall through to []
      }
      const retry = mapMixedResults(missing, retryByNum);
      for (const [id, ids] of retry.mapped) stamp(id, ids);
      for (const i of retry.missingIdx) stamp(missing[i].id, []);
      stillMissing = retry.missingIdx.length;
    } else {
      stillMissing = missing.length;
      for (const q of missing) stamp(q.id, []);
    }

    if (stillMissing > 0) {
      console.warn(`[topic-classifier] mixed: ${stillMissing} question(s) not returned by the model → topicIds:[] (unmapped).`);
    }
  }

  return out;
}
