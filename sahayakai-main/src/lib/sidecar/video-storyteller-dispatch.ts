/**
 * Video storyteller dispatcher (Phase F.1).
 *
 * The Genkit `getVideoRecommendations` orchestrates: cache check, parallel
 * RSS + AI fetch, YouTube search, deterministic local ranking, curated
 * fallback merge, cache write. The sidecar replaces ONLY the AI call
 * (categories + personalizedMessage).
 *
 * Modes:
 * - `off`     : pure passthrough to Genkit `getVideoRecommendations`.
 * - `shadow`  : run Genkit; in parallel call sidecar; return Genkit;
 *               log diff for offline parity scoring.
 * - `canary`/
 *   `full`   : call sidecar for AI (categories + personalizedMessage);
 *               then call Genkit `getVideoRecommendations` to fill in
 *               `categorizedVideos`; merge so the response uses
 *               sidecar's `categories` + `personalizedMessage` and
 *               Genkit's `categorizedVideos` + cache metadata.
 *
 * Flag default is `off`. For Phase F.1 we ship the wiring; flag flip
 * happens later with parity evidence.
 */
import {
    getVideoRecommendations,
} from '@/ai/flows/video-storyteller';
import type { VideoStorytellerInput } from '@/ai/schemas/video-storyteller';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarVideoStoryteller,
    VideoStorytellerSidecarBehaviouralError,
    VideoStorytellerSidecarConfigError,
    VideoStorytellerSidecarHttpError,
    VideoStorytellerSidecarTimeoutError,
    type SidecarVideoStorytellerRequest,
    type SidecarVideoStorytellerResponse,
} from './video-storyteller-client';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in video-storyteller-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 15_000;

export type VideoStorytellerSidecarMode =
    | 'off' | 'shadow' | 'canary' | 'full';

export interface VideoStorytellerSidecarDecision {
    mode: VideoStorytellerSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string | undefined): number {
    if (!uid) return 0;
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<VideoStorytellerSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.videoStorytellerSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.videoStorytellerSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideVideoStorytellerDispatch(
    uid: string | undefined,
): Promise<VideoStorytellerSidecarDecision> {
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

export type VideoStorytellerDispatchSource =
    | 'genkit' | 'sidecar' | 'sidecar+genkit_videos' | 'genkit_fallback';

export interface DispatchedVideoStoryteller {
    categories: {
        pedagogy: string[];
        storytelling: string[];
        govtUpdates: string[];
        courses: string[];
        topRecommended: string[];
    };
    personalizedMessage: string;
    categorizedVideos: Record<string, unknown>;
    fromCache: boolean;
    latencyScore: number;
    source: VideoStorytellerDispatchSource;
    decision: VideoStorytellerSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface VideoStorytellerDispatchInput
    extends VideoStorytellerInput {
    userId?: string;
}

function inputToSidecarRequest(
    input: VideoStorytellerDispatchInput,
): SidecarVideoStorytellerRequest {
    return {
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        topic: input.topic ?? undefined,
        language: input.language ?? undefined,
        state: input.state ?? undefined,
        educationBoard: input.educationBoard ?? undefined,
        userId: input.userId ?? 'anon',
    };
}

function genkitToDispatched(
    out: Record<string, any>,
    source: 'genkit' | 'genkit_fallback',
    decision: VideoStorytellerSidecarDecision,
): DispatchedVideoStoryteller {
    return {
        categories: out.categories ?? {
            pedagogy: [], storytelling: [], govtUpdates: [],
            courses: [], topRecommended: [],
        },
        personalizedMessage: out.personalizedMessage ?? '',
        categorizedVideos: out.categorizedVideos ?? {},
        fromCache: Boolean(out.fromCache),
        latencyScore: Number(out.latencyScore ?? 0),
        source,
        decision,
    };
}

function mergedToDispatched(
    sidecar: SidecarVideoStorytellerResponse,
    genkitOut: Record<string, any>,
    decision: VideoStorytellerSidecarDecision,
): DispatchedVideoStoryteller {
    return {
        categories: sidecar.categories,
        personalizedMessage: sidecar.personalizedMessage,
        categorizedVideos: genkitOut.categorizedVideos ?? {},
        fromCache: Boolean(genkitOut.fromCache),
        latencyScore: Number(genkitOut.latencyScore ?? 0),
        source: 'sidecar+genkit_videos',
        decision,
        sidecarTelemetry: {
            sidecarVersion: sidecar.sidecarVersion,
            latencyMs: sidecar.latencyMs,
            modelUsed: sidecar.modelUsed,
        },
    };
}

async function runGenkitSafe(input: VideoStorytellerDispatchInput) {
    try {
        const out = await withTimeout(
            getVideoRecommendations(input),
            FALLBACK_TIMEOUT_MS,
            'video-storyteller genkit fallback',
        );
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarVideoStorytellerRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarVideoStoryteller(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: VideoStorytellerSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'video_storyteller.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchVideoStoryteller(
    input: VideoStorytellerDispatchInput,
): Promise<DispatchedVideoStoryteller> {
    const decision = await decideVideoStorytellerDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            getVideoRecommendations(input),
            FALLBACK_TIMEOUT_MS,
            'video-storyteller genkit fallback',
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

    // canary / full: call sidecar AND genkit (genkit fills in
    // categorizedVideos, since YouTube search + ranking stays in Next.js).
    const [sidecar, genkit] = await Promise.all([
        runSidecarSafe(sidecarRequest),
        runGenkitSafe(input),
    ]);

    if (sidecar.ok && genkit.ok) {
        logDispatch(decision, {
            source: 'sidecar+genkit_videos',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        return mergedToDispatched(sidecar.res, genkit.out, decision);
    }

    if (!sidecar.ok && genkit.ok) {
        const errorClass =
            sidecar.error instanceof VideoStorytellerSidecarBehaviouralError
                ? 'behavioural'
                : sidecar.error instanceof VideoStorytellerSidecarTimeoutError
                  ? 'timeout'
                  : sidecar.error instanceof VideoStorytellerSidecarHttpError
                    ? 'http'
                    : sidecar.error instanceof VideoStorytellerSidecarConfigError
                      ? 'config'
                      : 'unknown';
        logDispatch(decision, {
            source: 'genkit_fallback',
            uid: input.userId,
            sidecarErrorClass: errorClass,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        return genkitToDispatched(genkit.out, 'genkit_fallback', decision);
    }

    if (!genkit.ok) throw genkit.error;
    // Both failed (shouldn't reach here because we throw above).
    throw new Error('video-storyteller dispatcher: both sidecar and genkit failed');
}
