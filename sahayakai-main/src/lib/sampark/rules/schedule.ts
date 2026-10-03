/**
 * When an approved proposal may first be dialled (plan §2A, §4④). Pure.
 *
 * Concern purposes (A1, A3, A4: requests to talk about a child's difficulties)
 * are NEVER placed on a Friday or Saturday (IST): research associates Friday
 * report-card release with a sharp rise in verified physical abuse the following
 * day, so a call about a child's problems must arrive when the school can follow
 * up next morning. The window module already refuses those days for any purpose
 * with `noFridaySaturday`; this function turns that into an explicit earliest
 * time stored on the intent, so the rule holds at SCHEDULING as well as at
 * dispatch (two independent layers).
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import { istParts } from '@/lib/sampark/policy/ist';
import { samparkWindowVerdict } from '@/lib/sampark/policy/window';
import type { PurposeId, SamparkSchool } from '@/types/sampark';

/** The first instant at or after `from` at which the purpose may be dialled, or null if the window can never open. */
export function earliestDialAt(purpose: PurposeId, school: SamparkSchool, from: Date): Date | null {
    const spec = purposeSpec(purpose);
    const verdict = samparkWindowVerdict(school, spec, from);
    if (verdict.allowed) return from;
    return verdict.nextAllowedAt;
}

/** True when `at` falls on a Friday or Saturday in IST. */
export function isFridayOrSaturdayIst(at: Date): boolean {
    const wd = istParts(at).weekday;
    return wd === 5 || wd === 6;
}
