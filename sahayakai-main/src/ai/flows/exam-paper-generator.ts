/**
 * @fileOverview Generates board-pattern exam papers following official blueprints.
 *
 * - generateExamPaper - Generates a complete exam paper with sections, questions, answer keys, and marking schemes.
 * - ExamPaperInput - The input type for the generateExamPaper function.
 * - ExamPaperOutput - The return type for the generateExamPaper function.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import { findBlueprint, type SectionBlueprint } from '@/ai/data/board-blueprints';
import type { PYQQuestion } from '@/lib/services/pyq-retrieval-service';
import { validateChapterForFlow, type ValidationWarning } from '@/lib/ncert/validate-chapter';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { normalizeLanguage } from '@/ai/lib/normalize-language';
import type { Language } from '@/types/index';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const ExamPaperInputSchema = z.object({
  board: z.string().max(100).describe("The education board (e.g., 'CBSE', 'ICSE')."),
  gradeLevel: z.string().max(50).describe("The grade level (e.g., 'Class 10')."),
  subject: z.string().max(100).describe("The subject (e.g., 'Mathematics')."),
  chapters: z.array(z.string().max(300)).max(50).describe("Selected chapters to cover. Empty array means cover all chapters for the subject."),
  // M9: unbounded numbers reached the prompt/marks-scale math verbatim (e.g.
  // maxMarks: 5000000 driving the reconcile retry loop). Caps are generous
  // multiples of the widest real blueprint (180min/80marks) — real callers
  // never approach them; only abuse does.
  duration: z.number().min(1).max(360).optional().describe("Exam duration in minutes (1-360). Defaults to blueprint value."),
  maxMarks: z.number().int().positive().max(300).optional().describe("Maximum marks (up to 300). Defaults to blueprint value."),
  language: z.string().max(50).default('English').describe("Language for the paper (e.g., 'English', 'Hindi')."),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'mixed']).default('mixed').describe("Overall difficulty distribution."),
  pyqRatio: z.number().min(0).max(100).optional().describe(
    "Target % (0-100) of questions sourced from previous-year papers (PYQ) vs " +
    "freshly-invented ('New'). The generated paper's actual PYQ share lands " +
    "within ±5 percentage points of this target. Omit for the default mix " +
    "(~70% PYQ-oriented, floors only: at least 50% PYQ, at least 20% New, no ceiling)."
  ),
  includeAnswerKey: z.boolean().default(true).describe("Whether to generate answer keys."),
  includeMarkingScheme: z.boolean().default(true).describe("Whether to generate marking schemes."),
  userId: z.string().optional().describe("The ID of the user generating the paper."),
  teacherContext: z.string().optional().describe('Career-stage context for personalising AI output tone and depth.'),
});
export type ExamPaperInput = z.infer<typeof ExamPaperInputSchema>;

const ExamPaperQuestionSchema = z.object({
  number: z.number().describe("Question number within the section."),
  // Moved up from last field (2026-07-17): structured JSON generation is
  // sequential, so a field emitted AFTER the question text is just a
  // post-hoc label disconnected from what was actually written — verified:
  // two aggregate-count prompt instructions ("hit N New questions") both
  // failed identically because the tag came last. Emitting `source` right
  // after `number` forces the model to COMMIT to New-vs-PYQ before writing
  // content, so the content that follows is conditioned on that commitment
  // — the same reasoning that made `correctOption` required below.
  source: z.string().describe("Source tag for THIS question, per the QUESTION-BY-QUESTION ASSIGNMENT above: 'PYQ <year> <set>' using the set shown in that PYQ's bracket if it has one (e.g. 'PYQ 2023 Set 1' or 'PYQ 2023 30/1/1'), else 'PYQ <year>' (adapted from the PYQ list), or 'New' (originally invented). Decide this BEFORE writing the question text below."),
  text: z.string().describe("The question text."),
  marks: z.number().int().min(0).describe("Marks allocated to this question."),
  options: z.array(z.string()).optional().describe("For MCQs: exactly 4 options labelled (a), (b), (c), (d)."),
  // Required (2026-07-14): promoted from .optional() so Gemini's constrained
  // generation is FORCED to emit it for every question — the answer key for MCQs
  // is stamped from this in code (stampObjectiveKeys), avoiding the flaky backfill
  // re-prompt. Optional fields get silently dropped under the thinkingBudget cap
  // (the 2026-07-14 trace showed 36/36 correctOptions missing); required fields
  // (text/marks/number) never are. Non-objective questions return an empty string.
  correctOption: z.string().describe("For MCQ/objective questions: the correct option's letter (a/b/c/d), matching the (a)/(b)/(c)/(d) options above. For non-objective questions (short/long answer, case study) that have no options, return an empty string."),
  internalChoice: z.string().optional().describe("An OR alternative question, if applicable."),
  answerKey: z.string().optional().describe("The correct answer or model answer."),
  markingScheme: z.string().optional().describe("Step-wise marks breakdown for evaluation."),
});

const ExamPaperSectionSchema = z.object({
  name: z.string().describe("Section identifier (e.g., 'Section A')."),
  label: z.string().describe("Section description (e.g., 'Multiple Choice Questions')."),
  totalMarks: z.number().describe("Total marks for this section."),
  questions: z.array(ExamPaperQuestionSchema),
});

const ExamPaperOutputSchema = z.object({
  title: z.string().describe("Full paper title (e.g., 'CBSE Class 10 Mathematics Sample Paper')."),
  board: z.string(),
  subject: z.string(),
  gradeLevel: z.string(),
  duration: z.string().describe("Duration as a display string (e.g., '3 Hours')."),
  maxMarks: z.number(),
  generalInstructions: z.array(z.string()),
  sections: z.array(ExamPaperSectionSchema).min(1),
  // blueprintSummary and its nested arrays are display-only metadata. Gemini
  // routinely omits one or both nested arrays (or the whole object) when the
  // paper itself is well-formed. Making these `.optional()` with `.default()`
  // safe-fills means a missing summary no longer 500s the whole generation —
  // the core `sections`/`questions` payload (the thing the teacher actually
  // needs) still validates strictly.
  blueprintSummary: z.object({
    chapterWise: z.array(z.object({ chapter: z.string(), marks: z.number() })).optional().default([]),
    difficultyWise: z.array(z.object({ level: z.string(), percentage: z.number() })).optional().default([]),
  }).optional().default({ chapterWise: [], difficultyWise: [] }),
  pyqSources: z.array(z.object({
    id: z.string(),
    year: z.number().optional(),
    chapter: z.string().optional(),
    set: z.string().optional(),
  })).optional().describe("PYQ source attributions: which prior-year questions were used or adapted."),
  validationWarnings: z.array(z.object({
    invalid: z.boolean(),
    lenient: z.boolean(),
    message: z.string(),
    autoCorrectTo: z.object({ id: z.string(), number: z.number(), title: z.string() }).optional(),
    input: z.object({ gradeLevel: z.string(), subject: z.string(), chapter: z.string() }),
  })).optional().describe('Per-chapter NCERT validation warnings. Generation still proceeds; UI surfaces these so the teacher can correct or confirm the chapter list.'),
  // Marks-reconcile report (2026-07-09, Phase 1). This schema doubles as the
  // prompt's output schema, so the model sees this field — the describe()
  // forbids generating it and the flow strips any fabricated value before
  // reconciling.
  marksReconciliation: z.object({
    expected: z.number().describe('Effective maxMarks (input → blueprint → model output).'),
    actual: z.number().describe('Final sum of question.marks across all sections.'),
    repaired: z.boolean().describe('True when the bounded re-prompt fixed the drift.'),
    attempts: z.number().describe('Model attempts consumed (2 = repair retry ran).'),
  }).optional().describe('System-populated marks-drift report; present only when the first attempt drifted. Do NOT generate this field.'),
  // Answer-key/marking-scheme completeness report (2026-07-10, Phase 2). Like
  // marksReconciliation this schema doubles as the prompt's output schema, so
  // the describe() forbids the model from generating it and the flow strips any
  // fabricated value before running the completeness guard.
  answerKeyCompleteness: z.object({
    requestedAnswerKey: z.boolean().describe('Whether includeAnswerKey was on.'),
    requestedMarkingScheme: z.boolean().describe('Whether includeMarkingScheme was on.'),
    missingBefore: z.number().describe('Questions missing a requested field before backfill.'),
    filledByStamp: z.number().describe('Objective (MCQ) fields filled deterministically from correctOption.'),
    filledByReprompt: z.number().describe('Missing fields filled by the targeted backfill re-prompt.'),
    filledByPlaceholder: z.number().describe('Missing fields filled by the deterministic floor (review signal).'),
    // M11: WHY filledByPlaceholder > 0 — one of 'backfill-disabled',
    // 'time-budget-exceeded', 'model-call-ceiling-reached', 'reprompt-threw',
    // 'model-omitted-items'. Absent when filledByPlaceholder === 0.
    placeholderReason: z.string().optional().describe('Reason placeholders were needed, when filledByPlaceholder > 0. Do NOT generate this field.'),
  }).optional().describe('System-populated completeness report; present only when a requested field was missing. Do NOT generate this field.'),
  // "New"-novelty report (C7, forensic EPG-2026-07-17). ~1/4 of "New"-tagged
  // questions were actually reworded/number-swapped PYQs. Like the two reports
  // above this schema doubles as the prompt's output schema, so the describe()
  // forbids the model from generating it and the flow strips any fabricated
  // value before running the novelty check.
  newVerification: z.object({
    checked: z.number().describe('Questions tagged "New" that were inspected.'),
    relabeled: z.number().describe('"New" questions found to duplicate a retrieved PYQ and relabeled to PYQ.'),
  }).optional().describe('System-populated novelty report; present only when a "New" question matched a retrieved PYQ. Do NOT generate this field.'),
  // System-populated Firestore doc id (2026-07-16, H3 — see
  // tasks/SOLUTIONS-exam-pipeline.md). Minted up front (`contentId` below) and
  // stripped/re-set the same strip-then-set way as marksReconciliation, so the
  // model can never fabricate it. Lets the API route return the SAME id the
  // flow already persisted under, so Save upserts instead of writing a
  // duplicate library row.
  contentId: z.string().optional().describe('System-populated; do NOT generate'),
});
export type ExamPaperOutput = z.infer<typeof ExamPaperOutputSchema>;

const DISPATCHER_BUDGET_MS = Number(process.env.EXAM_PAPER_GENKIT_TIMEOUT_MS) || 75_000;

// Marks/key-repair budget. Phase 1 (2026-07-13): collapsed the old dead-zone.
// Originally this was 40s, which — combined with the `> dispatcher` clause below
// — left a gap at (40s, 75s] where a drifting/incomplete paper got NO repair and
// silently fell to the placeholder floor. Capping `thinkingBudget` lands most
// papers at ~45-55s, squarely in that gap, so the cap and this budget MUST move
// together. Setting it equal to the dispatcher budget makes shouldAttemptMarksRepair
// always-true: every drifting/incomplete paper repairs. Post-Phase-0 a repair that
// pushes past 75s is an honest 202 ("generating" in My Library), not a broken error,
// so the old "protect an on-time 200" rationale no longer applies. Only papers that
// actually drift/miss pay the extra call — clean papers skip it.
const MARKS_REPAIR_BUDGET_MS = DISPATCHER_BUDGET_MS;

export function shouldAttemptMarksRepair(elapsedMs: number): boolean {
  return elapsedMs <= MARKS_REPAIR_BUDGET_MS || elapsedMs > DISPATCHER_BUDGET_MS;
}

// Language templates for the deterministic MCQ stamp (below) and the
// completeness placeholder floor (~915). Both fabricate paper CONTENT — not
// t()-wrapped UI chrome, so they sit outside the 11-language i18n gate — but
// the content itself must still respect the paper's own language lock
// (CLAUDE.md invariant #4): an English "5 mark(s) for..." sentence stamped
// into an otherwise-Hindi paper is a language leak (H1, 2026-07-16 — see
// tasks/SOLUTIONS-exam-pipeline.md Cluster 4). All 11 languages now carry
// native translations of these three short sentences. English + Hindi are
// verified; the other 9 (2026-07-16) are machine-authored and marked below for
// a native-speaker sanity pass before wide classroom use — but they no longer
// leak English into a non-English paper, which was the actual defect.
const ENGLISH_EXAM_PAPER_TEMPLATE = {
  mcqOptionMark: (marks: number, letter: string) =>
    `${marks} mark(s) for selecting the correct option (${letter}).`,
  placeholderAnswer: 'Answer to be reviewed.',
  placeholderMarkingScheme: (marks: number) => `${marks} mark(s) for a complete and correct answer.`,
};
// ponytail: the 9 non-English/Hindi entries below are machine translations —
// correct and script-native, pending a light native-speaker review (H1).
const EXAM_PAPER_MARKING_TEMPLATES: Record<Language, typeof ENGLISH_EXAM_PAPER_TEMPLATE> = {
  English: ENGLISH_EXAM_PAPER_TEMPLATE,
  Hindi: {
    mcqOptionMark: (marks, letter) => `सही विकल्प (${letter}) चुनने के लिए ${marks} अंक।`,
    placeholderAnswer: 'उत्तर की समीक्षा की जानी है।',
    placeholderMarkingScheme: (marks) => `पूर्ण और सही उत्तर के लिए ${marks} अंक।`,
  },
  Kannada: {
    mcqOptionMark: (marks, letter) => `ಸರಿಯಾದ ಆಯ್ಕೆಯನ್ನು (${letter}) ಆರಿಸಿದ್ದಕ್ಕೆ ${marks} ಅಂಕ.`,
    placeholderAnswer: 'ಉತ್ತರವನ್ನು ಪರಿಶೀಲಿಸಬೇಕಾಗಿದೆ.',
    placeholderMarkingScheme: (marks) => `ಸಂಪೂರ್ಣ ಮತ್ತು ಸರಿಯಾದ ಉತ್ತರಕ್ಕೆ ${marks} ಅಂಕ.`,
  },
  Tamil: {
    mcqOptionMark: (marks, letter) => `சரியான விருப்பத்தை (${letter}) தேர்ந்தெடுத்ததற்கு ${marks} மதிப்பெண்.`,
    placeholderAnswer: 'பதில் மதிப்பாய்வு செய்யப்பட வேண்டும்.',
    placeholderMarkingScheme: (marks) => `முழுமையான மற்றும் சரியான பதிலுக்கு ${marks} மதிப்பெண்.`,
  },
  Telugu: {
    mcqOptionMark: (marks, letter) => `సరైన ఎంపికను (${letter}) ఎంచుకున్నందుకు ${marks} మార్కు(లు).`,
    placeholderAnswer: 'సమాధానం సమీక్షించవలసి ఉంది.',
    placeholderMarkingScheme: (marks) => `పూర్తి మరియు సరైన సమాధానానికి ${marks} మార్కు(లు).`,
  },
  Marathi: {
    mcqOptionMark: (marks, letter) => `योग्य पर्याय (${letter}) निवडल्याबद्दल ${marks} गुण.`,
    placeholderAnswer: 'उत्तराचे पुनरावलोकन करणे बाकी आहे.',
    placeholderMarkingScheme: (marks) => `संपूर्ण आणि अचूक उत्तरासाठी ${marks} गुण.`,
  },
  Bengali: {
    mcqOptionMark: (marks, letter) => `সঠিক বিকল্প (${letter}) নির্বাচন করার জন্য ${marks} নম্বর।`,
    placeholderAnswer: 'উত্তরটি পর্যালোচনা করা হবে।',
    placeholderMarkingScheme: (marks) => `সম্পূর্ণ এবং সঠিক উত্তরের জন্য ${marks} নম্বর।`,
  },
  Gujarati: {
    mcqOptionMark: (marks, letter) => `સાચો વિકલ્પ (${letter}) પસંદ કરવા બદલ ${marks} ગુણ.`,
    placeholderAnswer: 'જવાબની સમીક્ષા કરવાની બાકી છે.',
    placeholderMarkingScheme: (marks) => `સંપૂર્ણ અને સાચા જવાબ માટે ${marks} ગુણ.`,
  },
  Punjabi: {
    mcqOptionMark: (marks, letter) => `ਸਹੀ ਵਿਕਲਪ (${letter}) ਚੁਣਨ ਲਈ ${marks} ਅੰਕ।`,
    placeholderAnswer: 'ਜਵਾਬ ਦੀ ਸਮੀਖਿਆ ਕੀਤੀ ਜਾਣੀ ਹੈ।',
    placeholderMarkingScheme: (marks) => `ਸੰਪੂਰਨ ਅਤੇ ਸਹੀ ਜਵਾਬ ਲਈ ${marks} ਅੰਕ।`,
  },
  Malayalam: {
    mcqOptionMark: (marks, letter) => `ശരിയായ ഓപ്ഷൻ (${letter}) തിരഞ്ഞെടുത്തതിന് ${marks} മാർക്ക്.`,
    placeholderAnswer: 'ഉത്തരം അവലോകനം ചെയ്യേണ്ടതുണ്ട്.',
    placeholderMarkingScheme: (marks) => `പൂർണ്ണവും ശരിയായതുമായ ഉത്തരത്തിന് ${marks} മാർക്ക്.`,
  },
  Odia: {
    mcqOptionMark: (marks, letter) => `ସଠିକ୍ ବିକଳ୍ପ (${letter}) ବାଛିବା ପାଇଁ ${marks} ନମ୍ବର।`,
    placeholderAnswer: 'ଉତ୍ତର ସମୀକ୍ଷା କରାଯିବ।',
    placeholderMarkingScheme: (marks) => `ସମ୍ପୂର୍ଣ୍ଣ ଏବଂ ସଠିକ୍ ଉତ୍ତର ପାଇଁ ${marks} ନମ୍ବର।`,
  },
};
const _warnedUnmappedExamPaperLanguages = new Set<string>();

/**
 * Resolve the marking-scheme/placeholder templates for a normalized language.
 * Falls back to English + a one-time WARN for anything not a known `Language`
 * (defensive — callers should already run `normalizeLanguage` first).
 */
