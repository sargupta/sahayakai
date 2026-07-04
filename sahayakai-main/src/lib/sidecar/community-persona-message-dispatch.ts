/**
 * Community-persona-message dispatcher.
 *
 * Same off / shadow / canary / full pattern as the other sidecar
 * agents. Reads mode + percent from Firestore via `getFeatureFlags()`
 * so the auto-abort Cloud Function (Firestore writer only) can roll
 * this agent back without a Cloud Run redeploy.
 *
 * The Genkit flow at `src/ai/flows/community-persona-message.ts`
 * remains the safe baseline (used in `off` mode and as the
 * fallback path on every sidecar failure class). The flow is invoked
 * via `generateCommunityPersonaMessage(persona, recentMessages, mode)`
 * which is the same surface the persona-pulse scheduler and the
 * seed script already call.
 */

import {
    generateCommunityPersonaMessage,
    type PersonaMessageOutput,
    type RecentMessageContext,
} from '@/ai/flows/community-persona-message';
import type { PersonaDef } from '@/ai/data/community-personas';
import { getFeatureFlags } from '@/lib/feature-flags';

import {
    callSidecarCommunityPersonaMessage,
    CommunityPersonaMessageSidecarBehaviouralError,
    CommunityPersonaMessageSidecarConfigError,
    CommunityPersonaMessageSidecarHttpError,
    CommunityPersonaMessageSidecarTimeoutError,
    type CommunityPersonaMode,
    type SidecarCommunityPersonaMessageRequest,
    type SidecarCommunityPersonaMessageResponse,
} from './community-persona-message-client';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { shouldRunCanaryShadowDiff } from './canary-shadow-diff';
import { withTimeout } from './with-timeout';
import { logger } from '@/lib/logger';

// 10s fallback budget — persona message is a single short Gemini
// call (~1-3s typical). 10s gives p99 headroom.
const FALLBACK_TIMEOUT_MS = 10_000;

// ─── Firestore-backed dispatch decision ────────────────────────────────────

export type CommunityPersonaMessageSidecarMode =
    | 'off'
    | 'shadow'
    | 'canary'
    | 'full';

export interface CommunityPersonaMessageSidecarDecision {
    mode: CommunityPersonaMessageSidecarMode;
    reason: string;
    bucket: number;
    /** Q4C: raw flag value pre-bucket. */
    configuredMode?: CommunityPersonaMessageSidecarMode;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

async function readMode(): Promise<CommunityPersonaMessageSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.communityPersonaMessageSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.communityPersonaMessageSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideCommunityPersonaMessageDispatch(
    uid: string,
): Promise<CommunityPersonaMessageSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket, configuredMode: mode };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket, configuredMode: mode };
    const percent = await readPercent();
    if (bucket < percent) {
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket, configuredMode: mode };
    }
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket, configuredMode: mode };
}

// ─── Dispatcher ────────────────────────────────────────────────────────────

export type CommunityPersonaMessageDispatchSource =
    | 'genkit'
    | 'sidecar'
    | 'genkit_fallback';

