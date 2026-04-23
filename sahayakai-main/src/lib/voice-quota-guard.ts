import 'server-only';
import { NextResponse } from 'next/server';
import { PLAN_CONFIG, PLAN_DISPLAY_NAMES } from './plan-config';
import { normalizePlan } from './plan-utils';
import { getMonthlyVoiceCloudMinutes, incrementVoiceCloudMinutes } from './usage-counters';

/**
 * Voice cloud minute quota enforcement.
 *
 * Why a dedicated guard (not withPlanCheck): voice is metered in minutes per
 * call, not count per call. A single lesson narration can be 2+ minutes; a
 * quick phrase is < 10 seconds. The count-based withPlanCheck would unfairly
 * bill long and short calls the same.
 *
 * Flow:
 *   1. Route calls ensureVoiceQuota(req) BEFORE invoking Sarvam / Google / Gemini.
 *   2. If the plan has 0 minutes → 403. If used >= limit → 429.
 *   3. After a successful provider call, route calls recordVoiceMinutes(uid, mins).
 *
 * Browser SpeechRecognition / SpeechSynthesis stays free and never hits these
 * endpoints, so the quota only throttles real provider cost.
 */

export interface VoiceQuotaOk {
    ok: true;
    uid: string;
    plan: ReturnType<typeof normalizePlan>;
    limit: number;           // -1 means unlimited
    used: number;
    remaining: number;       // Infinity if unlimited
}

export interface VoiceQuotaBlocked {
    ok: false;
    response: NextResponse;
}

export type VoiceQuotaResult = VoiceQuotaOk | VoiceQuotaBlocked;

/**
 * Check a request's voice quota. Returns either { ok: true, ... } with headroom
 * info, or { ok: false, response } with a ready-to-return 401/403/429.
 */
export async function ensureVoiceQuota(req: Request): Promise<VoiceQuotaResult> {
    const uid = req.headers.get('x-user-id');
    if (!uid) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const rawPlan = req.headers.get('x-user-plan') || 'free';
    const plan = normalizePlan(rawPlan);
    const limit = PLAN_CONFIG[plan].voiceCloudMinutesPerMonth;

    // 0 = no cloud voice at all on this tier (Free)
    if (limit === 0) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error: 'PLAN_UPGRADE_REQUIRED',
                    message: `Cloud voice (Sarvam / premium neural TTS) requires ${PLAN_DISPLAY_NAMES.pro} or higher. Browser voice stays free on all plans.`,
                    requiredPlan: 'pro',
                    currentPlan: plan,
                    feature: 'voice-cloud',
                },
                { status: 403 }
            ),
        };
    }

    // -1 = unlimited, skip the monthly read
    if (limit === -1) {
        return { ok: true, uid, plan, limit, used: 0, remaining: Infinity };
    }

    const used = await getMonthlyVoiceCloudMinutes(uid);
    if (used >= limit) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error: 'USAGE_LIMIT_REACHED',
                    message: `You've used your ${limit} cloud voice minutes for this month. Resets on the 1st. Upgrade for more minutes or switch to browser voice.`,
                    used,
                    limit,
                    feature: 'voice-cloud',
                    currentPlan: plan,
                },
                { status: 429 }
            ),
        };
    }

    return { ok: true, uid, plan, limit, used, remaining: limit - used };
}

/**
 * Record voice cloud minutes after a successful provider call. Fire-and-forget;
 * never throws. Pass whichever minute estimate the route computed (char-based
 * for TTS, file-size or duration based for STT).
 */
export function recordVoiceMinutes(uid: string, minutes: number): void {
    incrementVoiceCloudMinutes(uid, minutes).catch(() => {});
}

/**
 * TTS minute estimate from character count. ~150 words/min × ~5 chars/word
 * ≈ 750 chars/min; we use 900 chars/min to bias slightly in the user's favour
 * (under-count minutes used → users get a little more runway than the raw
 * provider cost). Good enough for MVP metering; swap to real audio duration
 * if we later need exact billing.
 */
export function estimateTTSMinutes(charCount: number): number {
    if (!charCount || charCount <= 0) return 0;
    return charCount / 900;
}

/**
 * STT minute estimate from audio file byte size. Opus/WebM at the browser's
 * default mediaRecorder bitrate (~24 kbps) ≈ 3,000 bytes/sec = 180,000 B/min.
 * Use this as the divisor; over-compressed formats will over-count slightly,
 * WAV uploads will under-count, both acceptable for MVP metering.
 */
export function estimateSTTMinutesFromBytes(byteSize: number): number {
    if (!byteSize || byteSize <= 0) return 0;
    return byteSize / 180_000;
}
