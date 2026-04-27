/**
 * Virtual field-trip dispatcher (Phase D.3).
 */
import {
    planVirtualFieldTrip,
    type VirtualFieldTripInput,
    type VirtualFieldTripOutput,
} from '@/ai/flows/virtual-field-trip';
import {
    callSidecarVirtualFieldTrip,
    VirtualFieldTripSidecarBehaviouralError,
    VirtualFieldTripSidecarConfigError,
    VirtualFieldTripSidecarHttpError,
    VirtualFieldTripSidecarTimeoutError,
    type SidecarVirtualFieldTripRequest,
    type SidecarVirtualFieldTripResponse,
} from './virtual-field-trip-client';

export type VirtualFieldTripSidecarMode =
    | 'off' | 'shadow' | 'canary' | 'full';

export interface VirtualFieldTripSidecarDecision {
    mode: VirtualFieldTripSidecarMode;
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

function readMode(): VirtualFieldTripSidecarMode {
    const raw = (process.env.SAHAYAKAI_VIRTUAL_FIELD_TRIP_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_VIRTUAL_FIELD_TRIP_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

export function decideVirtualFieldTripDispatch(
    uid: string,
): VirtualFieldTripSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
    if (bucket < percent)
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return {
        mode: 'off',
        reason: `bucket_${bucket}_over_${percent}`,
        bucket,
    };
}

export type VirtualFieldTripDispatchSource =
    | 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedVirtualFieldTrip extends VirtualFieldTripOutput {
    source: VirtualFieldTripDispatchSource;
    decision: VirtualFieldTripSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface VirtualFieldTripDispatchInput
    extends VirtualFieldTripInput {
    userId: string;
}

function inputToSidecarRequest(
    input: VirtualFieldTripDispatchInput,
): SidecarVirtualFieldTripRequest {
    return {
        topic: input.topic,
        language: input.language ?? null,
        gradeLevel: input.gradeLevel ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarVirtualFieldTripResponse,
    decision: VirtualFieldTripSidecarDecision,
): DispatchedVirtualFieldTrip {
    return {
        title: res.title,
        stops: res.stops,
        gradeLevel: res.gradeLevel,
        subject: res.subject,
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
    out: VirtualFieldTripOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: VirtualFieldTripSidecarDecision,
): DispatchedVirtualFieldTrip {
    return { ...out, source, decision };
}

async function runGenkitSafe(
    input: VirtualFieldTripInput,
): Promise<{ ok: true; out: VirtualFieldTripOutput } | { ok: false; error: Error }> {
    try {
        const out = await planVirtualFieldTrip(input);
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarVirtualFieldTripRequest,
): Promise<
    | { ok: true; res: SidecarVirtualFieldTripResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarVirtualFieldTrip(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: VirtualFieldTripSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'virtual_field_trip.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchVirtualFieldTrip(
    input: VirtualFieldTripDispatchInput,
): Promise<DispatchedVirtualFieldTrip> {
    const decision = decideVirtualFieldTripDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await planVirtualFieldTrip(input);
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
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof VirtualFieldTripSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof VirtualFieldTripSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof VirtualFieldTripSidecarHttpError
                ? 'http'
                : sidecar.error instanceof VirtualFieldTripSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await planVirtualFieldTrip(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
