/**
 * Assignment-assessor dispatcher.
 *
 * Reads mode + percent from Firestore via `getFeatureFlags()` so the
 * auto-abort Cloud Function (Firestore writer only) can roll this
 * agent back without a Cloud Run redeploy. Same off / shadow /
 * canary / full pattern as the rest of the Phase J.5 cohort.
 *
 * History:
 * - Originally Genkit-only (the previous v1 ship surface). Surface
 *   area was kept small for v1.
 * - Now extended to dispatch to the Python sidecar
 *   (`sahayakai-agents/src/sahayakai_agents/agents/assignment_assessor`)
 *   in shadow / canary / full modes.
 * - Future (PR4 in the plan at .claude/plans/uh-can-you-assign-lively-hartmanis.md):
 *   an optional Sarvam OCR pre-step behind `enableSarvamOcr` so power
 *   users can opt into a higher-accuracy Indic OCR pass that feeds the
 *   model an `editedTranscript` in `mode='score'`. Drop the OCR call
 *   in `runGenkitSafe` / `runSidecarSafe` below — no schema changes
 *   needed.
 */

import {
    assessAssignment,
    type AssessAssignmentInput,
    type AssessAssignmentOutput,
} from '@/ai/flows/assignment-assessor';
import { getFeatureFlags } from '@/lib/feature-flags';
import { checkServerRateLimit } from '@/lib/server-safety';

import {
    AssignmentAssessorSidecarBehaviouralError,
    AssignmentAssessorSidecarConfigError,
    AssignmentAssessorSidecarHttpError,
    AssignmentAssessorSidecarTimeoutError,
    callSidecarAssignmentAssessor,
    type SidecarAssignmentAssessorRequest,
    type SidecarAssignmentAssessorResponse,
} from './assignment-assessor-client';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Matches the assessor's client-side budget (slowest single call —
// multimodal `gemini-2.5-pro`). Env-overridable for production
// tuning without a redeploy.
const FALLBACK_TIMEOUT_MS =
    Number(process.env.ASSIGNMENT_ASSESSOR_FALLBACK_TIMEOUT_MS) || 60_000;

// ─── Firestore-backed dispatch decision ────────────────────────────────────

export type AssignmentAssessorSidecarMode =
    | 'off'
    | 'shadow'
    | 'canary'
    | 'full';

