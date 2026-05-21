import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the possible agent types
const AgentTypeSchema = z.enum([
  'lessonPlan',
  'quiz',
  'visualAid',
  'worksheet',
  'virtualFieldTrip',
  'teacherTraining',
  'rubric',
  'examPaper',
  'instantAnswer',
  'videoStoryteller',
  'unknown'
]);

// Phase N.1 — typed planned-action queue. Mirrors the Python sidecar's
// `VidyaAction` / `VidyaActionParams` (sahayakai-agents/.../vidya/schemas.py)
// so the Genkit off-mode wire shape matches the canary/full sidecar wire
// shape. Closes forensic-audit B5 + C4 (Node-side schema parity).
//
// `flow` uses the wire-shape kebab-case strings the OmniOrb client and
// the Python schema both speak. The Genkit-side intent label
// (`AgentTypeSchema`, camelCase) maps to these via the switch in
// `processAgentRequest`; we keep the `plannedActions[*].flow` enum on
// the wire-shape strings to match the sidecar exactly.
const AllowedFlowEnum = z.enum([
  'lesson-plan',
  'quiz-generator',
  'visual-aid-designer',
  'worksheet-wizard',
  'virtual-field-trip',
  'teacher-training',
  'rubric-generator',
  'exam-paper',
  'video-storyteller',
]);

const NcertChapterRefSchema = z.object({
  number: z.number().int().min(1).max(30),
  // Title bound to .max(300) only — was .min(1) but Gemini occasionally
  // returns {number: 2, title: ""} when it knows the chapter number but
  // not its NCERT title; the minLength then triggers Genkit schema
  // validation 500 in /api/ai/intent. Empty title is acceptable; the
  // downstream prompt template degrades to "Chapter N" without title.
  title: z.string().max(300),
  learningOutcomes: z.array(z.string().max(300)).max(20).optional(),
});

const VidyaActionParamsSchema = z.object({
  topic: z.string().nullable().optional(),
  gradeLevel: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  ncertChapter: NcertChapterRefSchema.nullable().optional(),
  // Phase N.1 — index pointers into the parent `plannedActions` list.
  // Each int is the position of an EARLIER action whose output this
  // action consumes (e.g. a rubric grading a lesson plan at index 0
  // sets `dependsOn: [0]`). Bounded at 2 entries — deeper graphs
  // should split into separate teacher-confirmed sessions.
  dependsOn: z.array(z.number().int().nonnegative()).max(2).optional(),
  // NCERT-demo 2026-05-19 — cancel-prior-state semantics. When the
  // current transcript is too sparse to fully populate the action (e.g.
  // teacher said only "Class 10"), the classifier surfaces a single
  // follow-up question the OmniOrb speaks back to the teacher instead
  // of silently inheriting params from the previous turn. Bounded to
  // 300 chars to keep TTS latency under 1.5s.
  clarifyingPrompt: z.string().max(300).nullable().optional(),
  // NCERT-demo 2026-05-19 — post-classification validation hook.
  // Populated when the (gradeLevel, subject, ncertChapter) tuple does
  // not match a known NCERT entry (e.g. teacher asked for "Class 7
  // Maths chapter on quadratic equations" — quadratics live in Class 10).
  // The OmniOrb surfaces this as a soft warning before navigating so
  // the demo doesn't generate a nonsense paper.
  validationWarning: z.string().max(300).nullable().optional(),
});

// Gemini 2.5 Flash's structured-output API rejects JSON-Schema `const`
// past nesting depth ~5 (returns "Unknown name 'const' at ..."). The
// VidyaActionSchema sits at depth 5+ (root.plannedActions.items.properties.type),
// so we declare the discriminator via `z.enum([...] as const)` instead of
// `z.literal(...)`. Single-value enum compiles to JSON-Schema `enum: ["X"]`
// — accepted at any depth — and still narrows the TS type to the exact
// literal 'NAVIGATE_AND_FILL' for downstream consumers (omni-orb's
// `action.type === "NAVIGATE_AND_FILL"` guard relies on this).
const VidyaActionSchema = z.object({
  type: z.enum(['NAVIGATE_AND_FILL'] as const),
  flow: AllowedFlowEnum,
  params: VidyaActionParamsSchema,
});
export type VidyaAction = z.infer<typeof VidyaActionSchema>;

