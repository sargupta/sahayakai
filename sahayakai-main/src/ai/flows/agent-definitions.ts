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
  title: z.string().min(1).max(300),
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
});

const VidyaActionSchema = z.object({
  type: z.literal('NAVIGATE_AND_FILL'),
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

        STEP 1 — INTENT CLASSIFICATION:
        - 'lessonPlan': Creating lessons, lesson plans (लेसन प्लान), unit plans, "teach this", "help me teach".
        - 'quiz': Creating quizzes (क्विज), tests, assessments, exam questions.
        - 'visualAid': finding/creating images, diagrams (चित्र), flashcards.
        - 'worksheet': Creating worksheets, exercises, assignments.
        - 'virtualFieldTrip': Planning virtual field trips, "take me to...".
        - 'teacherTraining': Professional development, classroom management (मैनेजमेंट), coaching.
        - 'rubric': Creating grading rubrics, assessment criteria.
        - 'examPaper': Creating board exam papers, question papers (प्रश्न पत्र), "CBSE paper", "board pattern paper", "sample paper", "previous year paper", "model paper", "pre-board paper".
        - 'instantAnswer': Direct questions (What is...), definitions, quick facts.
        - 'videoStoryteller': Finding educational videos, YouTube.
        - 'unknown': If the intent is unclear or just a greeting.

        STEP 2 — PARAMETER EXTRACTION:
        - topic: The core subject matter. STRIP conversational markers (e.g., "Hey", "Can you make", "कसा है") and metadata that belongs in other fields (e.g., strip "Class 5" if gradeLevel is Class 5).
        - gradeLevel: Mandatory "Bharat-First" mapping. You MUST map "grade X", "class X", "कक्षा X", or "Xth grade" to "Class X" format. Valid: "Class 1" to "Class 12".
        - subject: The academic subject area.
        - language: The language requested. Map to codes: hi (Hindi), en (English), bn, te, mr, ta, gu, kn, pa, ml.

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
              "topic": "<topic>",
              "gradeLevel": "<Class N>",
              "subject": "<subject>",
              "language": "<ISO code>",
              "ncertChapter": null,
              "dependsOn": []
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
 * Build a single-action `plannedActions` plan from the bare intent +
 * extracted params. Used when the classifier returned a routable intent
 * but no `plannedActions` entry — the dispatcher still wants a uniform
 * iteration surface for v0.4+ clients.
 */
function synthesizePrimaryAction(
  intent: string,
  params: { topic?: string; gradeLevel?: string; subject?: string; language?: string },
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
