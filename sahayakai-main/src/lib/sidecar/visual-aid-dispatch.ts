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
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { shouldRunCanaryShadowDiff } from './canary-shadow-diff';
import { withTimeout } from './with-timeout';
import { toIsoLanguage } from './lang';

// Mirrors `TIMEOUT_MS` in visual-aid-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 110_000;

export type VisualAidSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface VisualAidSidecarDecision {
    mode: VisualAidSidecarMode;
    reason: string;
    bucket: number;
    /** Q4C: raw flag value pre-bucket. */
    configuredMode?: VisualAidSidecarMode;
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
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket, configuredMode: mode };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket, configuredMode: mode };
    const percent = await readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket, configuredMode: mode };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket, configuredMode: mode };
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
        // Normalise language display label → ISO for uniform wire shape.
        language: input.language ? toIsoLanguage(input.language) : null,
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

        // Q4C — canary "bucket-overshoot" observation. When the agent
        // is mid-canary (configuredMode==='canary') but THIS teacher's
        // bucket landed >=percent (mode collapsed to 'off'), fire the
        // sidecar in the background and write a shadow_diff so the
        // promotion gate has a non-zero denominator.
        // F14-002: sidecar observation call still costs $0.04. Peek
        // budget; user already received the Genkit primary image.
        if (
            shouldRunCanaryShadowDiff() &&
            decision.configuredMode === 'canary' &&
            input.userId
        ) {
            const { peekImageRateLimit } = await import('@/lib/server-safety');
            const hasBudget = await peekImageRateLimit(input.userId);
            if (hasBudget) {
                void runSidecarSafe(sidecarRequest).then((sc) => {
                    void writeAgentShadowDiff({
                        agent: 'visual-aid',
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
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        void writeAgentShadowDiff({
            agent: 'visual-aid',
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

        // Q4C — canary/full observation: fire Genkit in the background
        // and write a shadow_diff so the promotion-gate aggregator has
        // a live (genkit, sidecar) parity signal during the rollout.
        // F14-002 (2026-06-06): peek the daily image cap before firing
        // the background Genkit call. The served sidecar primary already
        // shipped above; observation is best-effort and MUST NOT consume
        // budget beyond what the served path already decremented.
        if (shouldRunCanaryShadowDiff() && input.userId) {
            const { peekImageRateLimit } = await import('@/lib/server-safety');
            const hasBudget = await peekImageRateLimit(input.userId);
            if (hasBudget) {
                const __q4cGenkitStartedAt = Date.now();
                void runGenkitSafe(input).then((gk) => {
                    void writeAgentShadowDiff({
                        agent: 'visual-aid',
                        uid: input.userId,
                        genkit: gk.ok ? gk.out : null,
                        sidecar: sidecar.res,
                        genkitLatencyMs: Date.now() - __q4cGenkitStartedAt,
                        sidecarLatencyMs: sidecar.latencyMs,
                        sidecarOk: true,
                    });
                });
            } else {
                // eslint-disable-next-line no-console
                console.log(JSON.stringify({
                    event: 'visual_aid.dispatch.q4c_skipped_quota',
                    uid: input.userId,
                    reason: 'image_rate_limit_at_cap',
                }));
            }
        }
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
