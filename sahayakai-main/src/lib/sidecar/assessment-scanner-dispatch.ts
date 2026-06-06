/**
 * Assessment-scanner dispatcher.
 *
 * Wraps `gradeAssessment` (Genkit) and `callSidecarAssessmentScanner`
 * (Phase W.alpha Python sidecar with two-pass multimodal flow) under
 * one entry point so the API route at
 * `app/api/ai/assessment-scanner/route.ts` does not embed routing logic.
 *
 * Modes (selected from feature flags):
 *
 * - `off`    — Genkit only. Zero overhead vs. legacy.
 * - `shadow` — Genkit serves the response. Sidecar runs in parallel
 *              fire-and-forget; output is logged + persisted via
 *              `writeAgentShadowDiff` for offline parity analysis.
 * - `canary` / `full` — Sidecar serves. On ANY sidecar error the
 *              dispatcher falls back to Genkit.
 *
 * **Currently defaults to `off`** via `FALLBACK_CONFIG.assessmentScannerSidecarMode`.
 */

import {
    gradeAssessment,
    AssessmentEmptyExtractionError,
    AssessmentPageUnreadableError,
} from '@/ai/flows/assessment-scanner';
import type {
    AssessmentScannerInput,
    AssessmentScannerOutput,
} from '@/ai/schemas/assessment-scanner-schemas';
import { getChapterById, getChaptersForGrade } from '@/data/ncert';
import { getFeatureFlags, type SidecarMode } from '@/lib/feature-flags';

import {
    callSidecarAssessmentScanner,
    AssessmentScannerSidecarConfigError,
    AssessmentScannerSidecarHttpError,
    AssessmentScannerSidecarTimeoutError,
    type SidecarAssessmentRequest,
    type SidecarAssessmentResponse,
} from './assessment-scanner-client';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { shouldRunCanaryShadowDiff } from './canary-shadow-diff';
import { withTimeout } from './with-timeout';

const FALLBACK_TIMEOUT_MS =
    Number(process.env.ASSESSMENT_SCANNER_FALLBACK_TIMEOUT_MS) || 90_000;

export interface AssessmentScannerSidecarDecision {
    mode: SidecarMode;
    reason: string;
    bucket: number;
    /** Q4C: raw flag value pre-bucket. */
    configuredMode?: SidecarMode;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

async function readMode(): Promise<SidecarMode> {
    const flags = await getFeatureFlags();
    return flags.assessmentScannerSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.assessmentScannerSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideAssessmentScannerDispatch(
    uid: string,
): Promise<AssessmentScannerSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket, configuredMode: mode };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket, configuredMode: mode };
    const percent = await readPercent();
    if (bucket < percent) {
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket, configuredMode: mode };
    }
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket, configuredMode: mode };
}

export type AssessmentScannerDispatchSource =
    | 'genkit'
    | 'sidecar'
    | 'genkit_fallback';

