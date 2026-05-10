/**
 * Worksheet wizard dispatcher (Phase D.4) — multimodal.
 */
import {
    generateWorksheet,
    type WorksheetWizardInput,
    type WorksheetWizardOutput,
} from '@/ai/flows/worksheet-wizard';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarWorksheet,
    WorksheetSidecarBehaviouralError,
    WorksheetSidecarConfigError,
    WorksheetSidecarHttpError,
    WorksheetSidecarTimeoutError,
    type SidecarWorksheetRequest,
    type SidecarWorksheetResponse,
} from './worksheet-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in worksheet-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 25_000;

export type WorksheetSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface WorksheetSidecarDecision {
    mode: WorksheetSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return Math.abs(hash) % 100;
}

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<WorksheetSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.worksheetSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.worksheetSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideWorksheetDispatch(uid: string): Promise<WorksheetSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type WorksheetDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedWorksheet extends WorksheetWizardOutput {
    source: WorksheetDispatchSource;
    decision: WorksheetSidecarDecision;
    sidecarTelemetry?: { sidecarVersion: string; latencyMs: number; modelUsed: string };
}

export interface WorksheetDispatchInput extends WorksheetWizardInput {
    userId: string;
}

function inputToSidecarRequest(input: WorksheetDispatchInput): SidecarWorksheetRequest {
    return {
        imageDataUri: input.imageDataUri,
        prompt: input.prompt,
        language: input.language ?? null,
        gradeLevel: input.gradeLevel ?? null,
        subject: input.subject ?? null,
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarWorksheetResponse,
    decision: WorksheetSidecarDecision,
): DispatchedWorksheet {
    return {
        title: res.title,
        gradeLevel: res.gradeLevel,
        subject: res.subject,
        learningObjectives: res.learningObjectives,
        studentInstructions: res.studentInstructions,
        // Codegen `chalkboardNote?: string | null`; downstream Genkit
        // `WorksheetWizardOutput.activities[i].chalkboardNote` is
        // `?: string` (optional, not nullable). Coerce null→undefined.
        activities: res.activities.map((a) => ({
            type: a.type,
            content: a.content,
            explanation: a.explanation,
            chalkboardNote: a.chalkboardNote ?? undefined,
        })),
        answerKey: res.answerKey,
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
    out: WorksheetWizardOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: WorksheetSidecarDecision,
): DispatchedWorksheet {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: WorksheetWizardInput) {
    try {
        const out = await withTimeout(
            generateWorksheet(input),
            FALLBACK_TIMEOUT_MS,
            'worksheet genkit fallback',
        );
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarWorksheetRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarWorksheet(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(decision: WorksheetSidecarDecision, payload: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        event: 'worksheet.dispatch',
        mode: decision.mode,
        reason: decision.reason,
        bucket: decision.bucket,
        ...payload,
    }));
}

export async function dispatchWorksheet(
    input: WorksheetDispatchInput,
): Promise<DispatchedWorksheet> {
    // Phase K — pre-call rate-limit gate. Lifted out of the Genkit flow
    // so the sidecar canary/full path enforces it too. AIQuotaExhaustedError
    // (and the legacy "Rate limit exceeded" plain Error) propagate to the
    // route handler which maps them to 429/503.
    // Note: validateTopicSafety is intentionally skipped — WorksheetWizardInputSchema
    // has no `topic` field; the prompt is image+free-form which the model itself
    // safety-filters via Genkit/Gemini's built-in policies.
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(input.userId);

    const decision = await decideWorksheetDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateWorksheet(input),
            FALLBACK_TIMEOUT_MS,
            'worksheet genkit fallback',
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
        });
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        void writeAgentShadowDiff({
            agent: 'worksheet',
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

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, { source: 'sidecar', uid: input.userId, sidecarLatencyMs: sidecar.latencyMs });
        const dispatched = sidecarToDispatched(sidecar.res, decision);
        // Phase K — persist sidecar output to Storage + Firestore so it
        // shows up in My Library, mirroring the Genkit flow's behaviour.
        // Fail-soft: any persistence error is swallowed (the user has
        // already received the response; persistence is a side effect).
        // persistSidecarJSON is fail-soft internally (returns null on error,
        // logs at WARN). Outer try/catch is belt-and-braces in case the
        // helper itself ever throws synchronously.
        try {
            await persistSidecarJSON({
                uid: input.userId,
                collection: 'worksheets',
                contentType: 'worksheet',
                title: `Worksheet: ${input.prompt.substring(0, 30)}`,
                output: {
                    title: dispatched.title,
                    gradeLevel: dispatched.gradeLevel,
                    subject: dispatched.subject,
                    learningObjectives: dispatched.learningObjectives,
                    studentInstructions: dispatched.studentInstructions,
                    activities: dispatched.activities,
                    answerKey: dispatched.answerKey,
                },
                metadata: {
                    gradeLevel: dispatched.gradeLevel || input.gradeLevel || 'Class 5',
                    subject: dispatched.subject || 'General',
                    topic: input.prompt,
                    language: input.language || 'English',
                },
            });
        } catch (persistErr) {
            // eslint-disable-next-line no-console
            console.warn(JSON.stringify({
                event: 'worksheet.persist_failed',
                uid: input.userId,
                error: persistErr instanceof Error ? persistErr.message : String(persistErr),
            }));
        }
        return dispatched;
    }

    const errorClass =
        sidecar.error instanceof WorksheetSidecarBehaviouralError ? 'behavioural'
        : sidecar.error instanceof WorksheetSidecarTimeoutError ? 'timeout'
        : sidecar.error instanceof WorksheetSidecarHttpError ? 'http'
        : sidecar.error instanceof WorksheetSidecarConfigError ? 'config'
        : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await withTimeout(
        generateWorksheet(input),
        FALLBACK_TIMEOUT_MS,
        'worksheet genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
