/**
 * Visual aid designer dispatcher (Phase E.3).
 *
 * Phase K (forensic audit P0 #2): in canary/full mode the sidecar
 * served the image to the caller but the dispatcher silently dropped
 * Cloud Storage persistence (image bytes) and Firestore metadata
 * (`users/{uid}/content`). The Genkit flow does both inside
 * `visualAidFlow`; the sidecar process has no Firebase Admin
 * credentials, so the dispatcher must mirror the persistence here.
 *
 * Phase K also lifts `checkImageRateLimit` to the dispatcher so that a
 * sidecar-routed image-gen call cannot bypass the daily image cap.
 * Genkit's `generateVisualAid` already calls `checkImageRateLimit`
 * internally, so the gate runs there in `off`/`shadow`/`fallback`
 * paths and here in `canary`/`full` paths — never both.
 */
import {
    generateVisualAid,
    type VisualAidInput,
    type VisualAidOutput,
} from '@/ai/flows/visual-aid-designer';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarVisualAid,
    VisualAidSidecarBehaviouralError,
    VisualAidSidecarConfigError,
    VisualAidSidecarHttpError,
    VisualAidSidecarTimeoutError,
    type SidecarVisualAidRequest,
    type SidecarVisualAidResponse,
} from './visual-aid-client';
import { persistSidecarImage } from './persist-helpers';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in visual-aid-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 110_000;

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

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<VisualAidSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.visualAidSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.visualAidSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideVisualAidDispatch(uid: string): Promise<VisualAidSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
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
        const out = await withTimeout(
            generateVisualAid(input),
            FALLBACK_TIMEOUT_MS,
            'visual-aid genkit fallback',
        );
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
    const decision = await decideVisualAidDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateVisualAid(input),
            FALLBACK_TIMEOUT_MS,
            'visual-aid genkit fallback',
        );
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

    // Phase K — image rate-limit gate. Visual-aid is $0.04/call so we
    // MUST decrement the daily quota before the sidecar runs (otherwise
    // a sidecar-routed user has no enforcement). Failures inside
    // `checkImageRateLimit` are non-fatal (it fails open on
    // infrastructure errors) but a real "limit reached" error bubbles
    // up and the route lands a 429.
    if (input.userId) {
        const { checkImageRateLimit } = await import('@/lib/server-safety');
        await checkImageRateLimit(input.userId);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        // Phase K — persist sidecar output to Storage + Firestore so
        // the teacher's library mirrors what the Genkit flow would have
        // written. Fail-soft inside `persistSidecarImage` so a Storage
        // hiccup does not drop a good image.
        if (input.userId) {
            await persistSidecarImage({
                uid: input.userId,
                contentType: 'visual-aid',
                collection: 'visual-aids',
                title: input.prompt,
                imageDataUri: sidecar.res.imageDataUri,
                metadata: {
                    gradeLevel: input.gradeLevel || 'Class 5',
                    subject: sidecar.res.subject || 'Science',
                    topic: input.prompt,
                    language: input.language || 'English',
                },
                extraData: {
                    pedagogicalContext: sidecar.res.pedagogicalContext,
                    discussionSpark: sidecar.res.discussionSpark,
                    subject: sidecar.res.subject,
                },
            });
        }
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

    const out = await withTimeout(
        generateVisualAid(input),
        FALLBACK_TIMEOUT_MS,
        'visual-aid genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
