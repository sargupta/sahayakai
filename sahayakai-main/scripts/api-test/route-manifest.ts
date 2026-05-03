/**
 * Source of truth for every Next.js API route on the SahayakAI develop branch.
 *
 * Used by:
 *   - src/lib/openapi-spec.ts            (Swagger UI / /api/api-docs)
 *   - scripts/api-test/run-all.ts        (Programmatic endpoint exerciser)
 *   - scripts/api-test/check-coverage.ts (Asserts no route file is missed)
 *
 * If you add a new route file under src/app/api/**, also add it here.
 * `check-coverage.ts` will fail CI if you forget.
 */

export type AuthMode =
  | 'bearer' // Firebase ID token in Authorization: Bearer <jwt>
  | 'cron' // x-cron-secret header (Cloud Scheduler / Vercel Cron)
  | 'razorpay' // Razorpay-Signature header
  | 'twilio' // X-Twilio-Signature header
  | 'public' // No auth required
  | 'mixed'; // Some operations require auth, some don't

export interface EndpointSpec {
  /** Path under /api, leading slash required. Brackets denote dynamic segments. */
  path: string;
  /** HTTP method as exported in route.ts */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Section grouping for the Swagger UI tag. */
  tag: string;
  /** Short human description. */
  summary: string;
  /** Authentication / authorization expected by this endpoint. */
  auth: AuthMode;
  /** Sample query string params. */
  query?: Record<string, string | number | boolean>;
  /** Sample JSON body. Omit for GET/HEAD. */
  body?: Record<string, unknown> | string | null;
  /** Sample request content-type. Defaults to application/json when body is an object. */
  contentType?: string;
  /**
   * HTTP status codes acceptable as a "pass" when fired by the test runner.
   * Default = [200, 201, 202, 204, 401] (401 if anonymous fixture lacks token).
   */
  okStatuses?: number[];
  /**
   * Mark explicitly skipped with a reason (e.g. depends on signed Twilio callback,
   * mutates real data, requires paid quota).
   */
  skip?: string;
}

const DEFAULT_OK = [200, 201, 202, 204, 401];