// Input schema for the router
const AgentRouterInputSchema = z.object({
  prompt: z.string().describe('The user request.'),
  language: z.string().optional().describe('The language of the request.'),
  gradeLevels: z.array(z.string()).optional().describe('The grade levels for the content.'),
  imageDataUri: z.string().optional().describe('An optional image data URI.'),
  userId: z.string().optional().describe('The ID of the user.'),
});
export type AgentRouterInput = z.infer<typeof AgentRouterInputSchema>;

// Output schema for the router
const AgentRouterOutputSchema = z.object({
  type: AgentTypeSchema.describe('The type of agent that handled the request.'),
  topic: z.string().optional().describe('The extracted topic.'),
  gradeLevel: z.string().optional().describe('The extracted grade level (e.g., "Class 7").'),
  subject: z.string().optional().describe('The extracted subject.'),
  language: z.string().optional().describe('The detected language.'),
  // Phase N.1 — typed planned-action queue (replaces Phase G's
  // `followUpSuggestion: string | null`). Up to 3 ordered actions the
  // orchestrator authored for a compound request ("lesson plan AND a
  // rubric"). The first entry mirrors the primary `type` field for
  // backward compat; the rest are the queue of follow-ups the OmniOrb
  // renders as chips. Empty / undefined for unknown / instantAnswer /
  // unroutable single-step requests. The router does NOT auto-execute
  // — every entry is teacher-confirmed.
  plannedActions: z.array(VidyaActionSchema).max(3).optional()
    .describe('Phase N.1 — ordered queue of NAVIGATE_AND_FILL actions for compound requests. Max 3.'),
  result: z.any().describe('The output from the selected agent.'),
});
export type AgentRouterOutput = z.infer<typeof AgentRouterOutputSchema>;


