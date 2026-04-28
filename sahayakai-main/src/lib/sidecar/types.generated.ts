// GENERATED FROM sahayakai-agents FastAPI OpenAPI spec.
// DO NOT EDIT. Regenerate via `python scripts/codegen_ts.py`.
//
// Source of truth: Pydantic models in sahayakai-agents/src/sahayakai_agents/
// agents/*/schemas.py. TypeScript interfaces are emitted from those
// models for consumption by the Next.js sidecar clients.
//
// Phase N.2 — Forensic audit P1 #22. The hand-typed `Sidecar*Request`
// and `Sidecar*Response` shapes drifted from Python (most visibly
// `VidyaActionParams.topic` was required nullable in TS, optional in
// Python). Use these generated types in new code.

export interface Activity {
  phase: 'Engage' | 'Explore' | 'Explain' | 'Elaborate' | 'Evaluate';
  name: string;
  description: string;
  duration: string;
  teacherTips?: string | null;
  understandingCheck?: string | null;
}

/**
 * Request body for POST /v1/parent-call/reply.
 */
export interface AgentReplyRequest {
  callSid: string;
  turnNumber: number;
  studentName: string;
  className: string;
  subject: string;
  reason: string;
  teacherMessage: string;
  teacherName?: string | null;
  schoolName?: string | null;
  parentLanguage: 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'pa' | 'ml' | 'or';
  parentSpeech: string;
  performanceSummary?: string | null;
  transcript?: TranscriptTurn[] | null;
}

/**
 * Response for POST /v1/parent-call/reply. Superset of the TS contract.
 *
 * New (additive, non-breaking) fields:
 * - `sessionId` — echoes callSid for observability.
 * - `latencyMs` — end-to-end sidecar latency.
 * - `modelUsed` — e.g. "gemini-2.5-flash".
 * - `cacheHitRatio` — implicit-cache observability.
 */
export interface AgentReplyResponse {
  reply: string;
  shouldEndCall: boolean;
  followUpQuestion?: string | null;
  sessionId: string;
  turnNumber: number;
  latencyMs: number;
  modelUsed: string;
  cacheHitRatio?: number | null;
}

/**
 * Request body for `POST /v1/avatar-generator/generate`.
 *
 * `name` is treated as untrusted user-controlled input. It is wrapped
 * in `⟦…⟧` markers in the rendered prompt so the model does not
 * interpret display names that contain instruction-like phrases.
 */
export interface AvatarGeneratorRequest {
  name: string;
  userId: string;
}

/**
 * Response for `POST /v1/avatar-generator/generate`.
 *
 * `imageDataUri` is the standard `data:image/<subtype>;base64,<body>`
 * form expected by the Next.js client. Storage write happens in
 * Next.js after the sidecar returns.
 */
export interface AvatarGeneratorResponse {
  imageDataUri: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

export interface BlueprintChapterEntry {
  chapter: string;
  marks: number;
}

export interface BlueprintDifficultyEntry {
  level: string;
  percentage: number;
}

export interface BlueprintSummary {
  chapterWise: BlueprintChapterEntry[];
  difficultyWise: BlueprintDifficultyEntry[];
}

/**
 * Request body for POST /v1/parent-call/summary.
 */
export interface CallSummaryRequest {
  callSid: string;
  studentName: string;
  className: string;
  subject: string;
  reason: string;
  teacherMessage: string;
  teacherName?: string | null;
  schoolName?: string | null;
  parentLanguage: 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'pa' | 'ml' | 'or';
  transcript: TranscriptTurn[];
  callDurationSeconds?: number | null;
}

/**
 * Summary output. Every text field is English regardless of `parentLanguage`
 * (the review's P1 #18 test enforces this).
 */
export interface CallSummaryResponse {
  parentResponse: string;
  parentConcerns?: string[];
  parentCommitments?: string[];
  actionItemsForTeacher?: string[];
  guidanceGiven?: string[];
  parentSentiment: 'cooperative' | 'concerned' | 'grateful' | 'upset' | 'indifferent' | 'confused';
  callQuality: 'productive' | 'brief' | 'difficult' | 'unanswered';
  followUpNeeded: boolean;
  followUpSuggestion?: string | null;
  sessionId: string;
  latencyMs: number;
  modelUsed: string;
  cacheHitRatio?: number | null;
}

/**
 * One conversation turn. Mirrors the Genkit-style `{ role, parts }`
 * shape that VIDYA's OmniOrb client sends today.
 */
export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatMessagePart[];
}

