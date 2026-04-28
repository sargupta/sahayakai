/**
 * Virtual field-trip dispatcher (Phase D.3).
 *
 * Phase K (forensic audit P0 #2): in canary/full mode the sidecar
 * served the trip to the caller but the dispatcher silently dropped
 * Cloud Storage persistence (`users/{uid}/virtual-field-trips/`) +
 * Firestore content metadata. The Genkit flow does both inside
 * `virtualFieldTripFlow`; the sidecar process has no Firebase Admin
 * credentials, so the dispatcher mirrors the persistence here. The
 * pre-call rate-limit gate is also lifted so a sidecar-routed call
 * cannot bypass `checkServerRateLimit`.
 */
import {
    planVirtualFieldTrip,
    type VirtualFieldTripInput,
    type VirtualFieldTripOutput,
} from '@/ai/flows/virtual-field-trip';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarVirtualFieldTrip,
    VirtualFieldTripSidecarBehaviouralError,
    VirtualFieldTripSidecarConfigError,
    VirtualFieldTripSidecarHttpError,
    VirtualFieldTripSidecarTimeoutError,
    type SidecarVirtualFieldTripRequest,
    type SidecarVirtualFieldTripResponse,
} from './virtual-field-trip-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in virtual-field-trip-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 15_000;

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

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<VirtualFieldTripSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.virtualFieldTripSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.virtualFieldTripSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideVirtualFieldTripDispatch(
    uid: string,
): Promise<VirtualFieldTripSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
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
        const out = await withTimeout(
            planVirtualFieldTrip(input),
            FALLBACK_TIMEOUT_MS,
            'virtual-field-trip genkit fallback',
        );
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
    const decision = await decideVirtualFieldTripDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            planVirtualFieldTrip(input),
            FALLBACK_TIMEOUT_MS,
            'virtual-field-trip genkit fallback',
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
            agent: 'virtual-field-trip',
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

    // Phase K — pre-call rate limit gate. The Genkit
    // `planVirtualFieldTrip` does NOT gate today (it relies on
    // upstream API-route gating); but for parity with other Phase K
    // dispatchers and to close the canary/full path against any
    // route-level gap, the dispatcher gates explicitly here.
    if (input.userId) {
        const { checkServerRateLimit } = await import('@/lib/server-safety');
        await checkServerRateLimit(input.userId);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        // Phase K — persist sidecar output to Storage + Firestore.
        if (input.userId) {
            const payload: VirtualFieldTripOutput = {
                title: sidecar.res.title,
                stops: sidecar.res.stops,
                gradeLevel: sidecar.res.gradeLevel,
                subject: sidecar.res.subject,
            };
            await persistSidecarJSON({
                uid: input.userId,
                contentType: 'virtual-field-trip',
                collection: 'virtual-field-trips',
                title: sidecar.res.title || `Trip: ${input.topic}`,
                output: payload,
                metadata: {
                    gradeLevel: sidecar.res.gradeLevel || input.gradeLevel || 'Class 5',
                    subject: sidecar.res.subject || 'Geography',
                    topic: input.topic,
                    language: input.language || 'English',
                },
            });
        }
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

    const out = await withTimeout(
        planVirtualFieldTrip(input),
        FALLBACK_TIMEOUT_MS,
        'virtual-field-trip genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
