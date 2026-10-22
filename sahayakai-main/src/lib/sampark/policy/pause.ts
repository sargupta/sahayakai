/**
 * The one rule for what a school pause stops (hardening H3, docs/sampark/EDGE_CASES.md §3).
 *
 * Scope 'all' stops every call. Scope 'routine' stops every call except emergency
 * purposes, the same line a routine suppression draws (gate.ts `suppressionApplies`).
 * The dispatcher (no new call starts), the answer webhook (a call ringing when the pause
 * was set is refused) and the pause itself (which ringing calls to hang up) all ask this
 * function, so the three can never disagree. An unknown purpose is stopped (fail closed).
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import type { PurposeId, SchoolPause } from '@/types/sampark';

export function pauseStopsPurpose(pause: SchoolPause | null | undefined, purpose: PurposeId): boolean {
    if (!pause) return false;
    if (pause.scope !== 'routine') return true;
    try {
        return !purposeSpec(purpose).emergency;
    } catch {
        return true;
    }
}