// 1. Determine the user's intent and extract parameters
const intentPrompt = ai.definePrompt({
  name: 'intentClassifier',
  input: { schema: z.object({ prompt: z.string() }) },
  output: {
    schema: z.object({
      intent: AgentTypeSchema,
      topic: z.string().optional(),
      gradeLevel: z.string().optional(),
      subject: z.string().optional(),
      language: z.string().optional(),
      // Phase N.1 — mirrors the Python `IntentClassification.plannedActions`
      // contract from `sahayakai-agents/.../vidya/schemas.py`. Empty for
      // single-step requests; up to 3 entries for compound multi-step
      // intents. The first entry's `flow` MUST mirror the primary `intent`
      // (mapped via `INTENT_TO_FLOW`). Deeper actions express data flow
      // via `params.dependsOn` (max 2 ints).
      plannedActions: z.array(VidyaActionSchema).max(3).optional(),
    })
  },
  prompt: `Analyze the user prompt to determine the intended tool and extract key parameters.

        ⚠️ FRESH CLASSIFICATION RULE (NCERT-demo 2026-05-19 hardening):
        This is a FRESH classification of the prompt below — treat it as a single,
        self-contained utterance. DO NOT carry over \`topic\`, \`gradeLevel\`,
        \`subject\`, \`language\`, or \`ncertChapter\` values from any prior
        conversation turn. Only populate a field if the CURRENT prompt explicitly
        contains it (or unambiguously references the previous turn with phrases
        like "wahi class", "same as before", "उसी का", "ಅದೇ topic"). When in
        doubt, leave the field null and emit a \`clarifyingPrompt\` (see below)
        instead of guessing — silent inheritance is the bug we are fixing.

        STEP 1 — INTENT CLASSIFICATION:
        - 'lessonPlan': Creating lessons, lesson plans (लेसन प्लान), unit plans, "teach this", "help me teach".
        - 'quiz': Short formative assessments. Triggered by: "quiz", "क्विज", "MCQ", "objective questions", "rapid fire", "warm-up questions", "diagnostic", "formative assessment", "short questions for tomorrow", "10 questions for the period", "exit ticket". A quiz is for IN-CLASS check-for-understanding; it is NOT a board-style paper. If the teacher mentions section structure, marks distribution, or board pattern → it is examPaper, NOT quiz.
        - 'visualAid': finding/creating images, diagrams (चित्र), flashcards.
        - 'worksheet': Creating worksheets, exercises, take-home assignments.
        - 'virtualFieldTrip': Planning virtual field trips, "take me to...".
        - 'teacherTraining': Professional development, classroom management (मैनेजमेंट), coaching.
        - 'rubric': Creating grading rubrics, assessment criteria.
        - 'examPaper': FULL board-style examination papers with sections, marks distribution, and time duration. Triggered by: "exam paper", "board paper", "question paper", "प्रश्न पत्र", "model paper", "previous year paper", "PYQ", "pre-board paper", "pattern paper", "CBSE paper", "ICSE paper", "sample paper", "test paper for board", "half-yearly paper", "annual exam paper", "board ke pattern par paper". An exam paper is FORMAL summative assessment, typically 60-180 minutes and 40-100 marks.
        - 'instantAnswer': Direct questions (What is...), definitions, quick facts.
        - 'videoStoryteller': Finding educational videos, YouTube.
        - 'unknown': If the intent is unclear or just a greeting.

        🔑 QUIZ vs EXAM-PAPER DISAMBIGUATION (worked examples):
        These two intents collide most often. Read these examples carefully —
        the wrong route loses the founder's demo.

        Example 1 (English, quiz):
          Input: "Make a quick MCQ quiz on photosynthesis for Class 7."
          intent: "quiz" — "quick MCQ" + "for Class 7" (no board mention) ⇒ in-class formative.

        Example 2 (English, exam paper):
          Input: "Generate a Class 10 CBSE board pattern paper for Maths on quadratic equations."
          intent: "examPaper" — "CBSE board pattern paper" is the strongest signal; the
          chapter scope just narrows topic. NOT quiz.

        Example 3 (Hindi, exam paper):
          Input: "Class 10 ka exam paper banao Maths ka — quadratic equations chapter."
          intent: "examPaper" — "exam paper" is explicit; "banao" is just Hindi
          imperative. gradeLevel: "Class 10", subject: "Mathematics", topic:
          "Quadratic Equations". Do NOT route to quiz just because no board name
          appears — "exam paper" by itself is sufficient.

        Example 4 (Hindi, quiz):
          Input: "कक्षा 7 के लिए जीव विज्ञान पर 10 छोटे प्रश्न बनाओ।"
          intent: "quiz" — "10 छोटे प्रश्न" (10 short questions) for a class period
          is a quiz, NOT a board paper. No section structure mentioned.

        Example 5 (Kannada, exam paper):
          Input: "10ನೇ ತರಗತಿಗೆ ವಿಜ್ಞಾನ ಬೋರ್ಡ್ ಪರೀಕ್ಷೆ ಪತ್ರಿಕೆ ತಯಾರಿಸಿ."
          intent: "examPaper" — "ಬೋರ್ಡ್ ಪರೀಕ್ಷೆ ಪತ್ರಿಕೆ" (board exam paper) is
          unambiguous. gradeLevel: "Class 10", subject: "Science", language: "kn".

        Example 6 (Kannada, quiz):
          Input: "ಪಾಠದ ಆರಂಭದಲ್ಲಿ ಕೇಳಲು 5 ಪ್ರಶ್ನೆಗಳು ಬೇಕು — ತರಗತಿ 6 ಗಣಿತ."
          intent: "quiz" — "ಪಾಠದ ಆರಂಭದಲ್ಲಿ" (at the start of the lesson) + 5
          questions ⇒ warm-up / diagnostic. Quiz, not examPaper.

        Example 7 (Code-mixed, exam paper):
          Input: "Class 10 ka exam paper banao Maths ka — quadratic equations chapter"
          intent: "examPaper". topic: "Quadratic Equations", gradeLevel: "Class 10",
          subject: "Mathematics", language: "hi" (Devanagari + Latin hybrid → resolve
          to dominant non-English script; here Hindi).

        TIE-BREAKER: if BOTH "quiz" and "paper/board" appear in the same prompt,
        choose examPaper — the structural artefact wins over the casual term.

        STEP 2 — PARAMETER EXTRACTION (one-shot from CURRENT prompt only):
        - topic: The core subject matter. STRIP conversational markers (e.g., "Hey", "Can you make", "कसा है") and metadata that belongs in other fields (e.g., strip "Class 5" if gradeLevel is Class 5). If the CURRENT prompt has no topic, return null — do NOT pull from chat history.
        - gradeLevel: Mandatory "Bharat-First" mapping. You MUST map "grade X", "class X", "कक्षा X", "ತರಗತಿ X", or "Xth grade" to "Class X" format. Valid: "Class 1" to "Class 12". Return null if not present in CURRENT prompt.
        - subject: The academic subject area. Return null if not present in CURRENT prompt.
        - language: The language requested OR the dominant script of the CURRENT prompt. Map to codes: hi (Hindi), en (English), bn, te, mr, ta, gu, kn, pa, ml.
        - ncertChapter: Populate ONLY if the CURRENT prompt explicitly names a chapter (e.g. "Chapter 2 Living Things" or "अध्याय 5 गति"). Otherwise null.

        STEP 2b — CLARIFYING PROMPT (optional, plannedActions[*].params.clarifyingPrompt):
        If the CURRENT prompt is too sparse to fully populate the action — e.g.
        the teacher said only "Class 10" with no subject or artefact type — populate
        \`plannedActions[*].params.clarifyingPrompt\` with ONE short follow-up
        question the OmniOrb can speak back. Keep it under 200 characters and in
        the same language as the prompt. Example: "Class 10 in which subject? For
        an exam paper or a quiz?"

        DO NOT populate \`clarifyingPrompt\` when all required fields are present.
        DO NOT use \`clarifyingPrompt\` as a substitute for inheriting fields from
        prior turns — it is the polite alternative to guessing.

        SPECIAL INSTRUCTION FOR CONVERSATIONAL HINDI/URDU:
        - Handle mixed scripts (Devanagari/Perso-Arabic) and colloquialisms (e.g., "banana hai", "chahiye", "de sakti ho").
        - If the user asks for a specific tool (e.g., "lesson plan") but provides no topic, set intent correctly but topic to null.

        STEP 3 — DETECT COMPOUND / MULTI-STEP INTENT (Phase N.1):

        Teachers often ask for a sequence of artefacts in one breath:
        - "Make a lesson plan AND a rubric to grade them."
        - "Plan a lesson on photosynthesis, then a worksheet for homework."
        - "Quiz on the Mughal Empire, after that an exam paper for revision."

        For these compound requests, emit a TYPED \`plannedActions\` list (max 3 entries).
        Each entry has the shape:
          {
            "type": "NAVIGATE_AND_FILL",
            "flow": "<one of: lesson-plan | quiz-generator | visual-aid-designer | worksheet-wizard | virtual-field-trip | teacher-training | rubric-generator | exam-paper | video-storyteller>",
            "params": {
              "topic": "<topic from CURRENT prompt or null>",
              "gradeLevel": "<Class N from CURRENT prompt or null>",
              "subject": "<subject from CURRENT prompt or null>",
              "language": "<ISO code>",
              "ncertChapter": null,
              "dependsOn": [],
              "clarifyingPrompt": null
            }
          }

        Rules:
        1. The FIRST entry MUST mirror the primary \`intent\`. Use the wire-shape kebab-case (lesson-plan, quiz-generator, …) for \`flow\` — not the camelCase intent label.
        2. Use \`params.dependsOn\` (list of ints, max 2 entries) to express data flow between actions. Each int is the index of an EARLIER \`plannedActions\` entry whose output this action consumes. A rubric that grades a lesson plan at index 0 sets \`dependsOn: [0]\`. Independent follow-ups leave \`dependsOn: []\`.
        3. Re-use \`gradeLevel\`, \`subject\`, \`topic\`, and \`language\` across entries — the teacher meant a coherent unit, not unrelated requests.
        4. For SINGLE-step requests, emit \`plannedActions: []\` (an empty array). The OmniOrb client only renders chips for entries beyond the primary, so an empty list means "no follow-ups."
        5. For \`instantAnswer\` and \`unknown\` intents, ALWAYS emit \`plannedActions: []\` — these never produce navigation actions.

        The OmniOrb client iterates \`plannedActions\` and renders each entry as a one-tap chip the teacher can accept. The orchestrator does NOT execute follow-ups automatically — the teacher confirms each one.

        Prompt: {{{prompt}}}
        `,
});

