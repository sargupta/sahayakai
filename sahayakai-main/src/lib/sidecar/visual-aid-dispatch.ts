/**
 * Visual aid designer dispatcher (Phase E.3).
 */
import {
    generateVisualAid,
    type VisualAidInput,
    type VisualAidOutput,
} from '@/ai/flows/visual-aid-designer';
import {
    callSidecarVisualAid,
    VisualAidSidecarBehaviouralError,
    VisualAidSidecarConfigError,
    VisualAidSidecarHttpError,
    VisualAidSidecarTimeoutError,
    type SidecarVisualAidRequest,
    type SidecarVisualAidResponse,
} from './visual-aid-client';

export type VisualAidSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface VisualAidSidecarDecision {
    mode: VisualAidSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return Math.abs(hash) % 100;
}

function readMode(): VisualAidSidecarMode {
    const raw = (process.env.SAHAYAKAI_VISUAL_AID_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_VISUAL_AID_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

export function decideVisualAidDispatch(uid: string): VisualAidSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type VisualAidDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedVisualAid extends VisualAidOutput {
    source: VisualAidDispatchSource;
    decision: VisualAidSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        imageModelUsed: string;
        metadataModelUsed: string;
    };
}

export interface VisualAidDispatchInput extends VisualAidInput {
    userId: string;
}

function inputToSidecarRequest(input: VisualAidDispatchInput): SidecarVisualAidRequest {
    return {
        prompt: input.prompt,
        language: input.language ?? null,
        gradeLevel: input.gradeLevel ?? null,
        subject: input.subject ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarVisualAidResponse,
    decision: VisualAidSidecarDecision,
): DispatchedVisualAid {
    return {
        imageDataUri: res.imageDataUri,
        pedagogicalContext: res.pedagogicalContext,
        discussionSpark: res.discussionSpark,
        subject: res.subject,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            imageModelUsed: res.imageModelUsed,
            metadataModelUsed: res.metadataModelUsed,
        },
    };
}

function genkitToDispatched(
    out: VisualAidOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: VisualAidSidecarDecision,
): DispatchedVisualAid {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: VisualAidInput) {
    try {
        const out = await generateVisualAid(input);
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarVisualAidRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarVisualAid(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(decision: VisualAidSidecarDecision, payload: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        event: 'visual_aid.dispatch',
        mode: decision.mode,
        reason: decision.reason,
        bucket: decision.bucket,
        ...payload,
    }));
}

export async function dispatchVisualAid(
    input: VisualAidDispatchInput,
): Promise<DispatchedVisualAid> {
    const decision = decideVisualAidDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateVisualAid(input);
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
        sidecar.error instanceof VisualAidSidecarBehaviouralError ? 'behavioural'
        : sidecar.error instanceof VisualAidSidecarTimeoutError ? 'timeout'
        : sidecar.error instanceof VisualAidSidecarHttpError ? 'http'
        : sidecar.error instanceof VisualAidSidecarConfigError ? 'config'
        : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await generateVisualAid(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
