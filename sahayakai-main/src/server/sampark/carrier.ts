/**
 * Carrier selection (contract §5). The ONLY place a Sampark carrier is chosen.
 *
 *   practice  → the simulated carrier (no network, deterministic per call id)
 *   test/live → refused with LIVE_DIAL_DISABLED unless SAMPARK_LIVE_DIAL_ENABLED
 *               is exactly 'true' — and slice 1 has no real adapter at all, so
 *               it is refused either way. The Vobiz adapter arrives in its own
 *               PR, behind this flag, with class gates 1–4 widened to cover it.
 *
 * This module constructs a carrier; only the dispatcher ever calls `place`
 * (class gate 2).
 */

import { createSimulatedCarrier } from '@/lib/sampark/dispatch/simulated-carrier';
import { readVobizConfig } from '@/lib/vobiz/client';
import type { Carrier } from '@/lib/sampark/ports';
import type { CarrierKind, SamparkSchool } from '@/types/sampark';
import { conflict } from '@/server/sampark/errors';

export const LIVE_DIAL_DISABLED = 'LIVE_DIAL_DISABLED';

export function liveDialEnabled(): boolean {
    return process.env.SAMPARK_LIVE_DIAL_ENABLED === 'true';
}

/**
 * The origin Vobiz calls back on (answer, keypad, status, audio). Taken ONLY from
 * SAMPARK_PUBLIC_BASE_URL, never from a request's Host header (plan §16 row 21).
 * Null unless it is a plain https origin.
 */
export function samparkPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
    const raw = env.SAMPARK_PUBLIC_BASE_URL?.trim();
    if (!raw) return null;
    try {
        const url = new URL(raw);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
        if (url.pathname !== '/' && url.pathname !== '') return null;
        return url.origin;
    } catch {
        return null;
    }
}

export type LiveDialBlocker = 'LIVE_DIAL_DISABLED' | 'PUBLIC_BASE_URL_MISSING' | 'CARRIER_UNCONFIGURED';

/** Why this deployment cannot place real (Test-mode) calls, or null when it can. */
export function liveDialBlocker(env: NodeJS.ProcessEnv = process.env): LiveDialBlocker | null {
    if (env.SAMPARK_LIVE_DIAL_ENABLED !== 'true') return 'LIVE_DIAL_DISABLED';
    if (!samparkPublicBaseUrl(env)) return 'PUBLIC_BASE_URL_MISSING';
    if (!readVobizConfig(env)) return 'CARRIER_UNCONFIGURED';
    return null;
}

function liveDialDisabled() {
    return conflict(LIVE_DIAL_DISABLED, liveDialEnabled()
        ? 'No live carrier is available in this release'
        : 'Live dialling is disabled for this deployment');
}

/** Which carrier WOULD place a call for this school. Throws LIVE_DIAL_DISABLED for any non-practice mode in slice 1. */
export function carrierKindFor(school: SamparkSchool): CarrierKind {
    if (school.mode === 'practice') return 'simulated';
    throw liveDialDisabled();
}

export function carrierFor(school: SamparkSchool): Carrier {
    if (carrierKindFor(school) === 'simulated') return createSimulatedCarrier();
    throw liveDialDisabled();
}

/**
 * For dry runs (audience summaries): the carrier kind the gate should assume.
 * A school whose mode cannot dial yet is evaluated as if a real carrier would
 * be used, so the summary shows `mode_forbids_dialing` instead of throwing.
 */
export function carrierKindForDryRun(school: SamparkSchool): CarrierKind {
    try {
        return carrierKindFor(school);
    } catch {
        return 'vobiz';
    }
}
