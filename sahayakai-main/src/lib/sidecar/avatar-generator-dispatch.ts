/**
 * Avatar generator dispatcher (Phase F.2).
 *
 * Sidecar produces ONLY the image (it has no Firebase Storage
 * credentials). Storage write (Firebase Storage + users/{uid}/avatars/)
 * stays in Next.js. The dispatcher mirrors the Genkit flow's storage
 * write when sidecar is the source so both code paths behave the same
 * downstream.
 *
 * Modes:
 * - `off`     : pure passthrough to Genkit `generateAvatar`.
 * - `shadow`  : run Genkit; in parallel call sidecar; return Genkit;
 *               log diff for offline parity scoring.
 * - `canary`/
 *   `full`   : call sidecar; on success, write image to Firebase
 *               Storage in Next.js and return sidecar's image.
 *               On sidecar failure, fall back to Genkit.
 */
import {
    generateAvatar,
    type AvatarGeneratorInput,
    type AvatarGeneratorOutput,
} from '@/ai/flows/avatar-generator';
import {
    AvatarSidecarBehaviouralError,
    AvatarSidecarConfigError,
    AvatarSidecarHttpError,
    AvatarSidecarTimeoutError,
    callSidecarAvatar,
    type SidecarAvatarRequest,
    type SidecarAvatarResponse,
} from './avatar-generator-client';

export type AvatarSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface AvatarSidecarDecision {
    mode: AvatarSidecarMode;
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

function readMode(): AvatarSidecarMode {
    const raw = (process.env.SAHAYAKAI_AVATAR_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_AVATAR_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

export function decideAvatarDispatch(uid: string): AvatarSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
    if (bucket < percent)
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type AvatarDispatchSource =
    | 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedAvatar extends AvatarGeneratorOutput {
    source: AvatarDispatchSource;
    decision: AvatarSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface AvatarDispatchInput extends AvatarGeneratorInput {
    userId: string;
}

function inputToSidecarRequest(
    input: AvatarDispatchInput,
): SidecarAvatarRequest {
    return {
        name: input.name,
        userId: input.userId,
    };
}

async function persistSidecarAvatar(
    imageDataUri: string,
    userId: string,
): Promise<void> {
    // Mirrors the storage write in `avatar-generator.ts`. Kept inline
    // here so the dispatcher does not modify the existing flow file.
    const { v4: uuidv4 } = await import('uuid');
    const { format } = await import('date-fns');
    const { getStorageInstance, getDb } = await import('@/lib/firebase-admin');

    const now = new Date();
    const timestamp = format(now, 'yyyyMMdd_HHmmss');
    const contentId = uuidv4();
    const fileName = `${timestamp}_${contentId}.png`;
    const filePath = `users/${userId}/avatars/${fileName}`;

    const storage = await getStorageInstance();
    const file = storage.bucket().file(filePath);

    const buffer = Buffer.from(imageDataUri.split(',')[1], 'base64');
    await file.save(buffer, {
        resumable: false,
        metadata: { contentType: 'image/png' },
    });

    const db = await getDb();
    await db.collection('users').doc(userId).set({
        avatarUrl: filePath,
    }, { merge: true });
}

function sidecarToDispatched(
    res: SidecarAvatarResponse,
    decision: AvatarSidecarDecision,
): DispatchedAvatar {
    return {
        imageDataUri: res.imageDataUri,
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
    out: AvatarGeneratorOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: AvatarSidecarDecision,
): DispatchedAvatar {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: AvatarDispatchInput) {
    try {
        const out = await generateAvatar(input);
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarAvatarRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarAvatar(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: AvatarSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'avatar.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchAvatar(
    input: AvatarDispatchInput,
): Promise<DispatchedAvatar> {
    const decision = decideAvatarDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateAvatar(input);
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

    // canary / full
    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        // Storage write — fail-soft so a Storage error doesn't drop
        // an otherwise-good image. Genkit's `generateAvatar` does the
        // same: a Storage failure inside the flow surfaces but doesn't
        // discard the in-memory image.
        if (input.userId) {
            try {
                await persistSidecarAvatar(
                    sidecar.res.imageDataUri,
                    input.userId,
                );
            } catch (storageErr) {
                // eslint-disable-next-line no-console
                console.warn(
                    JSON.stringify({
                        event: 'avatar.dispatch.storage_failed',
                        uid: input.userId,
                        error:
                            storageErr instanceof Error
                                ? storageErr.message
                                : String(storageErr),
                    }),
                );
            }
        }
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof AvatarSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof AvatarSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof AvatarSidecarHttpError
                ? 'http'
                : sidecar.error instanceof AvatarSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await generateAvatar(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
