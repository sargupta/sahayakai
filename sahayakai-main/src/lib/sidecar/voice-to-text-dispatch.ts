/**
 * Voice-to-text dispatcher (Phase I).
 *
 * The Next.js voice-to-text route already has a 3-tier fallback:
 *   1. Sarvam STT (purpose-built for Indian languages, cheaper).
 *   2. Gemini multimodal via Genkit (existing fallback).
 *   3. (Phase I:) Gemini multimodal via the ADK sidecar.
 *
 * This dispatcher slots in BETWEEN tier 1 and tier 2/3. Sarvam stays
 * as the primary path; the dispatcher routes tier-2/3 traffic to
 * Genkit vs sidecar based on `SAHAYAKAI_VOICE_TO_TEXT_MODE`.
 *
 * Modes:
 * - `off`     : pure passthrough to Genkit Gemini.
 * - `shadow`  : run Genkit; in parallel call sidecar; return Genkit.
 * - `canary`/
 *   `full`   : call sidecar; on failure → Genkit.
 */
import {
    voiceToText,
    type VoiceToTextOutput,
} from '@/ai/flows/voice-to-text';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarVoiceToText,
    VoiceToTextSidecarBehaviouralError,
    VoiceToTextSidecarConfigError,
    VoiceToTextSidecarHttpError,
    VoiceToTextSidecarTimeoutError,
    type SidecarVoiceToTextRequest,
    type SidecarVoiceToTextResponse,
} from './voice-to-text-client';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in voice-to-text-client.ts so the Genkit fallback
// gets the same overall budget as the sidecar path. Phase J.2 hot-fix
// (forensic finding P0 #7) — closes the ~670s zombie path where a
// hung Genkit fallback could block long after the sidecar returned.
const FALLBACK_TIMEOUT_MS = 70_000;

export type VoiceToTextSidecarMode =
    | 'off' | 'shadow' | 'canary' | 'full';

export interface VoiceToTextSidecarDecision {
    mode: VoiceToTextSidecarMode;
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
async function readMode(): Promise<VoiceToTextSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.voiceToTextSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.voiceToTextSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideVoiceToTextDispatch(
    uid: string,
): Promise<VoiceToTextSidecarDecision> {
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

export type VoiceToTextDispatchSource =
    | 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedVoiceToText extends VoiceToTextOutput {
    source: VoiceToTextDispatchSource;
    decision: VoiceToTextSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface VoiceToTextDispatchInput {
    audioDataUri: string;
    userId: string;
}

function inputToSidecarRequest(
    input: VoiceToTextDispatchInput,
): SidecarVoiceToTextRequest {
    return {
        audioDataUri: input.audioDataUri,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarVoiceToTextResponse,
    decision: VoiceToTextSidecarDecision,
): DispatchedVoiceToText {
    return {
        text: res.text,
        language: res.language ?? undefined,
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
    out: VoiceToTextOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: VoiceToTextSidecarDecision,
): DispatchedVoiceToText {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: VoiceToTextDispatchInput) {
    try {
        const out = await withTimeout(
            voiceToText({ audioDataUri: input.audioDataUri }),
            FALLBACK_TIMEOUT_MS,
            'voice-to-text genkit fallback',
        );
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarVoiceToTextRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarVoiceToText(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: VoiceToTextSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'voice_to_text.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchVoiceToText(
    input: VoiceToTextDispatchInput,
): Promise<DispatchedVoiceToText> {
    const decision = await decideVoiceToTextDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            voiceToText({ audioDataUri: input.audioDataUri }),
            FALLBACK_TIMEOUT_MS,
            'voice-to-text genkit fallback',
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
        sidecar.error instanceof VoiceToTextSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof VoiceToTextSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof VoiceToTextSidecarHttpError
                ? 'http'
                : sidecar.error instanceof VoiceToTextSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await withTimeout(
        voiceToText({ audioDataUri: input.audioDataUri }),
        FALLBACK_TIMEOUT_MS,
        'voice-to-text genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
