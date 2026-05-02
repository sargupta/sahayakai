/**
 * HTTP client for quiz generator ADK agent (Phase E.1).
 * Returns 3-variant `QuizVariantsResponse` (easy / medium / hard,
 * any of which may be null).
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { signRequest } from './signing';

export class QuizSidecarConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'QuizSidecarConfigError'; }
}
export class QuizSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Quiz sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'QuizSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}
export class QuizSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Quiz sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'QuizSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}
export class QuizSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Quiz sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'QuizSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export type QuizQuestionType =
  | 'multiple_choice' | 'fill_in_the_blanks' | 'short_answer' | 'true_false';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface SidecarQuizQuestion {
  questionText: string;
  questionType: QuizQuestionType;
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
  difficultyLevel: QuizDifficulty;
}

export interface SidecarQuizVariant {
  title: string;
  questions: SidecarQuizQuestion[];
  teacherInstructions: string | null;
  gradeLevel: string | null;
  subject: string | null;
}

export interface SidecarQuizRequest {
  topic: string;
  imageDataUri?: string | null;
  numQuestions?: number;
  questionTypes: QuizQuestionType[];
  gradeLevel?: string | null;
  language?: string | null;
  bloomsTaxonomyLevels?: string[] | null;
  targetDifficulty?: QuizDifficulty | null;
  subject?: string | null;
  teacherContext?: string | null;
  userId: string;
}

export interface SidecarQuizResponse {
  easy: SidecarQuizVariant | null;
  medium: SidecarQuizVariant | null;
  hard: SidecarQuizVariant | null;
  gradeLevel: string | null;
  subject: string | null;
  topic: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
  variantsGenerated: number;
}

const TIMEOUT_MS = 45_000; // 3 parallel calls, multimodal — large budget
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';
const tokenClientByAudience = new Map<string, Promise<IdTokenClient>>();

async function getTokenClient(audience: string): Promise<IdTokenClient> {
  let cached = tokenClientByAudience.get(audience);
  if (!cached) {
    const auth = new GoogleAuth();
    const p = auth.getIdTokenClient(audience);
    p.catch(() => tokenClientByAudience.delete(audience));
    tokenClientByAudience.set(audience, p);
    cached = p;
  }
  return cached;
}

export function _resetQuizTokenCacheForTest(): void { tokenClientByAudience.clear(); }

export interface CallSidecarQuizOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function callSidecarQuiz(
  request: SidecarQuizRequest,
  options: CallSidecarQuizOptions = {},
): Promise<SidecarQuizResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) throw new QuizSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience) throw new QuizSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/quiz/generate`;
  const rawBody = JSON.stringify(request);
  const { timestamp, digest } = await signRequest(rawBody);
  const tokenClient = await getTokenClient(audience);
  const authHeaders = await tokenClient.getRequestHeaders();
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'X-Content-Digest': digest,
        'X-Request-Timestamp': timestamp,
      },
      body: rawBody,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new QuizSidecarTimeoutError(Date.now() - startedAt);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const excerpt = text.slice(0, 500);
    if (res.status === 502 && /behavioural\s+guard/i.test(text)) {
      const axisMatch = text.match(/\(([a-z_]+)\)/i);
      throw new QuizSidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new QuizSidecarHttpError(res.status, excerpt);
  }
  return (await res.json()) as SidecarQuizResponse;
}