export interface DispatchedCommunityPersonaMessage
    extends PersonaMessageOutput {
    source: CommunityPersonaMessageDispatchSource;
    decision: CommunityPersonaMessageSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface CommunityPersonaMessageDispatchInput {
    persona: PersonaDef;
    recentMessages?: RecentMessageContext[];
    mode?: CommunityPersonaMode;
    /** Bucketing key. Use the demo persona id for seeded conversations
     *  (so the same persona consistently lands on the same path), or
     *  the caller's uid in live persona-pulse contexts. */
    userId: string;
}

function inputToSidecarRequest(
    input: CommunityPersonaMessageDispatchInput,
): SidecarCommunityPersonaMessageRequest {
    const recent = (input.recentMessages ?? []).slice(-5);
    return {
        personaName: input.persona.displayName,
        personaState: input.persona.state,
        personaSubject: input.persona.subject,
        personaGradeLevel: input.persona.gradeLevel,
        personaVoiceTone: input.persona.voiceTone,
        preferredLanguage: input.persona.preferredLanguage,
        yearsExperience: input.persona.yearsExperience,
        recentMessages: recent.map((m) => ({
            authorName: m.authorName,
            text: m.text,
        })),
        mode: input.mode ?? 'auto',
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarCommunityPersonaMessageResponse,
    decision: CommunityPersonaMessageSidecarDecision,
): DispatchedCommunityPersonaMessage {
    return {
        message: res.message,
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
    out: PersonaMessageOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: CommunityPersonaMessageSidecarDecision,
): DispatchedCommunityPersonaMessage {
    return { ...out, source, decision };
}

async function runGenkitSafe(
    input: CommunityPersonaMessageDispatchInput,
): Promise<{ ok: true; out: PersonaMessageOutput } | { ok: false; error: Error }> {
    try {
        const out = await withTimeout(
            generateCommunityPersonaMessage(
                input.persona,
                input.recentMessages ?? [],
                input.mode ?? 'auto',
            ),
            FALLBACK_TIMEOUT_MS,
            'community-persona-message genkit fallback',
        );
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarCommunityPersonaMessageRequest,
): Promise<
    | { ok: true; res: SidecarCommunityPersonaMessageResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarCommunityPersonaMessage(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: CommunityPersonaMessageSidecarDecision,
    payload: Record<string, unknown>,
): void {
    logger.info('community_persona_message.dispatch', 'community_persona_message.dispatch', {
        mode: decision.mode,
        reason: decision.reason,
        bucket: decision.bucket,
        ...payload,
    });
}

export async function dispatchCommunityPersonaMessage(
    input: CommunityPersonaMessageDispatchInput,
): Promise<DispatchedCommunityPersonaMessage> {
    const decision = await decideCommunityPersonaMessageDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateCommunityPersonaMessage(
                input.persona,
                input.recentMessages ?? [],
                input.mode ?? 'auto',
            ),
            FALLBACK_TIMEOUT_MS,
            'community-persona-message genkit fallback',
        );
        logDispatch(decision, { source: 'genkit', uid: input.userId });

        // Q4C — canary "bucket-overshoot" observation. When the agent
        // is mid-canary (configuredMode==='canary') but THIS teacher's
        // bucket landed >=percent (mode collapsed to 'off'), fire the
        // sidecar in the background and write a shadow_diff so the
        // promotion gate has a non-zero denominator.
        if (
            shouldRunCanaryShadowDiff() &&
            decision.configuredMode === 'canary'
        ) {
            void runSidecarSafe(sidecarRequest).then((sc) => {
                void writeAgentShadowDiff({
                    agent: 'community-persona-message',
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
            agent: 'community-persona-message',
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

        // Q4C — canary/full observation: fire Genkit in the background
        // and write a shadow_diff so the promotion-gate aggregator has
        // a live (genkit, sidecar) parity signal during the rollout.
        // 2x Gemini cost while observation is on; toggle the constant
        // off post-promotion to reclaim it.
        if (shouldRunCanaryShadowDiff()) {
            const __q4cGenkitStartedAt = Date.now();
            void runGenkitSafe(input).then((gk) => {
                void writeAgentShadowDiff({
                    agent: 'community-persona-message',
                    uid: input.userId,
                    genkit: gk.ok ? gk.out : null,
                    sidecar: sidecar.res,
                    genkitLatencyMs: Date.now() - __q4cGenkitStartedAt,
                    sidecarLatencyMs: sidecar.latencyMs,
                    sidecarOk: true,
                });
            });
        }
                return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof CommunityPersonaMessageSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof CommunityPersonaMessageSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof CommunityPersonaMessageSidecarHttpError
                ? 'http'
                : sidecar.error instanceof CommunityPersonaMessageSidecarConfigError
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
        generateCommunityPersonaMessage(
            input.persona,
            input.recentMessages ?? [],
            input.mode ?? 'auto',
        ),
        FALLBACK_TIMEOUT_MS,
        'community-persona-message genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