export function getExamPaperTemplates(language?: string) {
  if (language && (language in EXAM_PAPER_MARKING_TEMPLATES)) {
    return EXAM_PAPER_MARKING_TEMPLATES[language as Language];
  }
  if (language && !_warnedUnmappedExamPaperLanguages.has(language)) {
    _warnedUnmappedExamPaperLanguages.add(language);
    StructuredLogger.warn('Unmapped exam-paper template language — falling back to English', {
      service: 'exam-paper-generator-flow',
      operation: 'getExamPaperTemplates',
      metadata: { language },
    });
  }
  return ENGLISH_EXAM_PAPER_TEMPLATE;
}

// Phase 2 (2026-07-13): deterministic answer-key stamping for objective (MCQ)
// questions. The model marks the correct option via `correctOption`; we stamp the
// answerKey (and a trivial marking scheme) in code so MCQ keys are correct BY
// CONSTRUCTION — no reliance on the backfill re-prompt (which never even sees the
// options and was unreliable). Only fills EMPTY requested fields (never overwrites
// a model-provided key). Mutates in place; returns the count of fields filled.
type StampableQuestion = {
  options?: string[];
  correctOption?: string;
  answerKey?: string;
  markingScheme?: string;
  marks: number;
};
export function stampObjectiveKeys(
  paper: { sections: { questions: StampableQuestion[] }[] },
  input: { includeAnswerKey: boolean; includeMarkingScheme: boolean },
  language?: string,
): number {
  const LETTERS = ['a', 'b', 'c', 'd'];
  const templates = getExamPaperTemplates(language);
  let filled = 0;
  for (const section of paper.sections) {
    for (const q of section.questions) {
      // Gate on options: correctOption is now required (may be '' or a stray
      // marker on a subjective question), so only stamp genuine MCQs that carry
      // options — never fabricate an answer key for a short/long-answer question.
      if (!q.options || q.options.length === 0) continue;
      const letter = q.correctOption?.trim().toLowerCase().match(/[a-d]/)?.[0];
      if (!letter) continue; // no marker → not an objective MCQ we can stamp
      // Options may already carry an "(a) " / "b) " / "b. " label — strip it so we
      // don't double up when re-prefixing with the canonical form.
      const optionText = q.options?.[LETTERS.indexOf(letter)]
        ?.replace(/^\s*(?:\([a-dA-D]\)|[a-dA-D][.)])\s*/, '')
        .trim();

      if (input.includeAnswerKey && !q.answerKey?.trim()) {
        q.answerKey = optionText ? `(${letter}) ${optionText}` : `(${letter})`;
        filled++;
      }
      if (input.includeMarkingScheme && !q.markingScheme?.trim()) {
        q.markingScheme = templates.mcqOptionMark(q.marks, letter);
        filled++;
      }
    }
  }
  return filled;
}

// Testability seam (M2, 2026-07-16): the completeness guard below calls
// stampObjectiveKeys through this live object reference so a test can force a
// stamp failure via jest.spyOn — same-module function calls bypass jest.mock/
// spyOn on the direct named export (the internal call site keeps its own
// reference to the function, not the exports object), so a plain exported
// function can't be faked from a same-file caller. Proves the placeholder
// floor still runs and the invariant holds even when stamping throws.
export const examPaperStamping = { stampObjectiveKeys };

// Thinking-budget cap (Phase 1, 2026-07-13). gemini-2.5-flash is a *thinking*
// model and ran it unbounded — the trace showed ~71% of cost + 92% of latency is
// reasoning tokens in the main call. The 2026-07-13 sweep confirmed a 1024-token
// cap cuts thinking ~20-30× (14k-26k → ~885) and latency ~3× (150-352s → ~50s)
// with no quality regression, so 1024 is the default. `EXAM_PAPER_THINKING_BUDGET`
// overrides it: a number (incl. 0 = thinking off) → that cap; `off`/`unbounded`/
// empty → no cap (pre-Phase-1 behavior). Env-tunable like GENKIT_DEFAULT_MODEL /
// EXAM_PAPER_GENKIT_TIMEOUT_MS. Applied to the MAIN prompt only (the reconcile-retry
// reuses it); the backfill prompt stays uncapped — it's the answer-correctness path.
const DEFAULT_THINKING_BUDGET = 1024;
const _rawThinkingBudget = process.env.EXAM_PAPER_THINKING_BUDGET;
let _thinkingBudget: number | undefined;
if (_rawThinkingBudget === undefined) {
  _thinkingBudget = DEFAULT_THINKING_BUDGET;
} else if (
  _rawThinkingBudget === '' ||
  _rawThinkingBudget.toLowerCase() === 'off' ||
  _rawThinkingBudget.toLowerCase() === 'unbounded'
) {
  _thinkingBudget = undefined; // explicit opt-out → unbounded thinking
} else {
  const n = Number(_rawThinkingBudget);
  _thinkingBudget = Number.isNaN(n) ? DEFAULT_THINKING_BUDGET : n;
}
const THINKING_CONFIG =
  _thinkingBudget !== undefined
    ? { thinkingConfig: { thinkingBudget: _thinkingBudget } }
    : {};

// ── Degeneration guards (Phase 1, 2026-07-16 — see tasks/FIX-exam-paper-large-paper-degeneration.md).
// The generate call had NO output bound (thinkingBudget caps *reasoning* only), so a
// repetition loop (observed: thousands of `\n` in a question's text) ran to the model's
// ~65k ceiling (~4-min hang) and truncated the JSON before a required field → hard schema
// failure. And at temperature 0.2 the loop is REPRODUCIBLE for a given input, so a plain
// re-roll reproduces it. Three coordinated guards: (1) an output ceiling, (2) a stop-sequence
// that halts a newline runaway fast, (3) a temperature bump on retry so the re-roll escapes
// the deterministic loop instead of repeating it.

// (1) Output ceiling. Paper size is blueprint-fixed (~38 Q → ~10k output tokens) regardless
// of chapter count, so 24000 is generous headroom for a legit paper + answer keys and a hard
// backstop for a non-newline runaway. Env-tunable (number → cap; off/unbounded/empty → none).
const DEFAULT_MAX_OUTPUT_TOKENS = 24000;
const _rawMaxOutput = process.env.EXAM_PAPER_MAX_OUTPUT_TOKENS;
let _maxOutputTokens: number | undefined;
if (_rawMaxOutput === undefined) {
  _maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
} else if (
  _rawMaxOutput === '' ||
  _rawMaxOutput.toLowerCase() === 'off' ||
  _rawMaxOutput.toLowerCase() === 'unbounded'
) {
  _maxOutputTokens = undefined; // explicit opt-out → unbounded output (pre-Phase-1 behavior)
} else {
  const n = Number(_rawMaxOutput);
  _maxOutputTokens = Number.isNaN(n) ? DEFAULT_MAX_OUTPUT_TOKENS : n;
}

// (2) Halt a runaway newline loop fast. Valid JSON output never contains 6 consecutive RAW
// newlines (in-string newlines are escaped `\n`; structure uses at most 1-2), so this only
// fires on the degenerate case — turning a ~2-min cap-fill into an immediate stop.
const RUNAWAY_STOP = ['\n\n\n\n\n\n'];

const GENERATE_CONFIG = {
  stopSequences: RUNAWAY_STOP,
  ...(_maxOutputTokens !== undefined ? { maxOutputTokens: _maxOutputTokens } : {}),
};

// (3) Bounded generation retry WITH perturbation. A degenerate/truncated generation used to
// hard-fail the paper (runResiliently only retries 429/401/403). Re-roll up to this many
// attempts; each retry raises temperature (retryTemperature) so a reproducible low-temp loop
// is broken rather than repeated. Default 3 (base + two perturbed re-rolls); env-tunable.
const MAX_GEN_ATTEMPTS = Math.max(1, Number(process.env.EXAM_PAPER_MAX_GEN_ATTEMPTS ?? 3));