// Map the legacy camelCase intent labels to the wire-shape kebab-case
// flow names. Used to normalise / validate the model's `plannedActions[0]`
// against the primary intent, and to back-fill a single-action plan
// when the model returned an empty list for a routable intent.
const INTENT_TO_FLOW: Record<string, z.infer<typeof AllowedFlowEnum>> = {
  lessonPlan: 'lesson-plan',
  quiz: 'quiz-generator',
  visualAid: 'visual-aid-designer',
  worksheet: 'worksheet-wizard',
  virtualFieldTrip: 'virtual-field-trip',
  teacherTraining: 'teacher-training',
  rubric: 'rubric-generator',
  examPaper: 'exam-paper',
  videoStoryteller: 'video-storyteller',
};

const NON_ROUTABLE_INTENTS = new Set(['instantAnswer', 'unknown']);

/**
 * NCERT-demo 2026-05-19 — chapter validation hook.
 *
 * The real validator lives in `src/ai/data/ncert-chapters.ts` (Agent 3's
 * deliverable). We import lazily and fall back to a permissive stub so
 * this layer never blocks intent classification when the data module is
 * still in flight. Contract:
 *
 *   validateChapter(gradeLevel, subject, chapter)
 *     → { valid: boolean; suggestion?: string }
 *
 * When `valid: false`, the suggestion string (if present) is surfaced
 * verbatim to the teacher via `params.validationWarning` so the OmniOrb
 * can speak a soft correction before navigating.
 */
