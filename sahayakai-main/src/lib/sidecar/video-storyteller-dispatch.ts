/**
 * Video storyteller dispatcher (Phase F.1, refined Phase M.1).
 *
 * The Genkit `getVideoRecommendations` originally orchestrated: cache
 * check, parallel RSS + AI fetch, YouTube search, deterministic local
 * ranking, curated fallback merge, cache write. The sidecar replaces
 * ONLY the AI call (categories + personalizedMessage).
 *
 * Modes:
 * - `off`     : pure passthrough to Genkit `getVideoRecommendations`
 *               (one Gemini call inside).
 * - `shadow`  : run Genkit; in parallel call sidecar; return Genkit;
 *               log diff for offline parity scoring (one Gemini +
 *               one sidecar call — only Genkit's output is used).
 * - `canary`/
 *   `full`   : call sidecar for AI (categories + personalizedMessage)
 *               and `getVideoCategorySearchResults` for the YouTube
 *               half. The YouTube half is local + RSS + YouTube Data
 *               API only — NO Gemini call.
 *
 * Phase M.1 forensic fix (P0 #8): canary/full previously ran BOTH
 * sidecar AND `getVideoRecommendations` in parallel. Sidecar produced
 * categories+message; Genkit produced categorizedVideos but ALSO
 * wasted a Gemini call producing categories+message we discarded.
 * This was a permanent +100% AI spend at any rollout %. The split
 * exposes the two halves so the AI half runs exactly ONCE per
 * dispatched request, regardless of mode or sidecar success.
 *
 * Phase K (forensic audit P0 #2): video-storyteller does NOT persist
 * to a per-user library (recommendations are cached at the system
 * level), so the sidecar dispatcher does not write Storage/Firestore.
 * The pre-call rate-limit gate is still lifted into the dispatcher so
 * a sidecar-routed call cannot bypass `checkServerRateLimit`.
 */
import {
    getVideoCategorySearchResults,
    getVideoRecommendations,
} from '@/ai/flows/video-storyteller';
import type {
    VideoStorytellerInput,
    VideoStorytellerOutput,
} from '@/ai/schemas/video-storyteller';
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
import { writeAgentShadowDiff } from './shadow-diff-writer';
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

/**
 * Merges sidecar AI result with the videos-only result from
 * `getVideoCategorySearchResults`. NOTE Phase M.1: the second arg used
 * to be the full `getVideoRecommendations` output (which contained its
 * own redundant `categories` + `personalizedMessage` fields built by a
 * second Gemini call). It is now the YouTube-only shape, so we never
 * accidentally surface Genkit's discarded category data.
 *
 * The signature accepts a loose `Record<string, any>` because both
 * the cache-hit path and the live-fetch path of
 * `getVideoCategorySearchResults` return slightly different shapes
 * (cache-hit also has profileHash, expiresAt, etc.) — we read only
 * the fields we care about.
 */