/** ---- AI flow endpoints (POST /api/ai/*) ---- */
const aiEndpoints: EndpointSpec[] = [
  {
    path: '/ai/avatar',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate teacher avatar image',
    auth: 'bearer',
    body: { name: 'Anita', subject: 'science', style: 'friendly', userId: 'test-user' },
  },
  {
    path: '/ai/exam-paper',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate exam paper',
    auth: 'bearer',
    body: {
      grade: '8',
      subject: 'mathematics',
      chapters: ['ratio and proportion', 'algebra basics'],
      totalMarks: 50,
      duration: 90,
      language: 'en',
      userId: 'test-user',
    },
  },
  {
    path: '/ai/exam-paper',
    method: 'PUT',
    tag: 'AI',
    summary: 'Update / regenerate exam paper',
    auth: 'bearer',
    body: { paperId: 'paper-123', regenerate: true },
  },
  {
    path: '/ai/exam-paper/stream',
    method: 'POST',
    tag: 'AI',
    summary: 'Stream exam paper generation (SSE)',
    auth: 'bearer',
    body: { grade: '8', subject: 'mathematics', chapters: ['fractions'], totalMarks: 30, duration: 60 },
  },
  {
    path: '/ai/instant-answer',
    method: 'POST',
    tag: 'AI',
    summary: 'Instant Q&A with grounding',
    auth: 'bearer',
    body: { question: 'What is photosynthesis?', language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/intent',
    method: 'POST',
    tag: 'AI',
    summary: 'VIDYA intent classification',
    auth: 'bearer',
    body: { utterance: 'make me a quiz on photosynthesis', language: 'en' },
  },
  {
    path: '/ai/lesson-plan',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate lesson plan',
    auth: 'bearer',
    body: {
      grade: '5',
      subject: 'science',
      topic: 'water cycle',
      duration: 45,
      language: 'en',
      userId: 'test-user',
    },
  },
  {
    path: '/ai/lesson-plan/stream',
    method: 'POST',
    tag: 'AI',
    summary: 'Stream lesson plan generation (SSE)',
    auth: 'bearer',
    body: { grade: '5', subject: 'science', topic: 'water cycle', duration: 45, language: 'en' },
  },
  {
    path: '/ai/parent-message',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate message to parent',
    auth: 'bearer',
    body: {
      studentName: 'Ravi',
      context: 'absent for two days',
      tone: 'concerned',
      language: 'en',
      userId: 'test-user',
    },
  },
  {
    path: '/ai/quiz',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate quiz with 3 difficulty variants',
    auth: 'bearer',
    body: { topic: 'photosynthesis', grade: '6', count: 5, language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/quiz/health',
    method: 'GET',
    tag: 'AI',
    summary: 'Quiz subsystem health probe',
    auth: 'bearer',
    okStatuses: [200, 401, 503],
  },
  {
    path: '/ai/rubric',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate grading rubric',
    auth: 'bearer',
    body: { assignment: 'essay on monsoon', grade: '7', language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/teacher-training',
    method: 'POST',
    tag: 'AI',
    summary: 'Teacher training advisor',
    auth: 'bearer',
    body: { topic: 'classroom discipline strategies', language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/video-storyteller',
    method: 'POST',
    tag: 'AI',
    summary: 'Video storyteller recommendations',
    auth: 'bearer',
    body: { topic: 'water cycle', grade: '5', language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/virtual-field-trip',
    method: 'POST',
    tag: 'AI',
    summary: 'Plan a virtual field trip',
    auth: 'bearer',
    body: { destination: 'Taj Mahal', grade: '7', language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/visual-aid',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate visual aid (image)',
    auth: 'bearer',
    body: { topic: 'water cycle', grade: '5', language: 'en', userId: 'test-user' },
  },
  {
    path: '/ai/voice-to-text',
    method: 'POST',
    tag: 'AI',
    summary: 'Transcribe audio',
    auth: 'bearer',
    body: { audioBase64: 'AAAA', mimeType: 'audio/webm', language: 'en', userId: 'test-user' },
    okStatuses: [200, 400, 401, 415, 500],
  },
  {
    path: '/ai/worksheet',
    method: 'POST',
    tag: 'AI',
    summary: 'Generate worksheet',
    auth: 'bearer',
    body: { topic: 'fractions', grade: '5', language: 'en', userId: 'test-user' },
  },
];

/** ---- Auth, profile, consent ---- */
const userEndpoints: EndpointSpec[] = [
  {
    path: '/auth/profile-check',
    method: 'GET',
    tag: 'Auth',
    summary: 'Check if profile exists + onboarding complete',
    auth: 'bearer',
  },
  {
    path: '/user/consent',
    method: 'GET',
    tag: 'User',
    summary: 'Get current consent state',
    auth: 'bearer',
  },
  {
    path: '/user/consent',
    method: 'POST',
    tag: 'User',
    summary: 'Record consent',
    auth: 'bearer',
    body: { analytics: true, marketing: false },
  },
  {
    path: '/user/delete-account',
    method: 'POST',
    tag: 'User',
    summary: 'Self-serve account deletion',
    auth: 'bearer',
    body: { confirm: true },
    skip: 'Destructive: only run against a disposable test account',
  },
  {
    path: '/user/profile',
    method: 'POST',
    tag: 'User',
    summary: 'Create or update profile',
    auth: 'bearer',
    body: { name: 'Test Teacher', state: 'KA', subjects: ['math'] },
  },
  {
    path: '/user/profile',
    method: 'PATCH',
    tag: 'User',
    summary: 'Patch profile fields',
    auth: 'bearer',
    body: { language: 'hi' },
  },
  {
    path: '/usage',
    method: 'GET',
    tag: 'User',
    summary: 'Per-user usage / quota',
    auth: 'bearer',
  },
];

/** ---- Vidya assistant ---- */
const vidyaEndpoints: EndpointSpec[] = [
  {
    path: '/vidya/profile',
    method: 'GET',
    tag: 'Vidya',
    summary: 'Get Vidya assistant profile',
    auth: 'bearer',
  },
  {
    path: '/vidya/profile',
    method: 'POST',
    tag: 'Vidya',
    summary: 'Update Vidya assistant profile',
    auth: 'bearer',
    body: { voice: 'female-hi-IN', persona: 'helpful' },
  },
  {
    path: '/vidya/session',
    method: 'GET',
    tag: 'Vidya',
    summary: 'Resume current Vidya session',
    auth: 'bearer',
  },
  {
    path: '/vidya/session',
    method: 'POST',
    tag: 'Vidya',
    summary: 'Start a new Vidya session',
    auth: 'bearer',
    body: { intent: 'greet' },
  },
  {
    path: '/assistant',
    method: 'POST',
    tag: 'Vidya',
    summary: 'OmniOrb assistant entrypoint',
    auth: 'bearer',
    body: { message: 'hi', sessionId: 'session-1' },
  },
];

/** ---- Content + library ---- */
const contentEndpoints: EndpointSpec[] = [
  {
    path: '/content/delete',
    method: 'DELETE',
    tag: 'Content',
    summary: 'Delete a content item',
    auth: 'bearer',
    query: { id: 'content-123', type: 'lesson-plan' },
    skip: 'Destructive: would delete library entry',
  },
  {
    path: '/content/download',
    method: 'GET',
    tag: 'Content',
    summary: 'Download stored content (proxied)',
    auth: 'bearer',
    query: { id: 'content-123', type: 'lesson-plan' },
    okStatuses: [200, 302, 401, 404],
  },
  {
    path: '/content/get',
    method: 'GET',
    tag: 'Content',
    summary: 'Get a single content item',
    auth: 'bearer',
    query: { id: 'content-123', type: 'lesson-plan' },
    okStatuses: [200, 401, 404],
  },
  {
    path: '/content/list',
    method: 'GET',
    tag: 'Content',
    summary: 'List My Library content',
    auth: 'bearer',
    query: { limit: 20 },
  },
  {
    path: '/content/save',
    method: 'POST',
    tag: 'Content',
    summary: 'Save a generated artifact to library',
    auth: 'bearer',
    body: { type: 'lesson-plan', title: 'Test', payload: { grade: '5', topic: 'tides' } },
  },
];

/** ---- Attendance / parent calling ---- */
const attendanceEndpoints: EndpointSpec[] = [
  {
    path: '/attendance/call',
    method: 'POST',
    tag: 'Attendance',
    summary: 'Initiate Twilio outbound call to parent',
    auth: 'bearer',
    body: { studentId: 'student-1', phone: '+919999999999', reason: 'absent' },
    skip: 'Real Twilio call: only run in staging with whitelisted numbers',
  },
  {
    path: '/attendance/call-context',
    method: 'GET',
    tag: 'Attendance',
    summary: 'Get call context payload (Twilio fetches this)',
    auth: 'public',
    query: { sessionId: 'sess-1' },
    okStatuses: [200, 400, 404, 503],
  },
  {
    path: '/attendance/call-summary',
    method: 'GET',
    tag: 'Attendance',
    summary: 'Get summary of a completed call',
    auth: 'bearer',
    query: { sessionId: 'sess-1' },
    okStatuses: [200, 400, 401, 404],
  },
  {
    path: '/attendance/outreach',
    method: 'POST',
    tag: 'Attendance',
    summary: 'Trigger SMS / WhatsApp outreach',
    auth: 'bearer',
    body: { studentId: 'student-1', channel: 'sms' },
    skip: 'Sends real SMS in staging',
  },
  {
    path: '/attendance/transcript-sync',
    method: 'POST',
    tag: 'Attendance',
    summary: 'Sync ASR transcript chunk',
    auth: 'twilio',
    body: { sessionId: 'sess-1', segment: 'hello', timestamp: 1 },
    okStatuses: [200, 401, 403, 503],
  },
  {
    path: '/attendance/twiml',
    method: 'GET',
    tag: 'Attendance',
    summary: 'TwiML response for inbound leg',
    auth: 'twilio',
    okStatuses: [200, 401, 403],
  },
  {
    path: '/attendance/twiml',
    method: 'POST',
    tag: 'Attendance',
    summary: 'TwiML response (POSTed by Twilio)',
    auth: 'twilio',
    body: 'CallSid=CAtest&From=%2B19999999999&To=%2B19998888888',
    contentType: 'application/x-www-form-urlencoded',
    okStatuses: [200, 401, 403],
  },
  {
    path: '/attendance/twiml-status',
    method: 'POST',
    tag: 'Attendance',
    summary: 'Twilio call-status callback',
    auth: 'twilio',
    body: 'CallSid=CAtest&CallStatus=completed',
    contentType: 'application/x-www-form-urlencoded',
    okStatuses: [200, 401, 403],
  },
];

/** ---- Billing / Razorpay ---- */
const billingEndpoints: EndpointSpec[] = [
  {
    path: '/billing/callback',
    method: 'GET',
    tag: 'Billing',
    summary: 'Razorpay redirect callback',
    auth: 'public',
    query: { razorpay_payment_id: 'pay_test', razorpay_subscription_id: 'sub_test' },
    okStatuses: [200, 302, 400],
  },
  {
    path: '/billing/cancel',
    method: 'POST',
    tag: 'Billing',
    summary: 'Cancel subscription',
    auth: 'bearer',
    body: {},
  },
  {
    path: '/billing/create-public-subscription',
    method: 'POST',
    tag: 'Billing',
    summary: 'Create public subscription (pre-auth flow)',
    auth: 'public',
    body: { plan: 'pro_monthly', email: 'test@example.com' },
    okStatuses: [200, 400, 429],
  },
  {
    path: '/billing/create-subscription',
    method: 'POST',
    tag: 'Billing',
    summary: 'Create subscription for authenticated user',
    auth: 'bearer',
    body: { plan: 'pro_monthly' },
  },
  {
    path: '/webhooks/razorpay',
    method: 'POST',
    tag: 'Webhooks',
    summary: 'Razorpay webhook (signed)',
    auth: 'razorpay',
    body: { event: 'subscription.charged', payload: {} },
    okStatuses: [200, 400, 401],
  },
];

/** ---- Cron jobs ---- */
const jobsEndpoints: EndpointSpec[] = [
  { path: '/jobs/ai-community-agent', method: 'POST', tag: 'Jobs', summary: 'AI community-agent cron tick', auth: 'cron', body: {} },
  { path: '/jobs/ai-reactive-reply', method: 'POST', tag: 'Jobs', summary: 'AI reactive-reply cron tick', auth: 'cron', body: {} },
  { path: '/jobs/billing-reconciliation', method: 'POST', tag: 'Jobs', summary: 'Billing reconciliation (POST)', auth: 'cron', body: {} },
  { path: '/jobs/billing-reconciliation', method: 'GET', tag: 'Jobs', summary: 'Billing reconciliation status (GET)', auth: 'cron' },
  { path: '/jobs/community-chat-cleanup', method: 'POST', tag: 'Jobs', summary: 'Community chat cleanup cron', auth: 'cron', body: {} },
  {
    path: '/jobs/daily-briefing',
    method: 'POST',
    tag: 'Jobs',
    summary: 'Daily briefing cron',
    auth: 'cron',
    body: {},
    skip: 'Long-running cron (~minutes); run via Cloud Scheduler in staging',
  },
  {
    path: '/jobs/edu-news',
    method: 'POST',
    tag: 'Jobs',
    summary: 'Edu news cron',
    auth: 'cron',
    body: {},
    skip: 'Long-running cron (~minutes); fetches RSS + LLM summarisation',
  },
  { path: '/jobs/export-reminder', method: 'POST', tag: 'Jobs', summary: 'Export reminder cron', auth: 'cron', body: {} },
  { path: '/jobs/grow-persona-pool', method: 'POST', tag: 'Jobs', summary: 'Grow community persona pool cron', auth: 'cron', body: {} },
  { path: '/jobs/storage-cleanup', method: 'POST', tag: 'Jobs', summary: 'Storage cleanup cron', auth: 'cron', body: {} },
];

/** ---- Org / analytics / performance ---- */
const orgEndpoints: EndpointSpec[] = [
  { path: '/organizations', method: 'GET', tag: 'Organizations', summary: 'List orgs the user belongs to', auth: 'bearer' },
  { path: '/organizations', method: 'POST', tag: 'Organizations', summary: 'Create org', auth: 'bearer', body: { name: 'Test School', tier: 'free' } },
  {
    path: '/organizations/[orgId]/analytics',
    method: 'GET',
    tag: 'Organizations',
    summary: 'Org analytics dashboard data',
    auth: 'bearer',
    query: { orgId: 'org-test' },
  },
  { path: '/organizations/invite', method: 'POST', tag: 'Organizations', summary: 'Invite teacher to org', auth: 'bearer', body: { orgId: 'org-test', email: 'a@b.com' } },
  { path: '/organizations/remove', method: 'POST', tag: 'Organizations', summary: 'Remove member from org', auth: 'bearer', body: { orgId: 'org-test', uid: 'uid-1' } },
  { path: '/analytics/seed', method: 'POST', tag: 'Analytics', summary: 'Seed analytics fixtures (dev only)', auth: 'bearer', body: {}, skip: 'Dev-only seed; mutates analytics store' },
  {
    path: '/analytics/teacher-health/[userId]',
    method: 'GET',
    tag: 'Analytics',
    summary: 'Teacher health score',
    auth: 'bearer',
    query: { userId: 'uid-test' },
  },
  { path: '/performance/batch', method: 'POST', tag: 'Performance', summary: 'Batch student performance ingest', auth: 'bearer', body: { records: [] } },
  { path: '/performance/batch', method: 'GET', tag: 'Performance', summary: 'List performance batches', auth: 'bearer' },
  {
    path: '/performance/student/[studentId]',
    method: 'GET',
    tag: 'Performance',
    summary: 'Per-student performance',
    auth: 'bearer',
    query: { studentId: 'student-1' },
  },
  { path: '/teacher-activity', method: 'POST', tag: 'Analytics', summary: 'Record teacher activity event', auth: 'bearer', body: { event: 'login' } },
];

/** ---- Misc / infra ---- */
const miscEndpoints: EndpointSpec[] = [
  { path: '/api-docs', method: 'GET', tag: 'Meta', summary: 'OpenAPI spec for this app', auth: 'public' },
  { path: '/health', method: 'GET', tag: 'Meta', summary: 'Liveness probe', auth: 'public' },
  { path: '/metrics', method: 'POST', tag: 'Meta', summary: 'Internal metrics ingest', auth: 'bearer', body: { name: 'event', value: 1 } },
  { path: '/feedback', method: 'POST', tag: 'Meta', summary: 'User feedback submission', auth: 'bearer', body: { rating: 5, message: 'great' } },
  { path: '/tts', method: 'POST', tag: 'Meta', summary: 'Text-to-speech (Google Cloud TTS)', auth: 'bearer', body: { text: 'hello', language: 'en', voice: 'Neural2' } },
  { path: '/config/flags', method: 'GET', tag: 'Meta', summary: 'Feature flag plane', auth: 'bearer' },
  { path: '/fcm/register', method: 'POST', tag: 'Meta', summary: 'Register FCM device token', auth: 'bearer', body: { token: 'fcm-token-test', platform: 'web' } },
  {
    path: '/migrate-ncert',
    method: 'GET',
    tag: 'Meta',
    summary: 'NCERT corpus migration (one-shot, admin only)',
    auth: 'bearer',
    skip: 'One-shot admin endpoint',
  },
  { path: '/sarkar/verify', method: 'POST', tag: 'Meta', summary: 'Sarkar verification', auth: 'bearer', body: { documentId: 'doc-test' } },
  {
    path: '/export',
    method: 'POST',
    tag: 'Meta',
    summary: 'Trigger data export',
    auth: 'bearer',
    body: { format: 'json' },
    skip: 'Long-running export pipeline; tested separately end-to-end',
  },
  { path: '/export', method: 'GET', tag: 'Meta', summary: 'List exports', auth: 'bearer' },
  { path: '/export/status', method: 'GET', tag: 'Meta', summary: 'Export job status', auth: 'bearer', query: { id: 'export-1' } },
];

export const NEXT_ENDPOINTS: EndpointSpec[] = [
  ...aiEndpoints,
  ...userEndpoints,
  ...vidyaEndpoints,
  ...contentEndpoints,
  ...attendanceEndpoints,
  ...billingEndpoints,
  ...jobsEndpoints,
  ...orgEndpoints,
  ...miscEndpoints,
];

/** Sidecar (FastAPI) — auto-discovered at runtime via /openapi.json. */
export const SIDECAR_DEFAULT_BODIES: Record<string, Record<string, unknown>> = {
  '/v1/parent-call/reply': { sessionId: 'sess-test', utterance: 'I will call back', language: 'en' },
  '/v1/parent-call/summary': { sessionId: 'sess-test' },
  '/v1/lesson-plan/generate': { grade: '5', subject: 'science', topic: 'water cycle', duration: 45, language: 'en', userId: 'test-user' },
  '/v1/vidya/orchestrate': { utterance: 'create a quiz on photosynthesis', language: 'en', userId: 'test-user' },
  '/v1/instant-answer/answer': { question: 'What is photosynthesis?', language: 'en', userId: 'test-user' },
  '/v1/parent-message/generate': { studentName: 'Ravi', context: 'absent for two days', tone: 'concerned', language: 'en', userId: 'test-user' },
  '/v1/rubric/generate': { assignment: 'essay on monsoon', grade: '7', language: 'en', userId: 'test-user' },
  '/v1/teacher-training/advise': { topic: 'classroom discipline strategies', language: 'en', userId: 'test-user' },
  '/v1/virtual-field-trip/plan': { destination: 'Taj Mahal', grade: '7', language: 'en', userId: 'test-user' },
  '/v1/worksheet/generate': { topic: 'fractions', grade: '5', language: 'en', userId: 'test-user' },
  '/v1/quiz/generate': { topic: 'photosynthesis', grade: '6', count: 5, language: 'en', userId: 'test-user' },
  '/v1/exam-paper/generate': { grade: '8', subject: 'mathematics', chapters: ['fractions'], totalMarks: 50, duration: 90, language: 'en', userId: 'test-user' },
  '/v1/visual-aid/generate': { topic: 'water cycle', grade: '5', language: 'en', userId: 'test-user' },
  '/v1/video-storyteller/recommend-queries': { topic: 'water cycle', grade: '5', language: 'en', userId: 'test-user' },
  '/v1/avatar-generator/generate': { name: 'Anita', subject: 'science', style: 'friendly', userId: 'test-user' },
  '/v1/voice-to-text/transcribe': { audioBase64: 'AAAA', mimeType: 'audio/webm', language: 'en', userId: 'test-user' },
  '/v1/vidya-voice/start-session': { language: 'en', userId: 'test-user' },
};
