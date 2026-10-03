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
import type { Carrier } from '@/lib/sampark/ports';
import type { CarrierKind, SamparkSchool } from '@/types/sampark';
import { conflict } from '@/server/sampark/errors';

export const LIVE_DIAL_DISABLED = 'LIVE_DIAL_DISABLED';

export function liveDialEnabled(): boolean {
    return process.env.SAMPARK_LIVE_DIAL_ENABLED === 'true';
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
        // The school's saved provider when it is a real one, so the summary can say the number is not set up.
        const provider = school.carrier?.provider;
        return provider === 'knowlarity' ? 'knowlarity' : 'vobiz';
    }
}