// C2 (forensic EPG-2026-07-17): hard ceiling on LOGICAL model calls per request.
// shouldAttemptMarksRepair is a deliberate always-true no-op (see its comment),
// so nothing else caps how many prompts one "Generate" click can chain: up to
// MAX_GEN_ATTEMPTS generation re-rolls + one call per repair pass (ratio, marks,
// key backfill). Default 6 = 3 gen + 3 repairs — enough for the worst legitimate
// path, a firebreak against a future 4th repair pass or a loop.
// ponytail: caps LOGICAL calls only; runResiliently's quota/auth key-rotation
// multiplier (up to 5×) is deliberate failover and lives in review-gated
// genkit.ts — out of scope here.
const MAX_MODEL_CALLS = Math.max(1, Number(process.env.EXAM_PAPER_MAX_MODEL_CALLS ?? 6));

// Base temperature. The reproducible `\n` loop exists because 0.2 is near-deterministic — the same
// input always walks into the same spiral (a 64-PYQ run looped on the SAME question as the 118-PYQ
// run, proving input size isn't the trigger). 0.4 samples off the stuck path so attempt 1 is clean;
// the marks-reconcile + completeness guards still enforce structure downstream. Env-tunable.
const BASE_TEMPERATURE = Number(process.env.EXAM_PAPER_BASE_TEMPERATURE ?? 0.4);

// Temperature for attempt N (1-based): attempt 1 uses BASE_TEMPERATURE; retries climb toward more
// diverse sampling to break out of any residual stuck loop. Capped at 0.9.
function retryTemperature(attempt: number): number {
  return Math.min(0.9, BASE_TEMPERATURE + 0.25 * (attempt - 1));
}

// Quota-wall fallback model. When the strong model's daily quota is exhausted, retry ONCE on this
// (Gemini 3.1 Flash Lite, ~500/day) instead of hard-failing — a degraded-but-working paper. The
// Phase-1 guards protect the weaker model too, and the marks/completeness guards run afterward
// regardless of model, so invariants hold. Empty string = disabled (revert to hard-fail). Env-tunable.
const QUOTA_FALLBACK_MODEL = (process.env.EXAM_PAPER_QUOTA_FALLBACK_MODEL ?? 'googleai/gemini-3.1-flash-lite').trim();

// PYQ context budget. PYQ_TOTAL is a HARD CAP on the number of PYQs handed to the model as
// context — distributed across chapters by blueprint weightage and shaped per chapter by
// section/marks weightage in the retrieval block below (450, not a per-chapter limit). NOTE: the
// large input is NOT the degeneration trigger (a 64-PYQ run looped the same way a 118-PYQ run did;
// the trigger was low-temperature determinism, fixed via BASE_TEMPERATURE above) — this cap is
// about relevance + prompt size, not correctness. Env-tunable.
const PYQ_TOTAL = Math.max(1, Number(process.env.EXAM_PAPER_PYQ_TOTAL ?? 450));

/** Distribute `total` integer slots across `weights` proportionally, summing to EXACTLY `total`
 *  via the largest-remainder method (floor each, then hand leftover slots to the largest
 *  fractional parts). Callers pass positive weights, so every chapter gets its proportional share
 *  and the budgets can't overshoot the PYQ cap. Pure. */
function allocateBudget(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (total * w) / sum);
  const budgets = exact.map((x) => Math.floor(x));
  let remaining = total - budgets.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byFrac) {
    if (remaining <= 0) break;
    budgets[i]++;
    remaining--;
  }
  return budgets;
}

// Which generate-call throws are worth re-rolling: the degeneration signature — a
// truncated/malformed constrained-output parse (Genkit throws INVALID_ARGUMENT /
// "Schema validation failed" / "required property"). NOT quota exhaustion (the key pool
// is already spent, so another roll is pointless) and NOT other typed errors.
function isRetryableGenerationFailure(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AIQuotaExhaustedError') return false;
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 'INVALID_ARGUMENT') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /schema validation|required property|invalid_argument|max.?output.?tokens/i.test(msg);
}

export async function generateExamPaper(input: ExamPaperInput): Promise<ExamPaperOutput> {
  const uid = input.userId;
  let localizedInput = { ...input };

  if (uid) {
    // Only fall back to the teacher's profile preferredLanguage when the
    // AI-output language is truly omitted. An explicit selection (including
    // 'English') is the user's deliberate choice and must be respected — do
    // NOT treat 'English' as "unset" (mirrors lesson-plan-generator.ts).
    if (input.language === undefined || input.language === null) {
      const { dbAdapter } = await import('@/lib/db/adapter');
      const profile = await dbAdapter.getUser(uid);
      if (profile?.preferredLanguage) {
        localizedInput.language = profile.preferredLanguage;
      }
    }

    // Fetch teacher context for AI personalisation
    try {
      const { getTeacherContextLine } = await import('@/lib/teacher-context');
      localizedInput.teacherContext = await getTeacherContextLine(uid);
    } catch {
      // Non-blocking — proceed without teacher context
    }
  }

  return examPaperGeneratorFlow(localizedInput);
}

/**
 * Build a structured constraint block from the blueprint for the AI prompt.
 */
async function buildBlueprintConstraint(input: ExamPaperInput): Promise<string> {
  const blueprint = await findBlueprint(input.board, input.gradeLevel, input.subject);

  if (!blueprint) {
    return `No official blueprint found for ${input.board} ${input.gradeLevel} ${input.subject}. Generate a reasonable exam paper with the given maxMarks and duration. Create 4-5 sections with MCQ, short answer, long answer, and case study question types.`;
  }

  const duration = input.duration || blueprint.duration;
  const maxMarks = input.maxMarks ?? blueprint.maxMarks;

  // H9 (forensic EPG-2026-07-17): when a caller requests a custom maxMarks that
  // differs from the blueprint total, the prompt used to state the new total but
  // still list the blueprint's ORIGINAL per-section marks (summing to the
  // blueprint total) — a guaranteed contradiction that forced a marks-repair
  // call every time. Scale the section marks by the same factor so the section
  // block is consistent with the requested total. Per-row scaling is
  // subsection-safe (every row scales by the same factor, so a parent/child
  // relationship is preserved); the exact grand total is still enforced by the
  // marks-reconcile guard downstream. The equal-maxMarks path is unchanged.
  const marksScale = blueprint.maxMarks ? maxMarks / blueprint.maxMarks : 1;
  const rescaled = Math.abs(marksScale - 1) > 1e-9;

  let constraint = `## HARD CONSTRAINT: Official ${blueprint.board} ${blueprint.gradeLevel} ${blueprint.subject} Blueprint\n`;
  constraint += `- Duration: ${duration} minutes\n`;
  constraint += `- Maximum Marks: ${maxMarks}\n\n`;

  constraint += `### General Instructions (include these verbatim):\n`;
  blueprint.generalInstructions.forEach((inst, i) => {
    constraint += `${i + 1}. ${inst}\n`;
  });

  constraint += `\n### Section Structure (MUST follow exactly):\n`;
  if (rescaled) {
    constraint += `NOTE: Your requested Maximum Marks (${maxMarks}) differs from the official blueprint total (${blueprint.maxMarks}). The per-section marks below are the blueprint's proportions SCALED to your requested total. Keep the section structure, question counts, and question types; distribute marks within each section so it hits its target and the WHOLE paper totals EXACTLY ${maxMarks}.\n`;
  }
  blueprint.sections.forEach((section, i) => {
    if (rescaled) {
      const target = Math.max(1, Math.round(section.totalMarks * marksScale));
      constraint += `${i + 1}. **${section.name} — ${section.label}**: ${section.questionCount} questions, target ≈ ${target} marks (blueprint: ${section.totalMarks}) | Type: ${section.questionType.type} | Internal Choice: ${section.questionType.internalChoice ? 'Yes (provide OR alternative)' : 'No'}\n`;
    } else {
      constraint += `${i + 1}. **${section.name} — ${section.label}**: ${section.questionCount} questions x ${section.questionType.marksPerQuestion} marks = ${section.totalMarks} marks | Type: ${section.questionType.type} | Internal Choice: ${section.questionType.internalChoice ? 'Yes (provide OR alternative)' : 'No'}\n`;
    }
  });

  if (blueprint.chapterWeightage) {
    const selectedChapters = input.chapters;
    const relevantWeightage = Object.entries(blueprint.chapterWeightage)
      .filter(([ch]) => selectedChapters.some(sc => sc.toLowerCase() === ch.toLowerCase()));

    if (relevantWeightage.length > 0) {
      constraint += `\n### Chapter Weightage (distribute questions proportionally):\n`;
      relevantWeightage.forEach(([ch, marks]) => {
        constraint += `- ${ch}: ~${marks} marks\n`;
      });
    }
  }

  return constraint;
}

/**
 * A question is "past-year" iff its source tag begins with "PYQ" (any case).
 * Single source of truth — the mix count, the ratio-band retry check, the
 * C1 mix-regression guard and the C7 novelty relabel all route through this
 * instead of re-writing the `/^pyq/i` regex (previously duplicated 3×).
 */
function isPyqSource(q: { source: string }): boolean {
  return /^pyq/i.test(q.source);
}

/**
 * Strip board/id noise from the model's PYQ source tag (e.g. "PYQ 2023 (CBSE)
 * | CBSE_mathematics_c10_11572e4c") down to the bare "PYQ <year>[ <set>]" /
 * "PYQ N/A" tag rule 10 asks for, so the UI badge never leaks internal ids or
 * board labels. Mutates every question's `source` field in place.
 *
 * The set capture is intentionally permissive (anything up to the next "("
 * or "|"), not just "Set N" — the corpus's `set` values include CBSE series
 * codes like "30/1/1" that aren't shaped like "Set N" (2026-07-19: this used
 * to be `(\s+Set\s*\d+)?`, which silently dropped every non-"Set N" set,
 * i.e. most of the current Class 10 Maths corpus).
 */
