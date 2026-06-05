/**
 * HTTP client for the sahayakai-agents assignment-assessor ADK agent.
 *
 * Same auth + signing pattern as the other ADK agent clients
 * (parent-message / quiz / lesson-plan). The assessor is the slowest
 * single call in the sidecar (multimodal vision + 5-stage chain-of-
 * thought on `gemini-2.5-pro`), so the client-side timeout is 60s by
 * default — matches the Genkit-side `withTimeout` budget. Override
 * via `ASSIGNMENT_ASSESSOR_CLIENT_TIMEOUT_MS` for production tuning
 * without a redeploy.
 *
 * Wire types are kept inline here for now — when the next codegen
 * pass runs (`sahayakai-agents/scripts/codegen_ts.py`) they should be
 * moved to `types.generated.ts` alongside the other agents.
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';

import { newRequestId, signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class AssignmentAssessorSidecarConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssignmentAssessorSidecarConfigError';
    }
}

export class AssignmentAssessorSidecarTimeoutError extends Error {
    readonly elapsedMs: number;
    constructor(elapsedMs: number) {
        super(`Assignment-assessor sidecar request timed out after ${elapsedMs}ms`);
        this.name = 'AssignmentAssessorSidecarTimeoutError';
        this.elapsedMs = elapsedMs;
    }
}

export class AssignmentAssessorSidecarHttpError extends Error {
    readonly status: number;
    readonly bodyExcerpt: string;
    constructor(status: number, bodyExcerpt: string) {
        super(
            `Assignment-assessor sidecar returned HTTP ${status}: ${bodyExcerpt}`,
        );
        this.name = 'AssignmentAssessorSidecarHttpError';
        this.status = status;
        this.bodyExcerpt = bodyExcerpt;
    }
}

export class AssignmentAssessorSidecarBehaviouralError extends Error {
    readonly axisHint: string;
    constructor(axisHint: string, details: string) {
        super(
            `Assignment-assessor sidecar behavioural guard failed (${axisHint}): ${details}`,
        );
        this.name = 'AssignmentAssessorSidecarBehaviouralError';
        this.axisHint = axisHint;
    }
}

// ─── Wire schemas (inline; move to types.generated on next codegen) ────────

export interface SidecarAssignmentRubricLevel {
    name: string;
    description: string;
    points: number;
}

export interface SidecarAssignmentRubricCriterion {
    name: string;
    description: string;
    levels: SidecarAssignmentRubricLevel[];
}

export interface SidecarAssignmentRubricSnapshot {
    title: string;
    description: string;
    criteria: SidecarAssignmentRubricCriterion[];
    gradeLevel?: string | null;
    subject?: string | null;
}

export type SidecarAssignmentMode = 'full' | 'transcribe' | 'score';

export interface SidecarAssignmentAssessorRequest {
    imageDataUri: string;
    rubricSnapshot?: SidecarAssignmentRubricSnapshot | null;
    language?: string | null;
    subject?: string | null;
    gradeLevel?: string | null;
    studentId?: string | null;
    editedTranscript?: string | null;
    mode: SidecarAssignmentMode;
    teacherContext?: string | null;
    userId: string;
}

export interface SidecarAssignmentPerCriterionScore {
    criterionName: string;
    level: string;
    points: number;
    maxPoints: number;
    feedback: string;
    confidence: number;
}

export interface SidecarAssignmentAssessorResponse {
    assessmentId: string;
    rawTranscript: string;
    editedTranscript: string | null;
    language: string;
    overallScore: number;
    pointsEarned: number;
    pointsPossible: number;
    perCriterionScores: SidecarAssignmentPerCriterionScore[];
    strengths: string[];
    improvements: string[];
    nextSteps: string[];
    teacherNote: string;
    confidenceOverall: number;
    warnings: string[];
    rubricSnapshot: SidecarAssignmentRubricSnapshot;
    studentId: string | null;
    createdAtIso: string;

    sidecarVersion: string;
    latencyMs: number;
    modelUsed: string;
}

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS =
    Number(process.env.ASSIGNMENT_ASSESSOR_CLIENT_TIMEOUT_MS) || 60_000;
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

export function _resetAssignmentAssessorTokenCacheForTest(): void {
    tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarAssignmentAssessorOptions {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    requestId?: string;
    appCheckToken?: string | null;
}

export async function callSidecarAssignmentAssessor(
    request: SidecarAssignmentAssessorRequest,
    options: CallSidecarAssignmentAssessorOptions = {},
): Promise<SidecarAssignmentAssessorResponse> {
    const baseUrl = process.env[BASE_URL_ENV];
    const audience = process.env[AUDIENCE_ENV];
    if (!baseUrl) {
        throw new AssignmentAssessorSidecarConfigError(
            `${BASE_URL_ENV} is not set`,
        );
    }
    if (!audience) {
        throw new AssignmentAssessorSidecarConfigError(
            `${AUDIENCE_ENV} is not set`,
        );
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/v1/assignment-assessor/assess`;
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

    const appCheckToken =
        options.appCheckToken === undefined
            ? await getFirebaseAppCheckToken()
            : options.appCheckToken;
    const headers: Record<string, string> = {
        ...authHeaders,
        'Content-Type': 'application/json',
        'X-Content-Digest': digest,
        'X-Request-Timestamp': timestamp,
        'X-Request-ID': requestId,
    };
    if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    let res: Response;
    try {
        res = await fetchImpl(url, {
            method: 'POST',
            headers,
            body: rawBody,
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new AssignmentAssessorSidecarTimeoutError(
                Date.now() - startedAt,
            );
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
            throw new AssignmentAssessorSidecarBehaviouralError(
                axisMatch?.[1] ?? 'unknown',
                excerpt,
            );
        }
        throw new AssignmentAssessorSidecarHttpError(res.status, excerpt);
    }

    return (await res.json()) as SidecarAssignmentAssessorResponse;
}
