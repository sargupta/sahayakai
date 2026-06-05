/**
 * HTTP client for the assessment-scanner sidecar (Phase W.alpha).
 *
 * Mirrors `quiz-client.ts`: GoogleAuth ID-token for OIDC, request signing
 * via `signRequest`, App Check header auto-fetched server-side. Wire
 * shape matches the Python `AssessmentScannerResponse` Pydantic model.
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';

import { newRequestId, signRequest } from './signing';

export class AssessmentScannerSidecarConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssessmentScannerSidecarConfigError';
    }
}

export class AssessmentScannerSidecarTimeoutError extends Error {
    readonly elapsedMs: number;
    constructor(elapsedMs: number) {
        super(`Assessment-scanner sidecar request timed out after ${elapsedMs}ms`);
        this.name = 'AssessmentScannerSidecarTimeoutError';
        this.elapsedMs = elapsedMs;
    }
}

export class AssessmentScannerSidecarHttpError extends Error {
    readonly status: number;
    readonly bodyExcerpt: string;
    constructor(status: number, bodyExcerpt: string) {
        super(`Assessment-scanner sidecar returned HTTP ${status}: ${bodyExcerpt}`);
        this.name = 'AssessmentScannerSidecarHttpError';
        this.status = status;
        this.bodyExcerpt = bodyExcerpt;
    }
}

/**
 * Hand-typed wire shape (sidecar.types.generated.ts has not been
 * regenerated yet). Field names are 1:1 with the Pydantic models in
 * `sahayakai_agents/agents/assessment_scanner/schemas.py`.
 */
export interface SidecarAssessmentRequest {
    assessmentId: string;
    studentId?: string | null;
    classId?: string | null;
    subject: string;
    gradeLevel: string;
    language?: string;
    pageUrls: string[];
    ncertChapterIds?: string[] | null;
    totalMaxMarks?: number | null;
    teacherAnswerKeyText?: string | null;
    educationBoard?: string | null;
    /** Optional pre-rendered NCERT chapter context (Markdown) — TS dispatcher resolves NCERT data tree. */
    ncertContext?: string | null;
    userId: string;
}

export interface SidecarPartialCreditStep {
    step: string;
    earned: number;
    max: number;
}

export interface SidecarTeacherOverrides {
    marksAwarded?: number | null;
    feedback?: string | null;
    studentFacingFeedback?: string | null;
    studentAnswer?: string | null;
    editedAt?: string | null;
}

export interface SidecarGradedQuestion {
    questionId: string;
    pageIndex: number;
    questionText: string;
    studentAnswer: string;
    expectedAnswer: string;
    marksAwarded: number;
    marksMax: number;
    partialCreditBreakdown: SidecarPartialCreditStep[];
    feedback: string;
    studentFacingFeedback: string;
    conceptTested: string;
    ncertChapterId: string | null;
    mistakePattern:
        | 'conceptual'
        | 'computational'
        | 'transcription'
        | 'incomplete'
        | 'off_topic'
        | 'none'
        | null;
    needsTeacherReview: boolean;
    confidence: number;
    teacherOverrides?: SidecarTeacherOverrides | null;
}

export interface SidecarConceptMastery {
    chapterId: string;
    chapterTitle: string;
    masteryPct: number;
    weakestConcept: string | null;
}

export interface SidecarAssessmentResponse {
    assessmentId: string;
    status: 'graded' | 'partial' | 'failed';
    pageCount: number;
    totalAwardedMarks: number;
    totalMaxMarks: number;
    scorePct: number;
    letterGrade: string;
    questions: SidecarGradedQuestion[];
    classAverageAtScan: number | null;
    conceptMastery: SidecarConceptMastery[];
    recommendedNextSteps: string[];
    studentRecommendations: string[];
    needsReviewCount: number;
    imageQualityWarnings: string[];
    teacherEditedAt?: string | null;
    errorMessage?: string | null;
    sidecarVersion: string;
    latencyMs: number;
    modelUsed: string;
}

// Two-pass multimodal flow with up to 3 vision-OCR calls + 1 scoring
// call. 90s gives headroom for the p75 tail. Env-overridable.
const TIMEOUT_MS =
    Number(process.env.ASSESSMENT_SCANNER_CLIENT_TIMEOUT_MS) || 90_000;
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

export function _resetAssessmentScannerTokenCacheForTest(): void {
    tokenClientByAudience.clear();
}

export interface CallSidecarAssessmentOptions {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    requestId?: string;
    appCheckToken?: string | null;
}

export async function callSidecarAssessmentScanner(
    request: SidecarAssessmentRequest,
    options: CallSidecarAssessmentOptions = {},
): Promise<SidecarAssessmentResponse> {
    const baseUrl = process.env[BASE_URL_ENV];
    const audience = process.env[AUDIENCE_ENV];
    if (!baseUrl) {
        throw new AssessmentScannerSidecarConfigError(
            `${BASE_URL_ENV} is not set`,
        );
    }
    if (!audience) {
        throw new AssessmentScannerSidecarConfigError(
            `${AUDIENCE_ENV} is not set`,
        );
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/v1/assessment-scanner/grade`;
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
            throw new AssessmentScannerSidecarTimeoutError(
                Date.now() - startedAt,
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AssessmentScannerSidecarHttpError(
            res.status,
            text.slice(0, 500),
        );
    }
    return (await res.json()) as SidecarAssessmentResponse;
}
