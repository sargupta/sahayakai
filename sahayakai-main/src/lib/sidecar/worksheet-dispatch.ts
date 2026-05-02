/**
 * Worksheet wizard dispatcher (Phase D.4) — multimodal.
 */
import {
    generateWorksheet,
    type WorksheetWizardInput,
    type WorksheetWizardOutput,
} from '@/ai/flows/worksheet-wizard';
import {
    callSidecarWorksheet,
    WorksheetSidecarBehaviouralError,
    WorksheetSidecarConfigError,
    WorksheetSidecarHttpError,
    WorksheetSidecarTimeoutError,
    type SidecarWorksheetRequest,
    type SidecarWorksheetResponse,
} from './worksheet-client';

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

function readMode(): WorksheetSidecarMode {
    const raw = (process.env.SAHAYAKAI_WORKSHEET_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_WORKSHEET_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

export function decideWorksheetDispatch(uid: string): WorksheetSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
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
        activities: res.activities,
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
        const out = await generateWorksheet(input);
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
    const decision = decideWorksheetDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateWorksheet(input);
        logDispatch(decision, { source: 'genkit', uid: input.userId });
        return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarRequest),
        ]);
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, { source: 'sidecar', uid: input.userId, sidecarLatencyMs: sidecar.latencyMs });
        return sidecarToDispatched(sidecar.res, decision);
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

    const out = await generateWorksheet(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