export function sanitizePyqSourceTags(output: ExamPaperOutput): void {
  const PYQ_SOURCE_RE = /^PYQ\s+(\d{4}|N\/A)([^(|]*)/i;
  for (const section of output.sections) {
    for (const q of section.questions) {
      if (isPyqSource(q)) {
        const m = q.source.match(PYQ_SOURCE_RE);
        const set = m?.[2]?.trim();
        q.source = m ? `PYQ ${m[1]}${set ? ' ' + set : ''}` : 'PYQ';
      }
    }
  }
}

// C7 (forensic EPG-2026-07-17): a hand-check found ~1/4 of "New"-tagged
// questions were actually retrieved PYQs, reworded or with the numbers swapped.
// A match at or above this Jaccard overlap (after normalizing to digit-stripped
// word tokens) means the "New" tag is a lie.
const NEW_DUP_THRESHOLD = 0.8;

// Normalize to a bag of word tokens: lowercase, DROP DIGITS (so a
// number-swapped duplicate collapses to identical tokens), strip punctuation
// but keep letters of any script (\p{L}) so non-English papers normalize too.
function normalizeForNovelty(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[0-9]+/g, ' ')
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * C7: flag "New"-tagged questions that are really a retrieved PYQ reworded or
 * number-swapped. Mutates each proven duplicate's `source` in place to the
 * matched PYQ's tag (so the mix reconcile downstream counts it honestly) and
 * returns a count report. Pure + deterministic (no model call), so it runs on
 * every paper.
 *
 * ponytail: token-Jaccard on digit-stripped text — catches reword/number-swap
 * dupes, misses heavy paraphrase; upgrade to embeddings only if the corpus
 * grows a real paraphrase problem (no embedding pipeline exists today).
 */
export function verifyNewQuestions(
  questions: { text: string; source: string }[],
  pyqs: { question: string; year?: number | null }[],
): { checked: number; relabeled: number } {
  const pyqTokens = pyqs.map(p => ({ tokens: normalizeForNovelty(p.question), year: p.year }));
  let checked = 0;
  let relabeled = 0;
  for (const q of questions) {
    if (isPyqSource(q)) continue; // only inspect non-PYQ ("New") tags
    checked++;
    let best = { score: 0, year: null as number | null | undefined };
    const qTokens = normalizeForNovelty(q.text);
    for (const p of pyqTokens) {
      const score = jaccard(qTokens, p.tokens);
      if (score > best.score) best = { score, year: p.year };
    }
    if (best.score >= NEW_DUP_THRESHOLD) {
      q.source = best.year ? `PYQ ${best.year}` : 'PYQ';
      relabeled++;
    }
  }
  return { checked, relabeled };
}

/**
 * C7 pass (M2 extraction, forensic EPG-2026-07-17): relabel "New"-tagged
 * questions that duplicate a retrieved PYQ and record the report. Pulled out of
 * the flow body so it's a named, independently-testable step. Mutates `parsed`
 * in place; non-blocking (any throw is logged and swallowed).
 *
 * Feature flag: examPaperNewVerification (default ON).
 */
async function verifyNewQuestionsPass(
  parsed: ExamPaperOutput,
  retrievedPYQs: PYQQuestion[],
  userId: string | undefined,
  requestId: string,
): Promise<void> {
  delete parsed.newVerification; // strip any model-fabricated value
  try {
    if (retrievedPYQs.length > 0) {
      const verifyFlag = await isFeatureEnabled('examPaperNewVerification', userId ?? 'system');
      if (verifyFlag.enabled) {
        const allQuestions = parsed.sections.flatMap(s => s.questions);
        const report = verifyNewQuestions(allQuestions, retrievedPYQs);
        if (report.relabeled > 0) {
          parsed.newVerification = report;
          StructuredLogger.warn('"New" questions relabeled as duplicate PYQs', {
            service: 'exam-paper-generator-flow',
            operation: 'verifyNewQuestions',
            userId,
            requestId,
            metadata: report,
          });
        }
      }
    }
  } catch (verifyError: unknown) {
    StructuredLogger.warn('New-question novelty check threw (non-blocking)', {
      service: 'exam-paper-generator-flow',
      operation: 'verifyNewQuestions',
      userId,
      requestId,
      metadata: { error: String(verifyError) },
    });
  }
}

/**
 * Shared context for the extracted repair passes (M2). Bundles the flow-closure
 * state each pass reads so they can live at module scope as named, independently
 * reviewable steps. The mutable per-request model-call budget is threaded
 * separately (passed in, returned out) so each pass can gate + increment it.
 */
type RepairCtx = {
  input: ExamPaperInput;
  blueprintConstraint: string;
  pyqContext: string;
  language: string;
  requestId: string;
  startTime: number;
  retrievedPYQs: PYQQuestion[];
};

/**
 * Pass 1 (M2 extraction, forensic EPG-2026-07-17): enforce the PYQ/New mix band
 * via one bounded repair re-prompt (full regen, adopt if now in band). Runs
 * before the marks reconcile so a regenerated paper still gets its marks
 * checked. Non-blocking: keeps the first attempt if the retry doesn't fix it.
 * Returns the (possibly replaced) paper and the updated model-call count.
 * Feature flag: examPaperPyqRatioRepair.
 */
async function reconcilePyqRatio(
  parsed: ExamPaperOutput,
  modelCalls: number,
  ctx: RepairCtx,
): Promise<{ parsed: ExamPaperOutput; modelCalls: number }> {
  const { input, blueprintConstraint, pyqContext, language, requestId, startTime } = ctx;
  try {
    if (pyqContext) {
      const questions = parsed.sections.flatMap(s => s.questions);
      const pyqCount = questions.filter(isPyqSource).length;
      const newCount = questions.length - pyqCount;
      const { minNew, minPyq, maxPyq } = computePyqMixFloor(questions.length, input.pyqRatio);
      // Mutually exclusive (pyqCount + newCount === questions.length): either the paper
      // fell short of the floor (today's only direction) or, only reachable with an
      // explicit pyqRatio + ceiling, it overshot the target's upper bound.
      const pyqBelowMin = questions.length > 1 && (newCount < minNew || pyqCount < minPyq);
      const pyqAboveMax = questions.length > 1 && pyqCount > maxPyq;
      const outOfBand = pyqBelowMin || pyqAboveMax;

      if (outOfBand) {
        StructuredLogger.warn('Exam paper PYQ/new mix out of required band', {
          service: 'exam-paper-generator-flow',
          operation: 'reconcilePyqRatio',
          userId: input.userId,
          requestId,
          metadata: { pyqCount, newCount, minPyq, minNew, maxPyq, total: questions.length, direction: pyqAboveMax ? 'aboveMax' : 'belowMin' },
        });

        try {
          const repairFlag = await isFeatureEnabled('examPaperPyqRatioRepair', input.userId ?? 'system');
          const elapsedMs = Date.now() - startTime;
          if (repairFlag.enabled && shouldAttemptMarksRepair(elapsedMs) && modelCalls < MAX_MODEL_CALLS) {
            const repairConstraint = blueprintConstraint + (
              pyqAboveMax
                ? `\n\n## CRITICAL CORRECTION — SECOND ATTEMPT\n` +
                  `Your previous paper had ${pyqCount} "PYQ <year>" question(s) out of ${questions.length} total — ` +
                  `MORE than the target allows (no more than ${maxPyq} PYQ-adapted, at least ${minNew} New). ` +
                  `Regenerate with FEWER PYQ-adapted questions and MORE freshly-invented "New" questions so the count falls within range.`
                : `\n\n## CRITICAL CORRECTION — SECOND ATTEMPT\n` +
                  `Your previous paper had only ${newCount} "New" question(s) and ${pyqCount} "PYQ <year>" question(s) out of ${questions.length} total — ` +
                  `short of the required minimum (at least ${minNew} New, at least ${minPyq} PYQ-adapted). ` +
                  `Regenerate the full paper so BOTH minimums are met this time. Count your own tags before finishing.`
            );

            modelCalls++; // C2: PYQ-ratio repair re-prompt
            const { output: retryOutput } = await runResiliently(async (resilienceConfig) => {
              return await examPaperGeneratorPrompt(
                { ...input, blueprintConstraint: repairConstraint, pyqContext, language },
                resilienceConfig
              );
            }, 'examPaper.pyqRatioRetry');

            const retryParsed = ExamPaperOutputSchema.parse(retryOutput);
            sanitizePyqSourceTags(retryParsed);
            const retryQuestions = retryParsed.sections.flatMap(s => s.questions);
            const retryPyqCount = retryQuestions.filter(isPyqSource).length;
            const retryNewCount = retryQuestions.length - retryPyqCount;
            const retryFloor = computePyqMixFloor(retryQuestions.length, input.pyqRatio);
            const retryFixed = retryQuestions.length > 0 &&
              retryNewCount >= retryFloor.minNew && retryPyqCount >= retryFloor.minPyq &&
              retryPyqCount <= retryFloor.maxPyq;

            if (retryFixed) {
              parsed = retryParsed;
              StructuredLogger.info('PYQ/new ratio repaired on retry', {
                service: 'exam-paper-generator-flow',
                operation: 'reconcilePyqRatio',
                userId: input.userId,
                requestId,
              });
            } else {
              StructuredLogger.warn('PYQ/new ratio drift persists after bounded repair', {
                service: 'exam-paper-generator-flow',
                operation: 'reconcilePyqRatio',
                userId: input.userId,
                requestId,
                metadata: { retryPyqCount, retryNewCount, retryTotal: retryQuestions.length },
              });
            }
          }
        } catch (repairError: unknown) {
          StructuredLogger.warn('PYQ ratio repair retry failed — keeping first attempt', {
            service: 'exam-paper-generator-flow',
            operation: 'reconcilePyqRatio',
            userId: input.userId,
            requestId,
            metadata: { error: String(repairError) },
          });
        }
      }
    }
  } catch (reconcileError: unknown) {
    StructuredLogger.warn('PYQ ratio reconcile threw (non-blocking)', {
      service: 'exam-paper-generator-flow',
      operation: 'reconcilePyqRatio',
      userId: input.userId,
      requestId,
      metadata: { error: String(reconcileError) },
    });
  }
  return { parsed, modelCalls };
}

/**
 * Pass 2 (M2 extraction, forensic EPG-2026-07-17): reconcile the marks total to
 * the effective maxMarks via one bounded repair re-prompt (full regen, adopt if
 * strictly closer to target AND the C1 mix guard passes — a regen must not
 * silently undo the PYQ/New mix Pass 1 fixed). Attaches the `marksReconciliation`
 * report, the H10 "not independently verified" warning, and normalizes display
 * totals. Non-blocking. Returns the (possibly replaced) paper + updated count.
 * Feature flag: examPaperMarksRepair.
 */
async function reconcileMarks(
  parsed: ExamPaperOutput,
  modelCalls: number,
  ctx: RepairCtx,
): Promise<{ parsed: ExamPaperOutput; modelCalls: number }> {
  const { input, blueprintConstraint, pyqContext, language, requestId, startTime, retrievedPYQs } = ctx;
  delete parsed.marksReconciliation; // strip model-fabricated values
  try {
    const { computeTotalMarks, computeSectionMarks } = await import('@/ai/data/exam-paper-marks');
    const blueprint = await findBlueprint(input.board, input.gradeLevel, input.subject);
    const effectiveMaxMarks = input.maxMarks ?? blueprint?.maxMarks ?? parsed.maxMarks;

    // H10 (forensic EPG-2026-07-17): the marks check is only as trustworthy
    // as `effectiveMaxMarks`. When it comes from a requested maxMarks or a
    // bundled blueprint it's an INDEPENDENT ground truth. But only 4
    // board/grade/subject combos ship a blueprint — for everything else,
    // with no requested maxMarks, `expected` falls back to the model's OWN
    // self-reported maxMarks, so the check is circular: it verifies internal
    // consistency (header == section sum) but can pass while the AI is
    // self-consistently wrong about the board's real total. Surface that so
    // an unverified pass isn't mistaken for an authoritative one. The real
    // fix is more blueprints (board-blueprints.ts data work — separate).
    const maxMarksVerified = input.maxMarks != null || !!blueprint;
    if (effectiveMaxMarks && !maxMarksVerified) {
      StructuredLogger.warn('Marks total not independently verified — no blueprint or requested maxMarks', {
        service: 'exam-paper-generator-flow',
        operation: 'reconcileMarks',
        userId: input.userId,
        requestId,
        metadata: { board: input.board, gradeLevel: input.gradeLevel, subject: input.subject, selfReportedMaxMarks: parsed.maxMarks },
      });
    }

    if (!effectiveMaxMarks) {
      StructuredLogger.warn('No effective maxMarks resolvable — skipping marks reconcile', {
        service: 'exam-paper-generator-flow',
        operation: 'reconcileMarks',
        userId: input.userId,
        requestId,
        metadata: { inputMaxMarks: input.maxMarks, outputMaxMarks: parsed.maxMarks },
      });
    } else {
      const firstTotal = computeTotalMarks(parsed.sections);
      let finalTotal = firstTotal;
      let attempts = 1;
      const drifted = firstTotal !== effectiveMaxMarks;

      // C1 (forensic EPG-2026-07-17): the marks repair below does a full
      // paper regen, which can silently undo the PYQ/New mix the ratio pass
      // just fixed. Only worth guarding when there was a PYQ pool to satisfy
      // a mix from; snapshot whether the pre-repair paper is in band so the
      // adoption test can refuse a regen that regresses it.
      const mixMattered = retrievedPYQs.length > 0;
      const preRepairMixInBand =
        mixMattered && pyqMixInBand(parsed.sections.flatMap(s => s.questions), input.pyqRatio);

      if (drifted) {
        StructuredLogger.warn('Exam paper marks drifted from effective maxMarks', {
          service: 'exam-paper-generator-flow',
          operation: 'reconcileMarks',
          userId: input.userId,
          requestId,
          metadata: { expected: effectiveMaxMarks, actual: firstTotal, delta: firstTotal - effectiveMaxMarks },
        });

        // Bounded repair: its own try/catch so a retry that throws or
        // fails Zod parse falls back to attempt 1 — never loses the paper.
        try {
          const repairFlag = await isFeatureEnabled('examPaperMarksRepair', input.userId ?? 'system');
          // Timing regimes documented at shouldAttemptMarksRepair above.
          const elapsedMs = Date.now() - startTime;
          if (repairFlag.enabled && shouldAttemptMarksRepair(elapsedMs) && modelCalls < MAX_MODEL_CALLS) {
            const repairConstraint = blueprintConstraint +
              `\n\n## CRITICAL CORRECTION — SECOND ATTEMPT\n` +
              `Your previous paper totaled ${firstTotal} marks, but the total MUST be exactly ${effectiveMaxMarks}. ` +
              `Regenerate the full paper so the sum of every question's marks across all sections equals exactly ${effectiveMaxMarks}, ` +
              `keeping the section structure and per-question marks defined in the blueprint above.`;

            attempts = 2;
            modelCalls++; // C2: marks repair re-prompt
            const { output: retryOutput } = await runResiliently(async (resilienceConfig) => {
              return await examPaperGeneratorPrompt(
                { ...input, blueprintConstraint: repairConstraint, pyqContext, language },
                resilienceConfig
              );
            }, 'examPaper.reconcileRetry');

            const retryParsed = ExamPaperOutputSchema.parse(retryOutput);
            delete retryParsed.marksReconciliation;
            sanitizePyqSourceTags(retryParsed);
            const retryTotal = computeTotalMarks(retryParsed.sections);

            // Keep the better attempt; ties keep attempt 1 (less churn —
            // PYQ attributions were already logged against it).
            const retryCloserOnMarks =
              Math.abs(retryTotal - effectiveMaxMarks) < Math.abs(firstTotal - effectiveMaxMarks);
            // C1: refuse a marks-closer regen that would newly breach a mix
            // band the pre-repair paper satisfied. Keeping attempt 1 (correct
            // mix, honest marks-drift reported below) beats silently shipping
            // a paper whose PYQ/New split the ratio pass had already fixed.
            const retryMixOk =
              !preRepairMixInBand ||
              pyqMixInBand(retryParsed.sections.flatMap(s => s.questions), input.pyqRatio);
            if (retryCloserOnMarks && retryMixOk) {
              parsed = retryParsed;
              finalTotal = retryTotal;
            } else if (retryCloserOnMarks && !retryMixOk) {
              StructuredLogger.warn('Marks-repair regen rejected — would regress PYQ/New mix; keeping first attempt', {
                service: 'exam-paper-generator-flow',
                operation: 'reconcileMarks',
                userId: input.userId,
                requestId,
                metadata: { firstTotal, retryTotal, expected: effectiveMaxMarks },
              });
            }
          }
        } catch (repairError: unknown) {
          StructuredLogger.warn('Marks repair retry failed — keeping first attempt', {
            service: 'exam-paper-generator-flow',
            operation: 'reconcileMarks',
            userId: input.userId,
            requestId,
            metadata: { error: String(repairError) },
          });
        }
      }

      // Normalize display totals from the authoritative numbers. Never
      // touch per-question marks: blueprints fix marksPerQuestion per
      // section and markingScheme strings encode the split, so mutating
      // marks would desynchronize both.
            parsed.maxMarks = effectiveMaxMarks;
      for (const section of parsed.sections) {
        section.totalMarks = computeSectionMarks(section);
        // Renumber questions sequentially to fix duplicate or out-of-sequence numbers
        renumberQuestionsInSection(section.questions);
      }

      if (drifted) {
        const repaired = finalTotal === effectiveMaxMarks;
        parsed.marksReconciliation = {
          expected: effectiveMaxMarks,
          actual: finalTotal,
          repaired,
          attempts,
        };
        if (repaired) {
          StructuredLogger.info('Marks drift repaired on retry', {
            service: 'exam-paper-generator-flow',
            operation: 'reconcileMarks',
            userId: input.userId,
            requestId,
            metadata: { expected: effectiveMaxMarks, attempts },
          });
        } else {
          StructuredLogger.warn('Marks drift persists after bounded repair', {
            service: 'exam-paper-generator-flow',
            operation: 'reconcileMarks',
            userId: input.userId,
            requestId,
            metadata: { expected: effectiveMaxMarks, actual: finalTotal, attempts },
          });
        }
      }
    }
  } catch (reconcileError: unknown) {
    StructuredLogger.warn('Marks reconcile threw (non-blocking)', {
      service: 'exam-paper-generator-flow',
      operation: 'reconcileMarks',
      userId: input.userId,
      requestId,
      metadata: { error: String(reconcileError) },
    });
  }
  return { parsed, modelCalls };
}

/**
 * Pass 3 (M2 extraction, forensic EPG-2026-07-17): guarantee every question has
 * the requested answerKey / markingScheme. Deterministic MCQ stamp → bounded
 * targeted backfill re-prompt (patches missing fields IN PLACE by index, never a
 * whole-paper regen) → unconditional language-templated placeholder floor
 * (invariant #2 backstop). Non-blocking. Returns the paper + updated count.
 * Feature flag: examPaperKeyBackfill.
 */
async function backfillAnswerKeys(
  parsed: ExamPaperOutput,
  modelCalls: number,
  ctx: RepairCtx,
): Promise<{ parsed: ExamPaperOutput; modelCalls: number }> {
  const { input, language, requestId, startTime } = ctx;
  delete parsed.answerKeyCompleteness; // strip model-fabricated value
  if (input.includeAnswerKey || input.includeMarkingScheme) {
    // M2 (2026-07-16): stamping gets its OWN try/catch, narrower than the
    // one that used to wrap this whole guard. Previously stamp/backfill/
    // floor shared one try — a throw during stamping was caught by the
    // OUTER catch below and skipped the placeholder floor entirely (empty
    // keys shipped, no `answerKeyCompleteness` report, looked "clean").
    // The floor is the invariant-#2 backstop and MUST always run; it can
    // no longer be short-circuited by a stamp failure now that stamping
    // is isolated here and defaults to 0 fills on throw.
    let filledByStamp = 0;
    try {
      filledByStamp = examPaperStamping.stampObjectiveKeys(parsed, input, language);
    } catch (stampError: unknown) {
      StructuredLogger.warn('Objective key stamping threw — continuing without deterministic stamps', {
        service: 'exam-paper-generator-flow',
        operation: 'keyCompleteness',
        userId: input.userId,
        requestId,
        metadata: { error: String(stampError) },
      });
    }

    try {
      // Flatten to a positional list. CBSE Math has two "Section A" blocks,
      // so (section, number) is not unique — the array index IS the key,
      // and we keep a live reference to each question object to mutate it.
      // Computed AFTER the stamping attempt above (whether it succeeded or
      // fell back to 0), so `missing` only reflects genuinely-subjective gaps.
      const flat = parsed.sections.flatMap(section =>
        section.questions.map(q => ({ q, number: q.number })),
      );

      const needAnswerKey = (q: { answerKey?: string }) =>
        input.includeAnswerKey && !q.answerKey?.trim();
      const needMarkingScheme = (q: { markingScheme?: string }) =>
        input.includeMarkingScheme && !q.markingScheme?.trim();

      const missing = flat
        .map((entry, idx) => ({ ...entry, idx }))
        .filter(({ q }) => needAnswerKey(q) || needMarkingScheme(q));

      let filledByReprompt = 0;
      let filledByPlaceholder = 0;
      // M11: WHY filledByPlaceholder > 0 — set below, surfaced in the log and
      // in answerKeyCompleteness so a caller sees more than a bare count.
      let placeholderReason: string | undefined;

      if (missing.length > 0) {
        StructuredLogger.warn('Exam paper missing requested answer keys / marking schemes', {
          service: 'exam-paper-generator-flow',
          operation: 'keyCompleteness',
          userId: input.userId,
          requestId,
          metadata: {
            missingCount: missing.length,
            questionNumbers: missing.map(m => m.number),
            includeAnswerKey: input.includeAnswerKey,
            includeMarkingScheme: input.includeMarkingScheme,
          },
        });

        // Bounded targeted re-prompt — own try/catch so a failure falls
        // through to the placeholder floor and never loses the paper.
        try {
          const backfillFlag = await isFeatureEnabled('examPaperKeyBackfill', input.userId ?? 'system');
          // Reuse the generic "can we afford another model call vs the 75s
          // dispatcher budget" gate from Phase 1.
          const elapsedMs = Date.now() - startTime;
          // M11: record WHY the gate didn't run, instead of only knowing THAT
          // placeholders were needed.
          if (!backfillFlag.enabled) {
            placeholderReason = 'backfill-disabled';
          } else if (!shouldAttemptMarksRepair(elapsedMs)) {
            placeholderReason = 'time-budget-exceeded';
          } else if (modelCalls >= MAX_MODEL_CALLS) {
            placeholderReason = 'model-call-ceiling-reached';
          } else {
            const items = missing.map(({ q, idx }) => ({
              idx,
              text: q.text,
              marks: q.marks,
              needAnswerKey: needAnswerKey(q),
              needMarkingScheme: needMarkingScheme(q),
            }));

            modelCalls++; // C2: answer-key backfill re-prompt
            const { output: backfillOutput } = await runResiliently(async (resilienceConfig) => {
              return await examPaperKeyBackfillPrompt(
                {
                  language,
                  subject: input.subject,
                  gradeLevel: input.gradeLevel,
                  includeAnswerKey: input.includeAnswerKey,
                  includeMarkingScheme: input.includeMarkingScheme,
                  items,
                },
                resilienceConfig,
              );
            }, 'examPaper.keyBackfill');

            // Merge by idx — fill only requested + still-empty fields so a
            // stray/hallucinated key can't overwrite good content.
            const byIdx = new Map(missing.map(m => [m.idx, m.q]));
            for (const returned of backfillOutput?.items ?? []) {
              const q = byIdx.get(returned.idx);
              if (!q) continue;
              if (needAnswerKey(q) && returned.answerKey?.trim()) {
                q.answerKey = returned.answerKey.trim();
                filledByReprompt++;
              }
              if (needMarkingScheme(q) && returned.markingScheme?.trim()) {
                q.markingScheme = returned.markingScheme.trim();
                filledByReprompt++;
              }
            }
          }
        } catch (backfillError: unknown) {
          placeholderReason = 'reprompt-threw';
          StructuredLogger.warn('Key backfill re-prompt failed — falling back to placeholder floor', {
            service: 'exam-paper-generator-flow',
            operation: 'keyCompleteness',
            userId: input.userId,
            requestId,
            metadata: { error: String(backfillError) },
          });
        }

        // Placeholder floor — always runs (no longer nested inside the
        // stamp try above), guarantees 100% non-empty. Paper CONTENT
        // (like the questions), not t() UI chrome, so it's outside the
        // 11-language i18n gate — but language-TEMPLATED via
        // getExamPaperTemplates() (H1) so it still matches the paper's
        // own language lock instead of a fixed English string. A rare
        // last resort: when the re-prompt works these never appear.
        const templates = getExamPaperTemplates(language);
        for (const { q } of missing) {
          if (needAnswerKey(q)) {
            q.answerKey = templates.placeholderAnswer;
            filledByPlaceholder++;
          }
          if (needMarkingScheme(q)) {
            q.markingScheme = templates.placeholderMarkingScheme(q.marks);
            filledByPlaceholder++;
          }
        }

        // M11: backfill ran (no gate/throw reason set above) but still left
        // items unfilled — the model omitted them from its response.
        if (filledByPlaceholder > 0 && !placeholderReason) placeholderReason = 'model-omitted-items';

        if (filledByPlaceholder > 0) {
          StructuredLogger.warn('Key completeness floor used placeholders (review needed)', {
            service: 'exam-paper-generator-flow',
            operation: 'keyCompleteness',
            userId: input.userId,
            requestId,
            metadata: { filledByReprompt, filledByPlaceholder, missingBefore: missing.length, placeholderReason },
          });
        } else {
          StructuredLogger.info('Key completeness fully repaired by backfill re-prompt', {
            service: 'exam-paper-generator-flow',
            operation: 'keyCompleteness',
            userId: input.userId,
            requestId,
            metadata: { filledByReprompt, missingBefore: missing.length },
          });
        }
      }

      // Report whenever stamping did work OR a gap surfaced (absent = clean run).
      if (filledByStamp > 0 || missing.length > 0) {
        parsed.answerKeyCompleteness = {
          requestedAnswerKey: input.includeAnswerKey,
          requestedMarkingScheme: input.includeMarkingScheme,
          missingBefore: missing.length,
          filledByStamp,
          filledByReprompt,
          filledByPlaceholder,
          // M11: omit rather than send `undefined` — matches the field's
          // `.optional()` contract and keeps the clean-run shape unchanged.
          ...(placeholderReason ? { placeholderReason } : {}),
        };
      }
    } catch (completenessError: unknown) {
      StructuredLogger.warn('Key completeness guard threw (non-blocking)', {
        service: 'exam-paper-generator-flow',
        operation: 'keyCompleteness',
        userId: input.userId,
        requestId,
        metadata: { error: String(completenessError) },
      });
    }
  }
  return { parsed, modelCalls };
}

// ± percentage points band around a teacher-supplied pyqRatio target.
const PYQ_RATIO_TOLERANCE_PP = 5;

/**
 * PYQ/New count bounds for a paper of `total` questions.
 *
 * No target (`targetPct` undefined) — today's exact behavior, unchanged:
 * hardcoded asymmetric floors under an implicit ~70% mix (20%/50%), no
 * ceiling (maxNew/maxPyq = total, i.e. unconstrained).
 *
 * Explicit target — symmetric ±5pp band on the paper-level PYQ share.
 * `Math.round` is monotonic and the same clamp is applied on both sides, so
 * `minPyq <= maxPyq` always holds arithmetically — no self-contradiction is
 * possible, no defensive collapse needed. At small `total` the achievable
 * integer PYQ counts may sit slightly outside the true percentage window —
 * inherent to integer rounding, not a bug.
 */
export function computePyqMixFloor(
  total: number,
  targetPct?: number,
): { minNew: number; minPyq: number; maxNew: number; maxPyq: number } {
  if (targetPct === undefined) {
    const minNew = Math.max(1, Math.round(total * 0.2));
    const minPyq = Math.max(1, Math.round(total * 0.5));
    return { minNew, minPyq, maxNew: total, maxPyq: total };
  }
  const lo = Math.max(0, targetPct - PYQ_RATIO_TOLERANCE_PP);
  const hi = Math.min(100, targetPct + PYQ_RATIO_TOLERANCE_PP);
  const minPyq = Math.round((lo / 100) * total);
  const maxPyq = Math.round((hi / 100) * total);
  return { minPyq, maxPyq, minNew: total - maxPyq, maxNew: total - minPyq };
}

/**
 * Per-section minimum "New" question count. A 1-question section can't be
 * split, so it's left unconstrained (0). Ceil + floor-of-1 so even a small
 * section (e.g. a 2-question case study) still gets a real quota — at a
 * high pyqRatio target this means a tiny section can't hit an exact ±5pp
 * band; accepted tradeoff for guaranteed variety, same as before this
 * became configurable.
 */
export function computeSectionMinNew(questionCount: number, targetPyqPct?: number): number {
  if (questionCount <= 1) return 0;
  const newFraction = targetPyqPct === undefined ? 0.3 : (100 - targetPyqPct) / 100;
  return Math.max(1, Math.ceil(questionCount * newFraction));
}

/**
 * Is a paper's PYQ/New split inside the band `computePyqMixFloor` asks for?
 * Same predicate the ratio reconcile uses (`pyqBelowMin || pyqAboveMax`),
 * extracted so the C1 marks-repair guard can reuse it: a full-paper marks
 * regen must not silently undo a mix the ratio pass (or the first attempt)
 * already satisfied.
 */
export function pyqMixInBand(questions: { source: string }[], targetPct?: number): boolean {
  if (questions.length <= 1) return true;
  const pyqCount = questions.filter(isPyqSource).length;
  const newCount = questions.length - pyqCount;
  const { minNew, minPyq, maxPyq } = computePyqMixFloor(questions.length, targetPct);
  return newCount >= minNew && pyqCount >= minPyq && pyqCount <= maxPyq;
}

/**
 * Deterministic per-slot New/PYQ role assignment for a section — replaces
 * asking the model to self-count a quota (verified unreliable even per
 * section: a run still landed at 3/38 New against a 7-8 minimum) with a
 * fill-in-the-blank checklist per question NUMBER. Evenly spaced (not
 * clustered) so the mix reads naturally across the section. `true` = New.
 */
function computeSectionMixPlan(questionCount: number, targetPyqPct?: number): boolean[] {
  const minNew = computeSectionMinNew(questionCount, targetPyqPct);
  const isNew = new Array(questionCount).fill(false);
  for (let i = 0; i < minNew; i++) {
    let idx = Math.round((i + 0.5) * questionCount / minNew) % questionCount;
    while (isNew[idx]) idx = (idx + 1) % questionCount; // dedupe on rounding collisions
    isNew[idx] = true;
  }
  return isNew;
}

/**
 * Renumber questions within a section to be sequential starting from 1.
 * Fixes duplicate or out-of-sequence question numbers.
 */
export function renumberQuestionsInSection(questions: { number: number }[]): void {
  for (let i = 0; i < questions.length; i++) {
    questions[i].number = i + 1;
  }
}

/**
 * Build the PYQ context block to inject into the AI prompt.
 * Returns an empty string when no PYQs are available so the prompt degrades
 * gracefully with no noise added.
 */
function buildPYQContext(pyqs: PYQQuestion[], sections?: SectionBlueprint[], targetPyqPct?: number): string {
  if (pyqs.length === 0) return '';

  const effectiveTarget = targetPyqPct ?? 70;
  let block = `## PREVIOUS YEAR QUESTIONS (use these as the basis for ~${effectiveTarget}% of questions — adapt, rephrase, or use directly):\n`;
  block += `Use these authentic board exam questions. Do NOT alter their factual or mathematical correctness.\n\n`;

  pyqs.forEach((q, i) => {
    const yearLabel = q.year ? `${q.year}` : 'Year N/A';
    const setLabel = q.set ? ` ${q.set}` : ''; // e.g. " Set 1" — lets the model tag "PYQ <year> <set>"
    const boardLabel = q.board ? ` (${q.board})` : '';
    block += `${i + 1}. [ID: ${q.id} | ${yearLabel}${setLabel}${boardLabel} | ${q.chapter} | ${q.marks} mark${q.marks !== 1 ? 's' : ''} | ${q.type}]\n`;
    block += `   Q: ${q.question}\n`;
    if (q.answer) {
      block += `   A: ${q.answer}\n`;
    }
    block += `\n`;
  });

  // Per-question-slot assignment, not a count to self-track (2026-07-17): a
  // tally ("Section C: at least 3 of 8 New") is still an aggregate the model
  // has to count against while generating 8 separate items — verified: a run
  // still landed at 3/38 New against a 7-8 minimum with that wording. This
  // pre-decides, in code, exactly WHICH question numbers are New vs
  // PYQ-adapted, so there's nothing left to count — just a per-item
  // checklist to follow, the same reason `correctOption` (also per-item) is
  // reliable while this aggregate wasn't. The model still freely CHOOSES
  // which specific PYQ to adapt for each PYQ-adapted slot (using the large
  // list above for real matches), and for each New slot it should use the
  // list above to learn the QUESTION PATTERN/STYLE, not to copy — reconcilePyqRatio
  // below still enforces the true paper-wide floor as a backstop.
  if (sections && sections.length > 0) {
    block += `## QUESTION-BY-QUESTION ASSIGNMENT (mandatory — follow every row exactly, in order):\n`;
    sections.forEach((section, i) => {
      const plan = computeSectionMixPlan(section.questionCount, targetPyqPct);
      const row = plan.map((isNew, qi) => `Q${qi + 1}: ${isNew ? 'New' : 'PYQ-adapted'}`).join(' | ');
      block += `${i + 1}. **${section.name} — ${section.label}** (${section.questionCount} questions): ${row}\n`;
    });
    block += `For each "PYQ-adapted" slot: set \`source\` to "PYQ <year>" FIRST, then adapt a real question from the list above matching that year (same chapter/marks where possible).\n`;
    block += `For each "New" slot: set \`source\` to "New" FIRST, then invent an entirely original question — use the list above to learn the PATTERN and STYLE of real exam questions, not to copy one.\n\n`;
  }

  return block;
}

const examPaperGeneratorPrompt = ai.definePrompt({
  name: 'examPaperGeneratorPrompt',
  input: { schema: ExamPaperInputSchema.extend({ blueprintConstraint: z.string(), pyqContext: z.string() }) },
  output: { schema: ExamPaperOutputSchema },
  // Low temperature (2026-07-10): the flow previously inherited Gemini's default
  // temperature of 1.0 (most random), which drove blueprint/marks drift — the
  // very thing the marksReconciliation repair path below has to catch. 0.2 keeps
  // paper structure, marks split, and format stable across runs while still
  // letting the model produce fresh questions each time (we deliberately do NOT
  // go to 0.0 — some question variety is desirable for an exam generator).
  config: { temperature: BASE_TEMPERATURE, topP: 0.8, ...THINKING_CONFIG, ...GENERATE_CONFIG },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}
{{#if teacherContext}}{{{teacherContext}}}{{/if}}

You are an expert exam paper setter for Indian board examinations. Generate a complete, print-ready exam paper that STRICTLY follows the official blueprint provided below.

{{{blueprintConstraint}}}

## Paper Requirements:
- **Board**: {{board}}
- **Grade**: {{gradeLevel}}
- **Subject**: {{subject}}
- **Chapters to cover**: {{#each chapters}}{{this}}, {{else}}the entire {{subject}} syllabus{{/each}}
- **Difficulty**: {{difficulty}}
- **Language**: {{language}}
- **Include Answer Key**: {{includeAnswerKey}}
- **Include Marking Scheme**: {{includeMarkingScheme}}

{{#if pyqContext}}{{{pyqContext}}}{{/if}}

## Question Generation Rules:
1. **MCQs & objective questions**: Generate exactly 4 options labelled (a), (b), (c), (d) with only one correct answer. \`correctOption\` is MANDATORY and non-negotiable — set it to the correct option's letter (e.g. 'b') for EVERY MCQ/objective question, since the answer key is derived directly from it. For non-objective questions (short/long answer, case study) that have no options, set \`correctOption\` to an empty string.
2. **Assertion-Reason**: Use the standard format — Assertion (A) and Reason (R) with 4 standard options.
3. **Internal Choice**: Where the blueprint says internal choice = true, provide an OR alternative question of equal difficulty and marks.
4. **Case Study**: Provide a real-world scenario/passage followed by sub-questions.
5. **Answer Keys**: If requested, provide concise correct answers for every question.
6. **Marking Scheme**: If requested, provide step-wise marks breakdown (e.g., "1 mark for formula, 1 mark for substitution, 1 mark for answer").
7. **Chapter Coverage**: Distribute questions across the selected chapters proportionally based on chapter weightage.
8. **Difficulty Distribution**: For 'mixed' difficulty, use approximately 30% easy, 40% moderate, 30% hard. For specific difficulty levels, weight 70% toward that level.
{{#if pyqContext}}9. **PYQ Usage**: Follow the QUESTION-BY-QUESTION ASSIGNMENT above exactly — it tells you, per question number, whether to adapt a real PYQ or invent a new one. Never alter the mathematical or factual correctness of any PYQ. The PYQ list above is also your reference for question PATTERNS and STYLE — every "New" question should read like an authentic board exam question, even though it isn't copied from the list.
10. **Source Tagging**: For a "PYQ-adapted" slot, set \`source\` to "PYQ <year> <set>" using the year and set shown in that PYQ's bracket (e.g., "PYQ 2023 Set 1"), or "PYQ <year>" if it has no set. For a "New" slot, set \`source\` to "New". Decide \`source\` BEFORE writing the question text, per the assignment.
11. **pyqSources**: In the pyqSources field, list every PYQ that was used or adapted: include its id, year, chapter, and set (if it has one) exactly as provided.
{{else}}9. **Source Tagging**: Tag all questions as "New" since no PYQ bank was available.
10. **pyqSources**: Leave pyqSources as an empty array.
{{/if}}

## Constraints:
- **Language Lock**: You MUST respond ONLY in {{language}}. Do NOT shift into other languages unless explicitly requested.
- **Blueprint Adherence**: The section structure, question counts, and marks distribution MUST match the blueprint exactly. Do NOT add or remove sections.
- **No Repetition Loop**: Monitor output for repetitive content. Break loops immediately.
- **Academic Rigor**: Questions must be at the appropriate academic level for {{gradeLevel}} {{subject}}.
- **Factual Integrity**: Do NOT fabricate facts, dates, or alter the correctness of any question — especially mathematical questions.

## blueprintSummary:
Generate a summary showing chapter-wise marks allocation and difficulty-wise percentage distribution based on the questions you created.
`,
});

// Phase 2 (2026-07-10): targeted answer-key / marking-scheme backfill. Fires
// only when the main generation left some requested field empty. Deliberately
// NOT a full paper regen — asking only for the missing keys keeps the marks
// total and question structure (Phase 1's invariant) intact and is cheaper.
// The model echoes back each question's positional `idx` so results merge
// unambiguously (CBSE Math has two "Section A" blocks, so section+number is
// not a unique key).
const KeyBackfillInputSchema = z.object({
  language: z.string().describe('Language lock for the produced keys.'),
  subject: z.string(),
  gradeLevel: z.string(),
  includeAnswerKey: z.boolean(),
  includeMarkingScheme: z.boolean(),
  items: z.array(z.object({
    idx: z.number().describe('Positional index of the question in the flattened paper. Echo this back verbatim.'),
    text: z.string().describe('The question text.'),
    marks: z.number().describe('Marks allocated to the question.'),
    needAnswerKey: z.boolean().describe('True when this question still needs an answerKey.'),
    needMarkingScheme: z.boolean().describe('True when this question still needs a markingScheme.'),
  })).describe('The questions still missing a requested field.'),
});

const KeyBackfillOutputSchema = z.object({
  items: z.array(z.object({
    idx: z.number().describe('The positional index echoed back from the input, verbatim.'),
    answerKey: z.string().optional().describe('Concise correct/model answer — only when the item needed one.'),
    markingScheme: z.string().optional().describe('Step-wise marks breakdown — only when the item needed one.'),
  })),
});

const examPaperKeyBackfillPrompt = ai.definePrompt({
  name: 'examPaperKeyBackfillPrompt',
  input: { schema: KeyBackfillInputSchema },
  output: { schema: KeyBackfillOutputSchema },
  config: { temperature: 0.2, topP: 0.8 },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}

You are an expert examiner for {{gradeLevel}} {{subject}}. For each question below, produce the missing answer key and/or marking scheme — nothing else.

## Rules:
1. **Echo the idx exactly** for every item you return, so the caller can match your output to the right question.
2. Produce a field ONLY when the item flags it: if \`needAnswerKey\` is true, give a concise correct/model \`answerKey\`; if \`needMarkingScheme\` is true, give a step-wise \`markingScheme\` (e.g. "1 mark for formula, 1 mark for substitution, 1 mark for answer") that sums to the question's marks.
3. **Language Lock**: respond ONLY in {{language}}.
4. **Factual Integrity**: answers must be correct for the given question — never fabricate. For mathematical questions, the answer and step marks must be accurate.

## Questions needing keys:
{{#each items}}
- idx {{idx}} ({{marks}} mark(s)) | needAnswerKey={{needAnswerKey}} needMarkingScheme={{needMarkingScheme}}
  Q: {{text}}
{{/each}}
`,
});

const examPaperGeneratorFlow = ai.defineFlow(
  {
    name: 'examPaperGeneratorFlow',
    inputSchema: ExamPaperInputSchema,
    outputSchema: ExamPaperOutputSchema,
  },
  async input => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');

    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();
    const uid = input.userId;
    // C2: per-request logical model-call counter (see MAX_MODEL_CALLS). Bumped
    // at each runResiliently invocation below; each repair pass also refuses to
    // fire once the ceiling is hit.
    let modelCalls = 0;
    // H1 (2026-07-16): this flow was the only AI flow that never normalized
    // its `language` input — an ISO code like "hi" reached the prompt's
    // {{language}} slot unmapped, and the deterministic stamp / placeholder
    // floor below fabricated English regardless of the paper's language.
    // normalizeLanguage() coerces both ISO codes and display names to the
    // canonical Language name used everywhere else (src/ai/lib/normalize-language.ts).
    const language = normalizeLanguage(input.language);

    // Content id minted UP FRONT (not at save time) so the "generating"
    // placeholder we write now and the finished paper we save later are the
    // SAME My-Library entry — an upsert, not two docs. Lets the library show a
    // live generating → ready | error lifecycle even when the request 202s and
    // the paper finishes in the background. (Sidecar canary/full path is NOT
    // wired for this — default dispatch mode is 'off' → this Genkit flow is the
    // live path; canary can still leave a second unlinked doc, known + parked.)
    const contentId = uid ? uuidv4() : undefined;

    // Single writer for all three lifecycle states. Best-effort by design: a
    // status write must never block or fail generation (mirrors the flow's
    // graceful-persistence rule). `data` present ⇒ the finished paper.
    const persistStatus = async (
      status: 'generating' | 'ready' | 'error',
      data?: ExamPaperOutput,
    ): Promise<void> => {
      if (!uid || !contentId) return;
      try {
        const { dbAdapter } = await import('@/lib/db/adapter');
        const { Timestamp } = await import('firebase-admin/firestore');
        const { toExamPaperContentFields } = await import('@/ai/data/exam-paper-content-fields');
        const now = Timestamp.fromDate(new Date());
        await dbAdapter.saveContent(uid, {
          id: contentId,
          type: 'exam-paper' as const,
          title: data?.title || `${input.board} ${input.gradeLevel} ${input.subject} Exam Paper`,
          ...toExamPaperContentFields({
            gradeLevel: data?.gradeLevel || input.gradeLevel,
            subject: input.subject || data?.subject,
            language: input.language,
          }),
          topic: input.chapters.length > 0 ? input.chapters.join(', ') : input.subject,
          isPublic: false,
          isDraft: false,
          status,
          createdAt: now,
          updatedAt: now,
          ...(data ? { data } : {}),
        });
        StructuredLogger.info(`Exam paper status → ${status}`, {
          service: 'exam-paper-generator-flow',
          operation: 'persistStatus',
          userId: uid,
          requestId,
          metadata: { contentId, status },
        });
      } catch (persistError: unknown) {
        StructuredLogger.warn('Exam paper status write failed (non-blocking)', {
          service: 'exam-paper-generator-flow',
          operation: 'persistStatus',
          userId: uid,
          requestId,
          metadata: { contentId, status, error: String(persistError) },
        });
      }
    };

    try {
      // Write the "generating" placeholder before the long model call so the
      // card appears in My Library immediately.
      await persistStatus('generating');

      StructuredLogger.info('Starting exam paper generation flow', {
        service: 'exam-paper-generator-flow',
        operation: 'generateExamPaper',
        userId: input.userId,
        requestId,
        input: {
          board: input.board,
          gradeLevel: input.gradeLevel,
          subject: input.subject,
          chapters: input.chapters,
          difficulty: input.difficulty,
          language: input.language,
        }
      });

      // Soft NCERT chapter validation — best-effort, never blocks generation.
      // Each chapter the teacher selected is validated; warnings aggregate
      // into the output for the UI to surface.
      //
      // Feature flag: ncertChapterValidation
      //   ENABLED (default) — run the soft validation, surface warnings
      //   DISABLED          — skip entirely (silences warnings when the
      //                       NCERT chapter seed gets stale or wrong)
      // Flip in Firestore: system_config/feature_flags.features
      //   .ncertChapterValidation.enabled = false
      const validationWarnings: ValidationWarning[] = [];
      const ncertFlag = await isFeatureEnabled('ncertChapterValidation', input.userId ?? 'system');
      try {
        if (ncertFlag.enabled) {
          for (const chapter of input.chapters ?? []) {
            const w = validateChapterForFlow({
              gradeLevel: input.gradeLevel,
              subject: input.subject,
              chapter,
            });
            if (w) validationWarnings.push(w);
          }
          if (validationWarnings.length > 0) {
            StructuredLogger.warn('NCERT chapter validation flagged exam-paper input', {
              service: 'exam-paper-generator-flow',
              operation: 'ncertValidation',
              userId: input.userId,
              requestId,
              metadata: { warnings: validationWarnings },
            });
          }
        }
      } catch (validationError) {
        StructuredLogger.warn('NCERT validation threw (non-blocking)', {
          service: 'exam-paper-generator-flow',
          operation: 'ncertValidation',
          requestId,
          metadata: { error: String(validationError) },
        });
      }

      // Whole-syllabus coverage: an empty chapter list means "cover the entire syllabus" (the
      // client's Whole-syllabus toggle sends []). Expand it ONCE, here, so every downstream consumer
      // — the blueprint constraint, PYQ retrieval + weightage budgeting, and the prompt's chapter
      // list — sees the same concrete chapters. Without this, [] silently yields zero PYQs and a
      // blank chapter list. Prefer the blueprint's chapterWeightage KEYS when present: they match the
      // weightage matcher exactly, whereas NCERT titles diverge for a couple of CBSE titles.
      if (input.chapters.length === 0) {
        try {
          const { canonicaliseGrade, canonicaliseSubject, getChaptersForCell } = await import('@/ai/data/ncert-chapters');
          const bp = await findBlueprint(input.board, input.gradeLevel, input.subject).catch(() => undefined);
          const fromBlueprint = bp?.chapterWeightage ? Object.keys(bp.chapterWeightage) : [];
          const grade = canonicaliseGrade(input.gradeLevel);
          const subject = canonicaliseSubject(input.subject);
          const fromNcert = grade != null && subject ? getChaptersForCell(grade, subject).map((c) => c.title) : [];
          const all = fromBlueprint.length ? fromBlueprint : fromNcert;
          if (all.length > 50) {
            StructuredLogger.warn('Whole-syllabus expansion exceeded 50 chapters — truncating', {
              service: 'exam-paper-generator-flow', operation: 'expandSyllabus', requestId,
              metadata: { subject: input.subject, gradeLevel: input.gradeLevel, count: all.length },
            });
            // M10: the WARN above only reaches server logs — surface the same
            // fact to the caller via the existing validationWarnings channel
            // so the teacher sees "N chapters dropped", not a silently short paper.
            validationWarnings.push({
              invalid: false,
              lenient: true,
              message: `Whole-syllabus coverage found ${all.length} chapters — capped to the first 50; ${all.length - 50} chapter(s) were not included.`,
              input: { gradeLevel: input.gradeLevel, subject: input.subject, chapter: '(whole syllabus)' },
            });
          }
          if (all.length) {
            input.chapters = all.slice(0, 50); // schema cap
            StructuredLogger.info('Whole-syllabus coverage — expanded chapter list', {
              service: 'exam-paper-generator-flow', operation: 'expandSyllabus', requestId,
              metadata: { source: fromBlueprint.length ? 'blueprint' : 'ncert', chapters: input.chapters.length },
            });
          }
        } catch (expandErr) {
          // Non-fatal: fall through with [] — the prompt's {{else}} still instructs full-syllabus coverage.
          StructuredLogger.warn('Whole-syllabus expansion failed — proceeding with prompt-only coverage', {
            service: 'exam-paper-generator-flow', operation: 'expandSyllabus', requestId,
            metadata: { error: expandErr instanceof Error ? expandErr.message : String(expandErr) },
          });
        }
      }

      const blueprintConstraint = await buildBlueprintConstraint(input);

      // --- RAG: retrieve PYQs per chapter from Firestore (pyq_questions) ---
      // Exact tag match on subject/class/chapter, ordered by frequency.
      // Graceful degradation: any failure → generate without PYQs.
      let retrievedPYQs: PYQQuestion[] = [];
      let blueprintSections: SectionBlueprint[] | undefined;
      try {
        const rawClass = parseInt(input.gradeLevel.replace(/\D/g, ''), 10);
        if (isNaN(rawClass)) {
          StructuredLogger.warn('Could not parse gradeLevel as number — defaulting to Class 10', {
            service: 'exam-paper-generator-flow', operation: 'retrievePYQs', requestId,
            metadata: { gradeLevel: input.gradeLevel },
          });
        }
        const classNum = (rawClass === 9 || rawClass === 10 ? rawClass : 10) as 9 | 10;

        const subjectLower = input.subject.toLowerCase();
        const PYQ_SUPPORTED_SUBJECTS = ['mathematics', 'science'] as const;
        type PYQSubject = typeof PYQ_SUPPORTED_SUBJECTS[number];
        const subjectNorm: PYQSubject | null = (PYQ_SUPPORTED_SUBJECTS as readonly string[]).includes(subjectLower)
          ? (subjectLower as PYQSubject)
          : null;

        if (!subjectNorm) {
          StructuredLogger.info('Subject not in PYQ store — generating without PYQs', {
            service: 'exam-paper-generator-flow', operation: 'retrievePYQs', requestId,
            metadata: { subject: input.subject, supportedSubjects: PYQ_SUPPORTED_SUBJECTS },
          });
          // Skip PYQ retrieval — retrievedPYQs stays [], paper generates from AI only
        } else {
          const { getPYQsByChapter } = await import('@/lib/services/pyq-retrieval-service');

          // Blueprint drives PYQ retrieval (warm-cached from buildBlueprintConstraint above). A
          // fetch failure must NOT zero out retrieval — degrade to equal-split / no marks-weight.
          const blueprint = await findBlueprint(input.board, input.gradeLevel, input.subject).catch(() => undefined);
          blueprintSections = blueprint?.sections;

          // (rule 2) Per-marks-bucket weight = the marks each section contributes to the paper
          // (marksPerQuestion × questionCount). A "section" is a marks level (Section A = 1-mark,
          // Section D = 5-mark), so bucketing PYQs by numeric marks mirrors the paper's shape.
          const marksWeight = blueprint?.sections.reduce((acc, s) => {
            const m = s.questionType.marksPerQuestion;
            acc[m] = (acc[m] ?? 0) + m * s.questionCount;
            return acc;
          }, {} as Record<number, number>);

          // (rule 1) Per-chapter budget ∝ chapterWeightage (case-insensitive title match, the same
          // pattern buildBlueprintConstraint uses). Unmatched chapters get the mean weight so they
          // aren't starved; equal split when there's no blueprint/weightage.
          const wt = blueprint?.chapterWeightage;
          const rawWeights = input.chapters.map((ch) =>
            wt ? Object.entries(wt).find(([k]) => k.toLowerCase() === ch.toLowerCase())?.[1] : undefined
          );
          const present = rawWeights.filter((w): w is number => typeof w === 'number');
          const meanW = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 1;
          const effWeights = rawWeights.map((w) => w ?? meanW);
          // (rule 3) Budgets sum to exactly PYQ_TOTAL so the merged context can't exceed the cap.
          const budgets = allocateBudget(effWeights, PYQ_TOTAL);

          // M7 (forensic EPG-2026-07-17): a whole-syllabus paper can request up to 50
          // chapters, and each getPYQsByChapter fires ~2+ Firestore reads — an unbounded
          // Promise.all hammered the DB with ~150 concurrent reads at once. Retrieve in
          // bounded batches instead (identical per-chapter calls + union/dedup below;
          // the batch index preserves each chapter's allocated budget).
          // ponytail: concurrency cap only — the real win (a single Firestore `in`-query
          // spanning chapters) needs a composite index + deploy, out of scope here.
          const CHAPTER_PYQ_CONCURRENCY = 8;
          const perChapter: PYQQuestion[][] = [];
          for (let start = 0; start < input.chapters.length; start += CHAPTER_PYQ_CONCURRENCY) {
            const batch = input.chapters.slice(start, start + CHAPTER_PYQ_CONCURRENCY);
            const batchResults = await Promise.all(
              batch.map((chapter, j) =>
                getPYQsByChapter(chapter, subjectNorm, classNum, budgets[start + j], marksWeight, input.board))
            );
            perChapter.push(...batchResults);
          }

          // Deduplicate across chapters by id, then hard-cap at PYQ_TOTAL (rule 3): never hand the
          // model more than the budget as context, regardless of rounding.
          const seen = new Set<string>();
          for (const q of perChapter.flat()) {
            if (!seen.has(q.id)) {
              seen.add(q.id);
              retrievedPYQs.push(q);
            }
          }
          if (retrievedPYQs.length > PYQ_TOTAL) retrievedPYQs.length = PYQ_TOTAL;

          StructuredLogger.info('PYQ retrieval completed', {
            service: 'exam-paper-generator-flow',
            operation: 'retrievePYQs',
            requestId,
            metadata: { pyqCount: retrievedPYQs.length, chapters: input.chapters },
          });
        }
      } catch (pyqError: unknown) {
        const msg = pyqError instanceof Error ? pyqError.message : String(pyqError);
        StructuredLogger.warn('PYQ retrieval failed — generating without PYQs', {
          service: 'exam-paper-generator-flow',
          operation: 'retrievePYQs',
          requestId,
          metadata: { error: msg },
        });
        // Graceful fallback: proceed without PYQs
      }

      // Build PYQ context block to inject into the prompt
      const pyqContext = buildPYQContext(retrievedPYQs, blueprintSections, input.pyqRatio);

      // Bounded generation retry (Phase 1, 2026-07-16 — see
      // tasks/FIX-exam-paper-large-paper-degeneration.md). The generate call can
      // degenerate (repetition loop → truncated JSON → Genkit INVALID_ARGUMENT throw),
      // return null, or come back `length`-truncated. runResiliently won't retry these
      // (only 429/401/403), so one bad roll used to hard-fail the paper. Re-roll a
      // degenerate/truncated generation up to MAX_GEN_ATTEMPTS here at the flow level.
      let genResponse: Awaited<ReturnType<typeof examPaperGeneratorPrompt>> | undefined;
      let output: ExamPaperOutput | undefined;
      let usedFallbackModel = false;
      for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
        try {
          modelCalls++; // C2: count every generation attempt (incl. quota-fallback re-runs)
          genResponse = await runResiliently(async (resilienceConfig) => {
            // On retries, override temperature/topP to PERTURB the re-roll (a same-temp
            // retry reproduces a deterministic loop). Genkit shallow-merges call config
            // over the prompt config, so maxOutputTokens/stopSequences/thinkingConfig are
            // preserved; only temperature/topP change.
            const attemptConfig =
              attempt > 1
                ? { ...resilienceConfig.config, temperature: retryTemperature(attempt), topP: 0.95 }
                : resilienceConfig.config;
            // After a strong-model quota wall, run the rest on the fallback model (degraded path).
            return await examPaperGeneratorPrompt(
              { ...input, blueprintConstraint, pyqContext, language },
              usedFallbackModel && QUOTA_FALLBACK_MODEL
                ? { ...resilienceConfig, config: attemptConfig, model: QUOTA_FALLBACK_MODEL }
                : { ...resilienceConfig, config: attemptConfig }
            );
          }, 'examPaper.generate');
        } catch (genErr: unknown) {
          // Quota wall on the strong model → switch to the fallback model and retry (does NOT
          // consume a perturbation attempt). Only once; if the fallback is also exhausted, fall through.
          const isQuota = genErr instanceof Error && genErr.name === 'AIQuotaExhaustedError';
          if (isQuota && QUOTA_FALLBACK_MODEL && !usedFallbackModel) {
            usedFallbackModel = true;
            StructuredLogger.warn('examPaper.generate quota exhausted — degraded fallback model', {
              service: 'exam-paper-generator-flow', operation: 'generateFallback', requestId,
              metadata: { attempt, fallbackModel: QUOTA_FALLBACK_MODEL },
            });
            attempt--; // retry this attempt number on the fallback model
            continue;
          }
          // Re-roll a degeneration-shaped failure; surface anything else (or the last attempt).
          if (isRetryableGenerationFailure(genErr) && attempt < MAX_GEN_ATTEMPTS) {
            StructuredLogger.warn('examPaper.generate failed (degenerate) — re-rolling', {
              service: 'exam-paper-generator-flow', operation: 'generateRetry', requestId,
              metadata: {
                attempt, maxAttempts: MAX_GEN_ATTEMPTS,
                reason: genErr instanceof Error ? genErr.message.slice(0, 160) : String(genErr),
              },
            });
            continue;
          }
          throw genErr;
        }

        output = genResponse.output ?? undefined;
        const finishReason = (genResponse as { finishReason?: string }).finishReason;

        // Reasoning-token observability (Phase 1). Thinking tokens are ~71% of the bill
        // and the whole point of the thinkingBudget cap — log them (+ the active budgets
        // and finishReason so a truncation is visible) each attempt.
        StructuredLogger.info('examPaper.generate usage', {
          service: 'exam-paper-generator-flow',
          operation: 'generateUsage',
          userId: input.userId,
          requestId,
          metadata: {
            attempt,
            temperature: attempt > 1 ? retryTemperature(attempt) : BASE_TEMPERATURE,
            model: usedFallbackModel ? QUOTA_FALLBACK_MODEL : (process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash'),
            finishReason: finishReason ?? 'none',
            thinkingBudget: _thinkingBudget ?? 'unbounded',
            maxOutputTokens: _maxOutputTokens ?? 'unbounded',
            thoughtsTokens: genResponse.usage?.thoughtsTokens,
            inputTokens: genResponse.usage?.inputTokens,
            outputTokens: genResponse.usage?.outputTokens,
            totalTokens: genResponse.usage?.totalTokens,
          },
        });

        // A `length`-truncated or null response is degenerate — re-roll if attempts remain.
        if ((!output || finishReason === 'length') && attempt < MAX_GEN_ATTEMPTS) {
          StructuredLogger.warn('examPaper.generate truncated/empty — re-rolling', {
            service: 'exam-paper-generator-flow', operation: 'generateRetry', requestId,
            metadata: { attempt, maxAttempts: MAX_GEN_ATTEMPTS, finishReason: finishReason ?? 'none', hasOutput: !!output },
          });
          continue;
        }
        break;
      }

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.5-flash',
            input: `${input.board} ${input.gradeLevel} ${input.subject}`
          }
        );
      }

      // Parse-and-replace: the schema now safe-fills `blueprintSummary` /
      // `pyqSources` defaults, so we adopt the parsed (defaulted) object as the
      // canonical output. This guarantees downstream consumers (the dispatcher
      // and the route response) always see a populated `blueprintSummary`
      // instead of `undefined` when the model omitted it.
      let parsedOutput: ExamPaperOutput = output;
      try {
        parsedOutput = ExamPaperOutputSchema.parse(output);
      } catch (validationError: unknown) {
        const ve = validationError as { message?: string; errors?: unknown };
        throw new SchemaValidationError(
          `Schema validation failed: ${ve.message ?? String(validationError)}`,
          {
            parseErrors: ve.errors,
            rawOutput: output,
            expectedSchema: 'ExamPaperOutputSchema'
          }
        );
      }

      // M1 (2026-07-16): `sections` now has `.min(1)`, but a schema-valid
      // paper can still be `[{ questions: [] }, ...]` — every section present
      // but empty (per-section `questions` deliberately has NO `.min(1)`;
      // that array is exactly what the drift-repair path below mutates). An
      // empty paper is never valid and never repairable, so fail fast here
      // rather than persisting/returning a blank "ready" paper.
      const totalQuestions = parsedOutput.sections.reduce((n, s) => n + s.questions.length, 0);
      if (totalQuestions === 0) {
        throw new SchemaValidationError('Generated exam paper has no questions', {
          rawOutput: output,
          expectedSchema: 'ExamPaperOutputSchema',
        });
      }

      // Source-tag sanitize (2026-07-17): rule 10 asks for "PYQ <year> <set>"
      // but the model sometimes appends board/id noise (e.g. "PYQ 2023 (CBSE)
      // | <docId>") — strip to the bare tag so the UI badge never leaks
      // internal ids or board labels. Also called on the marks/ratio repair
      // retries below — any replacement `parsedOutput` needs the same pass.
      sanitizePyqSourceTags(parsedOutput);

      // "New"-novelty verify (C7): relabel reworded/number-swapped PYQs tagged
      // "New" BEFORE the ratio reconcile below, so that pass counts an honest
      // mix. See verifyNewQuestionsPass (flag: examPaperNewVerification).
      await verifyNewQuestionsPass(parsedOutput, retrievedPYQs, input.userId, requestId);

      // Shared context for the extracted repair passes (M2). Bundles the closure
      // state each pass reads; the model-call budget is threaded in/out.
      const repairCtx: RepairCtx = { input, blueprintConstraint, pyqContext, language, requestId, startTime, retrievedPYQs };

      // Pass 1 — PYQ/New ratio reconcile. See reconcilePyqRatio (flag:
      // examPaperPyqRatioRepair). Runs BEFORE marks reconcile so a regenerated
      // paper still gets its marks checked.
      ({ parsed: parsedOutput, modelCalls } = await reconcilePyqRatio(parsedOutput, modelCalls, repairCtx));

      delete parsedOutput.contentId; // strip model-fabricated value (H3 — system-populated only)

      // Pass 2 — marks reconcile (see reconcileMarks; flag: examPaperMarksRepair).
      // Runs AFTER the ratio pass; its C1 guard refuses a marks-repair regen that
      // would regress the mix the ratio pass fixed.
      ({ parsed: parsedOutput, modelCalls } = await reconcileMarks(parsedOutput, modelCalls, repairCtx));

      // Pass 3 — answer-key / marking-scheme completeness (see backfillAnswerKeys;
      // flag: examPaperKeyBackfill). Runs AFTER the marks reconcile (a repair
      // regen can drop keys the first attempt had); in-place patch + a
      // deterministic placeholder floor that always guarantees invariant #2.
      ({ parsed: parsedOutput, modelCalls } = await backfillAnswerKeys(parsedOutput, modelCalls, repairCtx));

      // H3 (2026-07-16): re-set AFTER stripping, same strip-then-set
      // convention as marksReconciliation/answerKeyCompleteness above — and,
      // like those two, set BEFORE persistStatus('ready', ...) so the stored
      // Firestore `data` blob carries the same contentId as the doc it lives
      // in, not just the function's return value.
      parsedOutput.contentId = contentId;

      // Flip the placeholder to the finished paper (same contentId, upsert).
      // Persists to Firestore `data` only — the paper is viewed/downloaded
      // straight from `data` (see content-gallery HTML_PRINTABLE_TYPES), so no
      // redundant Storage blob. Best-effort inside persistStatus.
      await persistStatus('ready', parsedOutput);

      const duration = Date.now() - startTime;
      StructuredLogger.info('Exam paper generation flow completed successfully', {
        service: 'exam-paper-generator-flow',
        operation: 'generateExamPaper',
        requestId,
        duration,
        metadata: {
          // M6 (forensic EPG-2026-07-17): stable, feature-scoped outcome signal
          // (mirrors billing-metrics.ts). A Cloud Logging log-based metric keyed on
          // metadata.metric with board/subject/outcome labels gives a per-feature
          // success+failure counter — alertable distinctly from generic AI errors.
          metric: 'exam_paper_generation',
          outcome: 'success',
          board: input.board,
          subject: input.subject,
          sectionCount: parsedOutput.sections.length,
          totalQuestions: parsedOutput.sections.reduce((sum, s) => sum + s.questions.length, 0),
          modelCalls, // C2: logical model calls this request (ceiling MAX_MODEL_CALLS)
        }
      });

      if (validationWarnings.length > 0) {
        return { ...parsedOutput, validationWarnings };
      }
      return parsedOutput;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Exam paper generation flow execution failed',
        {
          service: 'exam-paper-generator-flow',
          operation: 'generateExamPaper',
          requestId,
          input: {
            board: input.board,
            gradeLevel: input.gradeLevel,
            subject: input.subject,
          },
          duration,
          metadata: {
            // M6: mirror the success-path outcome signal so one log-based metric
            // filter (metadata.metric = 'exam_paper_generation') covers both, with
            // board/subject as queryable labels for a per-board/subject alert.
            metric: 'exam_paper_generation',
            outcome: 'failure',
            board: input.board,
            subject: input.subject,
            errorType: flowError.constructor?.name,
            errorCode: flowError.errorCode
          }
        },
        flowError
      );

      if (typeof flowError === 'object' && flowError !== null) {
        flowError.errorId = errorId;
      }

      // Flip the placeholder to 'error' so the My-Library card stops showing
      // "generating" and offers a retry, instead of hanging forever. Covers the
      // errors we DO catch (quota-exhausted, schema-invalid, null output);
      // an instance killed mid-generation is caught by client-side staleness.
      await persistStatus('error');

      throw flowError;
    }
  }
);