export interface AssignmentAssessorSidecarDecision {
    mode: AssignmentAssessorSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

async function readMode(): Promise<AssignmentAssessorSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.assignmentAssessorSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.assignmentAssessorSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideAssignmentAssessorDispatch(
    uid: string,
): Promise<AssignmentAssessorSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
    if (bucket < percent) {
        return {
            mode,
            reason: `bucket_${bucket}_under_${percent}`,
            bucket,
        };
    }
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

// ─── Dispatched result ────────────────────────────────────────────────────

export type AssessmentDispatchSource =
    | 'genkit'
    | 'sarvam_genkit'
    | 'sidecar'
    | 'genkit_fallback';

export interface DispatchedAssessment extends AssessAssignmentOutput {
    source: AssessmentDispatchSource;
    decision?: AssignmentAssessorSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface AssessmentDispatchInput extends AssessAssignmentInput {
    userId: string;
}

// ─── Input mapping ────────────────────────────────────────────────────────

function inputToSidecarRequest(
    input: AssessmentDispatchInput,
): SidecarAssignmentAssessorRequest {
    return {
        imageDataUri: input.imageDataUri,
        rubricSnapshot: input.rubricSnapshot
            ? {
                  title: input.rubricSnapshot.title,
                  description: input.rubricSnapshot.description,
                  criteria: input.rubricSnapshot.criteria.map((c) => ({
                      name: c.name,
                      description: c.description,
                      levels: c.levels.map((l) => ({
                          name: l.name,
                          description: l.description,
                          points: l.points,
                      })),
                  })),
                  gradeLevel: input.rubricSnapshot.gradeLevel ?? null,
                  subject: input.rubricSnapshot.subject ?? null,
              }
            : null,
        language: input.language ?? null,
        subject: input.subject ?? null,
        gradeLevel: input.gradeLevel ?? null,
        studentId: input.studentId ?? null,
        editedTranscript: input.editedTranscript ?? null,
        mode: input.mode ?? 'full',
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarAssignmentAssessorResponse,
    decision: AssignmentAssessorSidecarDecision,
): DispatchedAssessment {
    const out: AssessAssignmentOutput = {
        assessmentId: res.assessmentId,
        rawTranscript: res.rawTranscript,
        editedTranscript: res.editedTranscript,
        language: res.language,
        overallScore: res.overallScore,
        pointsEarned: res.pointsEarned,
        pointsPossible: res.pointsPossible,
        perCriterionScores: res.perCriterionScores,
        strengths: res.strengths,
        improvements: res.improvements,
        nextSteps: res.nextSteps,
        teacherNote: res.teacherNote,
        confidenceOverall: res.confidenceOverall,
        warnings: res.warnings,
        rubricSnapshot: {
            title: res.rubricSnapshot.title,
            description: res.rubricSnapshot.description,
            criteria: res.rubricSnapshot.criteria,
            gradeLevel: res.rubricSnapshot.gradeLevel ?? null,
            subject: res.rubricSnapshot.subject ?? null,
        },
        studentId: res.studentId,
        createdAtIso: res.createdAtIso,
    };
    return {
        ...out,
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
    out: AssessAssignmentOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: AssignmentAssessorSidecarDecision,
): DispatchedAssessment {
    return { ...out, source, decision };
}

// ─── Safe execution helpers ───────────────────────────────────────────────

async function runGenkitSafe(
    input: AssessmentDispatchInput,
): Promise<
    | { ok: true; out: AssessAssignmentOutput }
    | { ok: false; error: Error }
> {
    try {
        const out = await withTimeout(
            assessAssignment(input),
            FALLBACK_TIMEOUT_MS,
            'assignment-assessor genkit fallback',
        );
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarAssignmentAssessorRequest,
): Promise<
    | { ok: true; res: SidecarAssignmentAssessorResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarAssignmentAssessor(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: AssignmentAssessorSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'assignment_assessor.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

// ─── Public dispatcher ────────────────────────────────────────────────────

export async function dispatchAssessment(
    input: AssessmentDispatchInput,
): Promise<DispatchedAssessment> {
    // Server-wide rate-limit guard (per uid) — this fires regardless of
    // dispatch mode so a single user cannot fan out hundreds of
    // concurrent grading calls and saturate the Gemini key pool.
    // (The Genkit flow does NOT gate today; the API route does — but
    //  the route is bypassed when the sidecar serves, so we lift the
    //  gate to the dispatcher.)
    await checkServerRateLimit(input.userId);

    const decision = await decideAssignmentAssessorDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            assessAssignment(input),
            FALLBACK_TIMEOUT_MS,
            'assignment-assessor genkit',
        );
        logDispatch(decision, { source: 'genkit', uid: input.userId });
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
            sidecarErrorType: sidecar.ok ? undefined : sidecar.error.name,
        });
        void writeAgentShadowDiff({
            agent: 'assignment-assessor',
            uid: input.userId,
            genkit: genkit.ok ? genkit.out : null,
            sidecar: sidecar.ok ? sidecar.res : null,
            genkitLatencyMs,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarOk: sidecar.ok,
            sidecarError: sidecar.ok ? undefined : sidecar.error.message,
        });
        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // canary / full
    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarVersion: sidecar.res.sidecarVersion,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof AssignmentAssessorSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof AssignmentAssessorSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof AssignmentAssessorSidecarHttpError
                ? 'http'
                : sidecar.error instanceof AssignmentAssessorSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarErrorType: sidecar.error.name,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await withTimeout(
        assessAssignment(input),
        FALLBACK_TIMEOUT_MS,
        'assignment-assessor genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