type ChapterValidator = (
  gradeLevel: string,
  subject: string,
  chapter: string,
) => { valid: boolean; suggestion?: string };

const PASSTHROUGH_CHAPTER_VALIDATOR: ChapterValidator = () => ({ valid: true });

async function loadChapterValidator(): Promise<ChapterValidator> {
  try {
    // Use a string template so bundlers don't fail at compile time if
    // the module is still missing on disk (Agent 3 is still landing it).
    const modPath = '@/ai/data/ncert-chapters';
    const mod = (await import(/* webpackIgnore: true */ modPath)) as {
      validateChapter?: ChapterValidator;
    };
    if (typeof mod?.validateChapter === 'function') {
      return mod.validateChapter;
    }
  } catch {
    // Module not present yet — fall through to the permissive stub.
  }
  return PASSTHROUGH_CHAPTER_VALIDATOR;
}

/**
 * Walk plannedActions and attach a `validationWarning` to any entry whose
 * (gradeLevel, subject, ncertChapter.title) tuple the validator rejects.
 * Never throws — validation failures are diagnostic, not blocking.
 */
async function annotateChapterValidation(actions: VidyaAction[]): Promise<VidyaAction[]> {
  if (actions.length === 0) return actions;
  const validate = await loadChapterValidator();
  return actions.map((action) => {
    const params = action.params ?? {};
    const grade = params.gradeLevel ?? '';
    const subject = params.subject ?? '';
    const chapter = params.ncertChapter?.title ?? '';
    if (!grade || !subject || !chapter) return action;
    let result: { valid: boolean; suggestion?: string };
    try {
      result = validate(grade, subject, chapter);
    } catch {
      return action; // validator threw → swallow, do not block demo
    }
    if (result.valid) return action;
    return {
      ...action,
      params: {
        ...params,
        validationWarning:
          result.suggestion ??
          `Chapter "${chapter}" does not match the NCERT syllabus for ${grade} ${subject}. Please confirm.`,
      },
    };
  });
}

