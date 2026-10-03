/**
 * Is a school's dedicated number ready for a REAL carrier? (R2-6, class gate)
 *
 * A real-carrier selection (vobiz / knowlarity) may dispatch only when ALL of:
 *   1. SAMPARK_LIVE_DIAL_ENABLED is exactly 'true'   (checked by the gate, rule 8)
 *   2. the school has set a caller id (valid E.164, not in the synthetic +915 range)
 *   3. the school confirmed that number is registered to the school (TRAI: the
 *      school is the registered sender, plan §17)
 *   4. the school's saved provider is the carrier being selected
 * This module is the pure test of 2-4; the evaluateGate rule that uses it runs at
 * materialisation AND at dispatch, so changing the settings after approval still
 * stops a call. Absent settings (`school.carrier` unset) are "nothing set": not ready.
 */

import { classifyPhone, isValidCallerId } from '@/lib/sampark/phone';
import type { CarrierKind, SamparkSchool } from '@/types/sampark';

export function callerIdReady(school: Pick<SamparkSchool, 'carrier'>, carrierKind: CarrierKind): boolean {
    const c = school.carrier;
    if (!c) return false;
    if (carrierKind === 'simulated') return true; // the simulated carrier needs no number
    if (c.provider !== carrierKind) return false;
    if (c.registeredToSchool !== true) return false;
    if (typeof c.callerId !== 'string' || !isValidCallerId(c.callerId)) return false;
    return classifyPhone(c.callerId) !== 'synthetic';
}