/**
 * A single text fragment inside a chat message.
 */
export interface ChatMessagePart {
  text: string;
}

/**
 * What the evaluator agent returns. The router uses these fields
 * to decide whether to: pass v1, revise, or hard-fail.
 *
 * Round-2 audit P1 PLAN-3 fix: `safety` is a separate boolean (not
 * a float-with-1.0-only gate). Quality axes float in [0, 1]; safety
 * is binary.
 */
export interface EvaluatorVerdict {
  scores: RubricScores;
  safety: boolean;
  rationale: string;
  fail_reasons?: string[];
}

/**
 * One question on the paper.
 */
export interface ExamPaperQuestion {
  number: number;
  text: string;
  marks: number;
  options?: string[] | null;
  internalChoice?: string | null;
  answerKey?: string | null;
  markingScheme?: string | null;
  source?: string;
}

/**
 * Request body for `POST /v1/exam-paper/generate`.
 */
export interface ExamPaperRequest {
  board: string;
  gradeLevel: string;
  subject: string;
  chapters?: string[];
  duration?: number | null;
  maxMarks?: number | null;
  language?: string;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'mixed';
  includeAnswerKey?: boolean;
  includeMarkingScheme?: boolean;
  teacherContext?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/exam-paper/generate`.
 */
export interface ExamPaperResponse {
  title: string;
  board: string;
  subject: string;
  gradeLevel: string;
  duration: string;
  maxMarks: number;
  generalInstructions: string[];
  sections: ExamPaperSection[];
  blueprintSummary: BlueprintSummary;
  pyqSources?: PYQSource[] | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * One section of the paper (e.g. Section A — MCQs).
 */
export interface ExamPaperSection {
  name: string;
  label: string;
  totalMarks: number;
  questions: ExamPaperQuestion[];
}

/**
 * Request body for POST /v1/instant-answer/answer.
 *
 * The Next.js route handler does the auth, rate-limit, safety-check,
 * profile lookup, and length cap BEFORE the dispatcher forwards to
 * the sidecar. By the time this body lands here:
 *
 * - `question` is bounded to 4000 chars (Wave 2 cap)
 * - `userId` is the authenticated teacher (always present on the
 *   sidecar wire — anonymous calls are rejected upstream)
 * - `language` and `gradeLevel` are normalised (`hi` not `Hindi`,
 *   `Class 5` not `5th`)
 */
export interface InstantAnswerRequest {
  question: string;
  language?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  userId: string;
}

/**
 * Response for POST /v1/instant-answer/answer.
 *
 * Parity fields match the TS `InstantAnswerOutputSchema` verbatim;
 * additive sidecar telemetry follows.
 */
export interface InstantAnswerResponse {
  answer: string;
  videoSuggestionUrl?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
  groundingUsed: boolean;
}

export interface KeyVocabulary {
  term: string;
  meaning: string;
}

/**
 * Request body for POST /v1/lesson-plan/generate.
 *
 * Mirrors `LessonPlanInputSchema` in TS verbatim. Optional fields
 * follow the TS shape (string-typed) — no enum coercion at the edge.
 */
export interface LessonPlanRequest {
  topic: string;
  language?: 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'pa' | 'ml' | 'or' | null;
  gradeLevels?: string[] | null;
  imageDataUri?: string | null;
  userId: string;
  teacherContext?: string | null;
  useRuralContext?: boolean | null;
  ncertChapter?: NcertChapter | null;
  resourceLevel?: 'low' | 'medium' | 'high' | null;
  difficultyLevel?: 'remedial' | 'standard' | 'advanced' | null;
  subject?: string | null;
}

/**
 * Response for POST /v1/lesson-plan/generate.
 *
 * Same superset shape as parent-call: parity fields match TS verbatim,
 * plus additive sidecar telemetry.
 */
export interface LessonPlanResponse {
  title: string;
  gradeLevel?: string | null;
  duration?: string | null;
  subject?: string | null;
  objectives: string[];
  keyVocabulary?: KeyVocabulary[] | null;
  materials?: string[];
  activities: Activity[];
  assessment?: string | null;
  homework?: string | null;
  language?: string | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
  cacheHitRatio?: number | null;
  revisionsRun: number;
  rubric: EvaluatorVerdict;
}

/**
 * Optional NCERT chapter alignment hint passed by the client.
 */
export interface NcertChapter {
  title: string;
  number: number;
  subject?: string | null;
  learningOutcomes?: string[];
}

/**
 * Optional NCERT chapter reference attached to a navigation action.
 */
export interface NcertChapterRef {
  number: number;
  title: string;
  learningOutcomes?: string[];
}

/**
 * Prior-year-question attribution entry.
 */
export interface PYQSource {
  id: string;
  year?: number | null;
  chapter?: string | null;
}

/**
 * Request body for `POST /v1/parent-message/generate`.
 *
 * Mirrors `ParentMessageInputSchema` in TS verbatim. Bounded fields
 * so a hostile client can't exhaust prompt budget.
 */
export interface ParentMessageRequest {
  studentName: string;
  className: string;
  subject: string;
  reason: 'consecutive_absences' | 'poor_performance' | 'behavioral_concern' | 'positive_feedback';
  reasonContext?: string | null;
  teacherNote?: string | null;
  parentLanguage: 'English' | 'Hindi' | 'Tamil' | 'Telugu' | 'Kannada' | 'Malayalam' | 'Bengali' | 'Marathi' | 'Gujarati' | 'Punjabi' | 'Odia';
  consecutiveAbsentDays?: number | null;
  teacherName?: string | null;
  schoolName?: string | null;
  performanceContext?: PerformanceContext | null;
  performanceSummary?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/parent-message/generate`.
 *
 * Parity fields match the TS `ParentMessageOutputSchema` exactly;
 * additive sidecar telemetry follows.
 */
export interface ParentMessageResponse {
  message: string;
  languageCode: string;
  wordCount: number;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * Snapshot of recent academic performance — populated by the
 * Contact-Parent modal so the model can cite specific scores when
 * `reason == 'poor_performance'` or `'positive_feedback'`.
 */
export interface PerformanceContext {
  latestPercentage?: number | null;
  isAtRisk?: boolean | null;
  subjectBreakdown?: SubjectAssessment[] | null;
}

/**
 * Request body for `POST /v1/quiz/generate`.
 *
 * Returns a `QuizVariantsResponse` with three difficulty variants
 * (easy / medium / hard), each generated in parallel server-side.
 */
export interface QuizGeneratorRequest {
  topic: string;
  imageDataUri?: string | null;
  numQuestions?: number;
  questionTypes: ('multiple_choice' | 'fill_in_the_blanks' | 'short_answer' | 'true_false')[];
  gradeLevel?: string | null;
  language?: string | null;
  bloomsTaxonomyLevels?: string[] | null;
  targetDifficulty?: 'easy' | 'medium' | 'hard' | null;
  subject?: string | null;
  teacherContext?: string | null;
  userId: string;
}

/**
 * Single-variant response (used internally; Variants response is
 * the wire shape).
 */
export interface QuizGeneratorResponse {
  title: string;
  questions: QuizQuestion[];
  teacherInstructions?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
}

/**
 * One quiz question.
 */
export interface QuizQuestion {
  questionText: string;
  questionType: 'multiple_choice' | 'fill_in_the_blanks' | 'short_answer' | 'true_false';
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
  difficultyLevel: 'easy' | 'medium' | 'hard';
}

/**
 * The wire response for `POST /v1/quiz/generate`. Three optional
 * variants — any of them may be `None` if the model failed for that
 * difficulty (matches the existing Genkit Promise.allSettled
 * pattern).
 */
export interface QuizVariantsResponse {
  easy?: QuizGeneratorResponse | null;
  medium?: QuizGeneratorResponse | null;
  hard?: QuizGeneratorResponse | null;
  gradeLevel?: string | null;
  subject?: string | null;
  topic: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
  variantsGenerated: number;
}

/**
 * One evaluation criterion + its 4 performance levels.
 */
export interface RubricCriterion {
  name: string;
  description: string;
  levels: RubricLevel[];
}

/**
 * Request body for `POST /v1/rubric/generate`.
 */
export interface RubricGeneratorRequest {
  assignmentDescription: string;
  gradeLevel?: string | null;
  subject?: string | null;
  language?: string | null;
  teacherContext?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/rubric/generate`.
 */
export interface RubricGeneratorResponse {
  title: string;
  description: string;
  criteria: RubricCriterion[];
  gradeLevel?: string | null;
  subject?: string | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * One performance level for a criterion (e.g. Exemplary / 4 pts).
 */
export interface RubricLevel {
  name: string;
  description: string;
  points: number;
}

/**
 * The 7 quality axes from §Pedagogical Rubric. Each is a float
 * [0, 1]. The evaluator agent emits this shape AND a separate
 * boolean `safety` field — see `EvaluatorVerdict` below.
 */
export interface RubricScores {
  grade_level_alignment: number;
  objective_assessment_match: number;
  resource_level_realism: number;
  language_naturalness: number;
  scaffolding_present: number;
  inclusion_signals: number;
  cultural_appropriateness: number;
}

/**
 * Where the teacher currently is in the app.
 *
 * `uiState` is bounded so an attacker can't blow up the prompt by
 * cramming arbitrary form state into the request — string keys, string
 * values, max 20 entries.
 */
export interface ScreenContext {
  path: string;
  uiState?: Record<string, string> | null;
}

/**
 * One row of the recent-assessments breakdown.
 */
export interface SubjectAssessment {
  subject: string;
  name: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  date: string;
}

/**
 * Long-term teacher memory injected into the prompt.
 *
 * All optional — a brand-new teacher has none of these populated.
 * Strings are bounded so a maliciously-large schoolContext cannot
 * bloat the prompt context window.
 */
export interface TeacherProfile {
  preferredGrade?: string | null;
  preferredSubject?: string | null;
  preferredLanguage?: string | null;
  schoolContext?: string | null;
}

/**
 * One advice point with explicit pedagogical grounding.
 */
export interface TeacherTrainingAdvicePoint {
  strategy: string;
  pedagogy: string;
  explanation: string;
}

/**
 * Request body for `POST /v1/teacher-training/advise`.
 */
export interface TeacherTrainingRequest {
  question: string;
  language?: string | null;
  subject?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/teacher-training/advise`.
 */
export interface TeacherTrainingResponse {
  introduction: string;
  advice: TeacherTrainingAdvicePoint[];
  conclusion: string;
  gradeLevel?: string | null;
  subject?: string | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * One utterance inside a call transcript.
 */
export interface TranscriptTurn {
  role: 'agent' | 'parent';
  text: string;
}

/**
 * Five search-query categories.
 */
export interface VideoStorytellerCategories {
  pedagogy: string[];
  storytelling: string[];
  govtUpdates: string[];
  courses: string[];
  topRecommended: string[];
}

/**
 * Request body for `POST /v1/video-storyteller/recommend-queries`.
 */
export interface VideoStorytellerRequest {
  subject: string;
  gradeLevel: string;
  topic?: string | null;
  language?: string | null;
  state?: string | null;
  educationBoard?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/video-storyteller/recommend-queries`.
 */
export interface VideoStorytellerResponse {
  categories: VideoStorytellerCategories;
  personalizedMessage: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * A navigation directive returned to the OmniOrb client.
 *
 * The client interprets `flow` as a route name and `params` as the
 * URL query string — same surface as the existing `processAgentRequest`
 * return shape. `type` is fixed today (only `NAVIGATE_AND_FILL`) but
 * Literal-typed so future action kinds (e.g. `OPEN_DIALOG`) extend the
 * enum without breaking the wire contract.
 */
export interface VidyaAction {
  type: 'NAVIGATE_AND_FILL';
  flow: 'lesson-plan' | 'quiz-generator' | 'visual-aid-designer' | 'worksheet-wizard' | 'virtual-field-trip' | 'teacher-training' | 'rubric-generator' | 'exam-paper' | 'video-storyteller';
  params: VidyaActionParams;
}

/**
 * Parameters the action prefills on the destination screen.
 *
 * All optional — the orchestrator extracts whatever it can from the
 * teacher's utterance + context. Missing values fall through to the
 * destination flow's own defaults.
 */
export interface VidyaActionParams {
  topic?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  language?: string | null;
  ncertChapter?: NcertChapterRef | null;
}

/**
 * Request body for POST /v1/vidya/orchestrate.
 *
 * Mirrors the JSON body that `/api/assistant` accepts today
 * (`message`, `chatHistory`, `currentScreenContext`, `teacherProfile`,
 * `detectedLanguage`). Every field is bounded so a hostile client
 * can't exhaust prompt budget.
 *
 * Phase L.2 — `userId` is now required. The previous `_run_answerer`
 * delegation hard-coded `userId="vidya-supervisor"` because VIDYA's
 * request had no real uid; that placeholder blocked per-user rate
 * limiting + observability. The Next.js `/api/assistant` route is
 * auth'd upstream and now forwards the verified uid here.
 */
export interface VidyaRequest {
  message: string;
  chatHistory?: ChatMessage[];
  currentScreenContext: ScreenContext;
  teacherProfile: TeacherProfile;
  detectedLanguage?: string | null;
  userId: string;
}

/**
 * Response for POST /v1/vidya/orchestrate.
 *
 * `action` is None for `instantAnswer` / `unknown`; populated for the
 * 9 routable flows. The OmniOrb client renders `response` (always set)
 * and dispatches the navigation if `action` is present.
 */
export interface VidyaResponse {
  response: string;
  action?: VidyaAction | null;
  intent: string;
  sidecarVersion: string;
  latencyMs: number;
  followUpSuggestion?: string | null;
}

/**
 * Request body for `POST /v1/virtual-field-trip/plan`.
 */
export interface VirtualFieldTripRequest {
  topic: string;
  language?: string | null;
  gradeLevel?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/virtual-field-trip/plan`.
 */
export interface VirtualFieldTripResponse {
  title: string;
  stops: VirtualFieldTripStop[];
  gradeLevel: string;
  subject: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * One stop on the virtual field trip.
 */
export interface VirtualFieldTripStop {
  name: string;
  description: string;
  educationalFact: string;
  reflectionPrompt: string;
  googleEarthUrl: string;
  culturalAnalogy: string;
  explanation: string;
}

/**
 * Request body for `POST /v1/visual-aid/generate`.
 */
export interface VisualAidRequest {
  prompt: string;
  language?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/visual-aid/generate`.
 *
 * `imageDataUri` is a `data:image/...;base64,...` URI containing the
 * chalkboard-style illustration. The frontend renders it directly.
 */
export interface VisualAidResponse {
  imageDataUri: string;
  pedagogicalContext: string;
  discussionSpark: string;
  subject: string;
  sidecarVersion: string;
  latencyMs: number;
  imageModelUsed: string;
  metadataModelUsed: string;
}

/**
 * Request body for `POST /v1/voice-to-text/transcribe`.
 *
 * `audioDataUri` is the standard `data:<mime>;base64,<body>` form.
 * The router parses out the MIME + bytes, validates size, and feeds
 * the bytes to Gemini via `Part.from_bytes`.
 */
export interface VoiceToTextRequest {
  audioDataUri: string;
  userId: string;
}

/**
 * Response for `POST /v1/voice-to-text/transcribe`.
 */
export interface VoiceToTextResponse {
  text: string;
  language?: string | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

/**
 * One activity in the worksheet.
 */
export interface WorksheetActivity {
  type: 'question' | 'puzzle' | 'creative_task';
  content: string;
  explanation: string;
  chalkboardNote?: string | null;
}

/**
 * One answer-key entry.
 */
export interface WorksheetAnswerKeyEntry {
  activityIndex: number;
  answer: string;
}

/**
 * Request body for `POST /v1/worksheet/generate`.
 */
export interface WorksheetRequest {
  imageDataUri: string;
  prompt: string;
  language?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  teacherContext?: string | null;
  userId: string;
}

/**
 * Response for `POST /v1/worksheet/generate`.
 */
export interface WorksheetResponse {
  title: string;
  gradeLevel: string;
  subject: string;
  learningObjectives: string[];
  studentInstructions: string;
  activities: WorksheetActivity[];
  answerKey: WorksheetAnswerKeyEntry[];
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}