/**
 * Build a single-action `plannedActions` plan from the bare intent +
 * extracted params. Used when the classifier returned a routable intent
 * but no `plannedActions` entry — the dispatcher still wants a uniform
 * iteration surface for v0.4+ clients.
 */
function synthesizePrimaryAction(
  intent: string,
  params: {
    topic?: string;
    gradeLevel?: string;
    subject?: string;
    language?: string;
    clarifyingPrompt?: string | null;
  },
): VidyaAction | null {
  const flow = INTENT_TO_FLOW[intent];
  if (!flow) return null;
  return {
    type: 'NAVIGATE_AND_FILL',
    flow,
    params: {
      topic: params.topic ?? null,
      gradeLevel: params.gradeLevel ?? null,
      subject: params.subject ?? null,
      language: params.language ?? null,
      ncertChapter: null,
      dependsOn: [],
      clarifyingPrompt: params.clarifyingPrompt ?? null,
      validationWarning: null,
    },
  };
}

// The main router flow
export const agentRouterFlow = ai.defineFlow(
  {
    name: 'agentRouter',
    inputSchema: AgentRouterInputSchema,
    outputSchema: AgentRouterOutputSchema,
  },
  async (input) => {
    const { runResiliently } = await import('@/ai/genkit');
    // 1. Determine the user's intent
    const { output: intentOutput } = await runResiliently(async (resilienceConfig) => {
      return await intentPrompt({ prompt: input.prompt }, resilienceConfig);
    }, 'intent.classify');

    const intent = intentOutput?.intent || 'unknown';
    const topic = intentOutput?.topic;
    const gradeLevel = intentOutput?.gradeLevel;
    const subject = intentOutput?.subject;
    const language = intentOutput?.language;

    // Phase N.1 — typed planned-action queue. Mirrors the Python
    // `IntentClassification.plannedActions` contract.
    //
    // Three cases:
    //   1. Compound request — model already emitted >= 1 action. Use as-is
    //      (Zod has already validated max=3 + per-entry shape).
    //   2. Single-step routable intent — model emitted []; synthesise a
    //      single-action plan from the bare intent + params so v0.4+
    //      clients (OmniOrb post-δ migration) have a uniform iteration
    //      surface.
    //   3. Non-routable intent (instantAnswer / unknown) — leave the
    //      plan empty; the consumer handles ANSWER vs error directly.
    let plannedActions = intentOutput?.plannedActions ?? [];
    if (plannedActions.length === 0 && !NON_ROUTABLE_INTENTS.has(intent)) {
      const primary = synthesizePrimaryAction(intent, {
        topic,
        gradeLevel,
        subject,
        language,
      });
      if (primary) plannedActions = [primary];
    }

    // NCERT-demo 2026-05-19 — post-classification validation pass.
    // Annotates each routable action with a `validationWarning` when the
    // (gradeLevel, subject, chapter) tuple doesn't match the NCERT syllabus.
    // Falls back to a passthrough when Agent 3's data module is still in
    // flight, so this hook never blocks intent classification.
    plannedActions = await annotateChapterValidation(plannedActions);

    return {
      type: intent,
      topic,
      gradeLevel,
      subject,
      language,
      plannedActions,
      result: null,
    };
  }
);