function mergedToDispatched(
    sidecar: SidecarVideoStorytellerResponse,
    videosOnly: Record<string, any>,
    decision: VideoStorytellerSidecarDecision,
): DispatchedVideoStoryteller {
    return {
        categories: sidecar.categories,
        personalizedMessage: sidecar.personalizedMessage,
        categorizedVideos: videosOnly.categorizedVideos ?? {},
        fromCache: Boolean(videosOnly.fromCache),
        latencyScore: Number(videosOnly.latencyScore ?? 0),
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

/**
 * Phase M.1: YouTube-only branch used by canary/full when sidecar
 * succeeds. Calls `getVideoCategorySearchResults` (no Gemini) to do
 * cache check + RSS + YouTube Data API + local ranking + curated
 * merge. Wrapped with the same timeout budget as the Genkit fallback.
 */
async function runVideosOnlySafe(
    input: VideoStorytellerDispatchInput,
    aiResult: {
        categories: VideoStorytellerOutput['categories'];
        personalizedMessage: string;
    },
) {
    try {
        const out = await withTimeout(
            getVideoCategorySearchResults(input, aiResult),
            FALLBACK_TIMEOUT_MS,
            'video-storyteller youtube-only',
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
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            aiCallsCount: 1,
        });
        return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const shadowStartedAt = Date.now();
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarRequest),
        ]);
        const genkitLatencyMs = Date.now() - shadowStartedAt;
        // Shadow keeps both calls live (one Genkit, one sidecar) so we
        // can score parity offline — we DO NOT count this as a single
        // AI call: the user-facing call is Genkit (1) but the sidecar
        // shadow is also a Gemini-equivalent. Surfacing both counts so
        // the cost dashboard can see shadow's true overhead.
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
            aiCallsCount: 1,
            shadowSidecarCalled: true,
        });
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        // video-storyteller's userId is optional (anonymous recommendations
        // are allowed); fall back to 'anon' to keep the doc-id stable.
        void writeAgentShadowDiff({
            agent: 'video-storyteller',
            uid: input.userId ?? 'anon',
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

    // Phase K — pre-call rate-limit gate. Video-storyteller does NOT
    // persist a personal library entry (recommendations are cached at
    // the system level via the Genkit cache layer), but it still
    // costs Gemini tokens + YouTube quota in canary/full mode, so the
    // dispatcher must gate. On sidecar failure the Genkit fallback
    // path will gate again via its own internal rate-limit calls.
    if (input.userId) {
        const { checkServerRateLimit } = await import('@/lib/server-safety');
        await checkServerRateLimit(input.userId);
    }

    // Phase M.1 — canary / full now does NOT call
    // `getVideoRecommendations` (which would invoke Gemini twice).
    // Instead: sidecar produces categories + personalizedMessage; the
    // YouTube-only `getVideoCategorySearchResults` produces
    // categorizedVideos + cache metadata. Total Gemini calls: 1.
    //
    // We call the sidecar first; on success we then run the YouTube
    // branch with sidecar's categories. On sidecar failure we fall
    // back to the legacy `getVideoRecommendations` (one Gemini call
    // inside) so the user still gets a result.
    const sidecar = await runSidecarSafe(sidecarRequest);

    if (sidecar.ok) {
        const aiResult = {
            categories: sidecar.res.categories,
            personalizedMessage: sidecar.res.personalizedMessage,
        };
        const videos = await runVideosOnlySafe(input, aiResult);

        if (videos.ok) {
            logDispatch(decision, {
                source: 'sidecar+genkit_videos',
                uid: input.userId,
                sidecarLatencyMs: sidecar.latencyMs,
                aiCallsCount: 1,
            });
            return mergedToDispatched(sidecar.res, videos.out, decision);
        }

        // Sidecar succeeded but YouTube branch failed. Fall back to the
        // full Genkit path so the user still gets a result. This costs
        // one extra Gemini call (worst case), but this branch is rare
        // (RSS + YouTube both went wrong).
        const genkitFallback = await runGenkitSafe(input);
        if (genkitFallback.ok) {
            logDispatch(decision, {
                source: 'genkit_fallback',
                uid: input.userId,
                sidecarErrorClass: 'youtube_branch_failed',
                sidecarLatencyMs: sidecar.latencyMs,
                aiCallsCount: 1,
            });
            return genkitToDispatched(
                genkitFallback.out,
                'genkit_fallback',
                decision,
            );
        }
        throw videos.error;
    }

    // Sidecar failed — full Genkit fallback. ONE Gemini call inside
    // `getVideoRecommendations`. Total Gemini calls for this request: 1.
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

    const genkit = await runGenkitSafe(input);
    if (genkit.ok) {
        logDispatch(decision, {
            source: 'genkit_fallback',
            uid: input.userId,
            sidecarErrorClass: errorClass,
            sidecarLatencyMs: sidecar.latencyMs,
            aiCallsCount: 1,
        });
        return genkitToDispatched(genkit.out, 'genkit_fallback', decision);
    }

    throw genkit.error;
}
