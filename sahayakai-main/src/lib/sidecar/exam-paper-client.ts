/**
 * HTTP client for exam paper generator ADK agent (Phase E.2).
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { newRequestId, signRequest } from './signing';

export class ExamPaperSidecarConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'ExamPaperSidecarConfigError'; }
}
export class ExamPaperSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Exam-paper sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'ExamPaperSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}
export class ExamPaperSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Exam-paper sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'ExamPaperSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}
export class ExamPaperSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Exam-paper sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'ExamPaperSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarExamPaperQuestion {
  number: number;
  text: string;
  marks: number;
  options?: string[] | null;
  internalChoice?: string | null;
  answerKey?: string | null;
  markingScheme?: string | null;
  source: string;
}

export interface SidecarExamPaperSection {
  name: string;
  label: string;
  totalMarks: number;
  questions: SidecarExamPaperQuestion[];
}

export interface SidecarBlueprintSummary {
  chapterWise: Array<{ chapter: string; marks: number }>;
  difficultyWise: Array<{ level: string; percentage: number }>;
}

export interface SidecarPYQSource {
  id: string;
  year?: number | null;
  chapter?: string | null;
}

export interface SidecarExamPaperRequest {
  board: string;
  gradeLevel: string;
  subject: string;
  chapters: string[];
  duration?: number | null;
  maxMarks?: number | null;
  language: string;
  difficulty: 'easy' | 'moderate' | 'hard' | 'mixed';
  includeAnswerKey: boolean;
  includeMarkingScheme: boolean;
  teacherContext?: string | null;
  userId: string;
}

export interface SidecarExamPaperResponse {
  title: string;
  board: string;
  subject: string;
  gradeLevel: string;
  duration: string;
  maxMarks: number;
  generalInstructions: string[];
  sections: SidecarExamPaperSection[];
  blueprintSummary: SidecarBlueprintSummary;
  pyqSources: SidecarPYQSource[] | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

const TIMEOUT_MS = 30_000; // exam paper output is large; allow generous tail
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
export function _resetExamPaperTokenCacheForTest(): void { tokenClientByAudience.clear(); }

export interface CallSidecarExamPaperOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
}

export async function callSidecarExamPaper(
  request: SidecarExamPaperRequest,
  options: CallSidecarExamPaperOptions = {},
): Promise<SidecarExamPaperResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) throw new ExamPaperSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience) throw new ExamPaperSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/exam-paper/generate`;
  const rawBody = JSON.stringify(request);
  const { timestamp, digest } = await signRequest(rawBody);
  const tokenClient = await getTokenClient(audience);
  const authHeaders = await tokenClient.getRequestHeaders();
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? newRequestId();
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
        'X-Request-ID': requestId,
      },
      body: rawBody,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ExamPaperSidecarTimeoutError(Date.now() - startedAt);
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
      throw new ExamPaperSidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new ExamPaperSidecarHttpError(res.status, excerpt);
  }
  return (await res.json()) as SidecarExamPaperResponse;
}