export interface DispatchedAssessmentScanner extends AssessmentScannerOutput {
    source: AssessmentScannerDispatchSource;
    decision: AssessmentScannerSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface AssessmentScannerDispatchInput
    extends AssessmentScannerInput {}

// ---- NCERT context resolution (mirrors the Genkit flow's buildNcertContext) --

function gradeLevelToNumber(gradeLevel: string): number | null {
    const match = gradeLevel.match(/Class\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}

function buildNcertContextForSidecar(input: AssessmentScannerInput): string {
    const grade = gradeLevelToNumber(input.gradeLevel);
    if (grade === null) {
        return '(No NCERT context available for this grade level — use general knowledge of early-childhood pedagogy.)';
    }
    let chapters = (input.ncertChapterIds ?? [])
        .map((id) => getChapterById(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (chapters.length === 0) {
        chapters = getChaptersForGrade(grade, input.subject).slice(0, 5);
    }
    if (chapters.length === 0) {
        return `(NCERT data not loaded for ${input.subject} Class ${grade}. Grade against general syllabus knowledge.)`;
    }
    return chapters
        .map(
            (c) =>
                `## ${c.title}\n- Learning outcomes: ${c.learningOutcomes.join('; ')}\n- Key terms: ${c.keywords.join(', ')}`,
        )
        .join('\n\n');
}

function inputToSidecarRequest(
    input: AssessmentScannerInput,
): SidecarAssessmentRequest {
    return {
        assessmentId: input.assessmentId,
        studentId: input.studentId ?? null,
        classId: input.classId ?? null,
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        language: input.language,
        pageUrls: input.pageUrls,
        ncertChapterIds: input.ncertChapterIds ?? null,
        totalMaxMarks: input.totalMaxMarks ?? null,
        teacherAnswerKeyText: input.teacherAnswerKeyText ?? null,
        educationBoard: input.educationBoard ?? null,
        // Pre-resolve NCERT context server-side; sidecar has no NCERT tree.
        ncertContext: buildNcertContextForSidecar(input),
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarAssessmentResponse,
    decision: AssessmentScannerSidecarDecision,
): DispatchedAssessmentScanner {
    // The sidecar's wire schema is a superset of the Genkit
    // AssessmentScannerOutput (sidecarVersion / latencyMs / modelUsed
    // are additive). Strip the sidecar-only fields, surface them on
    // sidecarTelemetry, and pass the rest through.
    const {
        sidecarVersion: _sv,
        latencyMs: _lm,
        modelUsed: _mu,
        ...rest
    } = res;
    return {
        ...(rest as unknown as AssessmentScannerOutput),
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            modelUsed: res.modelUsed,
        },
    };
}

function genkitToDispatched(
    out: AssessmentScannerOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: AssessmentScannerSidecarDecision,
): DispatchedAssessmentScanner {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: AssessmentScannerDispatchInput) {
    try {
        const out = await withTimeout(
            gradeAssessment(input),
            FALLBACK_TIMEOUT_MS,
            'assessment-scanner genkit fallback',
        );
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarAssessmentRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarAssessmentScanner(request);
        return {
            ok: true as const,
            res,
            latencyMs: Date.now() - startedAt,
        };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: AssessmentScannerSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'assessment_scanner.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchAssessmentScanner(
    input: AssessmentScannerDispatchInput,
): Promise<DispatchedAssessmentScanner> {
    const decision = await decideAssessmentScannerDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            gradeAssessment(input),
            FALLBACK_TIMEOUT_MS,
            'assessment-scanner genkit fallback',
        );
        logDispatch(decision, { source: 'genkit', uid: input.userId });

        // Q4C — canary "bucket-overshoot" observation. When the agent
        // is mid-canary (configuredMode==='canary') but THIS teacher's
        // bucket landed >=percent (mode collapsed to 'off'), fire the
        // sidecar in the background and write a shadow_diff so the
        // promotion gate has a non-zero denominator.
        if (
            shouldRunCanaryShadowDiff() &&
            decision.configuredMode === 'canary'
        ) {
            void runSidecarSafe(sidecarRequest).then((sc) => {
                void writeAgentShadowDiff({
                    agent: 'assessment-scanner',
                    uid: input.userId,
                    genkit: out,
                    sidecar: sc.ok ? sc.res : null,
                    genkitLatencyMs: 0,
                    sidecarLatencyMs: sc.latencyMs,
                    sidecarOk: sc.ok,
                    sidecarError: sc.ok ? undefined : sc.error.message,
                });
            });
        }
                return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const shadowStartedAt = Date.now();
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarRequest),
        ]);
        const genkitLatencyMs = Date.now() - shadowStartedAt;
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        void writeAgentShadowDiff({
            agent: 'assessment-scanner',
            uid: input.userId,
            genkit: genkit.ok ? genkit.out : null,
            sidecar: sidecar.ok ? sidecar.res : null,
            genkitLatencyMs,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarOk: sidecar.ok,
            sidecarError: sidecar.ok ? undefined : sidecar.error.message,
        });
        if (!genkit.ok) {
            // Re-raise the typed Genkit error so the route can map it.
            throw genkit.error;
        }
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // canary / full
    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
        });

        // Q4C — canary/full observation: fire Genkit in the background
        // and write a shadow_diff so the promotion-gate aggregator has
        // a live (genkit, sidecar) parity signal during the rollout.
        // 2x Gemini cost while observation is on; toggle the constant
        // off post-promotion to reclaim it.
        if (shouldRunCanaryShadowDiff()) {
            const __q4cGenkitStartedAt = Date.now();
            void runGenkitSafe(input).then((gk) => {
                void writeAgentShadowDiff({
                    agent: 'assessment-scanner',
                    uid: input.userId,
                    genkit: gk.ok ? gk.out : null,
                    sidecar: sidecar.res,
                    genkitLatencyMs: Date.now() - __q4cGenkitStartedAt,
                    sidecarLatencyMs: sidecar.latencyMs,
                    sidecarOk: true,
                });
            });
        }
                return sidecarToDispatched(sidecar.res, decision);
    }

    // Sidecar error: only fall back to Genkit when it's an infrastructure
    // failure. A 422 from the sidecar (page unreadable / empty extraction)
    // is the same answer Genkit will give -- propagate it directly so the
    // route returns the actionable user-facing message instead of burning
    // more quota on a second pass.
    const isUnactionable =
        sidecar.error instanceof AssessmentScannerSidecarHttpError &&
        sidecar.error.status === 422;
    if (isUnactionable) {
        throw sidecar.error;
    }

    const errorClass =
        sidecar.error instanceof AssessmentScannerSidecarTimeoutError
            ? 'timeout'
            : sidecar.error instanceof AssessmentScannerSidecarHttpError
              ? 'http'
              : sidecar.error instanceof AssessmentScannerSidecarConfigError
                ? 'config'
                : 'unknown';
    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });
    const out = await withTimeout(
        gradeAssessment(input),
        FALLBACK_TIMEOUT_MS,
        'assessment-scanner genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}

// Re-export the typed errors so routes can `instanceof`-check without
// touching the flow module directly.
export {
    AssessmentEmptyExtractionError,
    AssessmentPageUnreadableError,
};
