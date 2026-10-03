/**
 * The Sampark gate (plan §4④): allow, defer until, or block with a reason.
 * Fail-closed, pure, and evaluated twice — when intents are materialised and
 * again at the moment of dispatch — because consent, suppression and hours
 * can all change in between (plan §1 principle 3).
 *
 * The ORDER below is the contract (docs/sampark/SLICE1_CONTRACT.md §3); the
 * first rule that fires wins, so the recorded reason is always the most
 * fundamental one:
 *
 *   1. purpose not dialable (human-only, or not a TRAI 'service' purpose)  → human_only_purpose
 *   2. purpose not yet available (status 'planned')                        → purpose_not_available
 *   3. guardian inactive or CRM do-not-contact                            → crm_do_not_contact
 *   4. suppression (scope 'all'; or 'routine' for a non-emergency purpose) → suppressed
 *   5. phone invalid                                                      → invalid_number
 *   6. synthetic phone on any non-simulated carrier                       → synthetic_number_not_allowed   (class gate 4)
 *   7. demo school on any non-simulated carrier                           → synthetic_number_not_allowed   (class gate 4)
 *   8. non-simulated carrier while SAMPARK_LIVE_DIAL_ENABLED !== 'true',
 *      or while the school is in practice mode                            → mode_forbids_dialing
 *   8b. non-simulated carrier and the school's dedicated number is not ready: no caller id, not
 *      registered to the school, a synthetic caller id, or a different provider  → caller_id_not_ready   (R2-6)
 *   9. child-audience purpose and any student carries a sensitive flag    → sensitive_flag                 (class gate 10)
 *  10. purpose excludes fee-waived and any student is RTE/waived/scholarship/staff → fee_category_excluded          (class gate 12)
 *  11. consent for the purpose group: denied → consent_denied, otherwise
 *      not granted → no_consent. An emergency purpose at a school that set
 *      emergencyBypassConsent may reach a family whose consent is merely
 *      UNRECORDED — never one that explicitly said no                    → consent_denied / no_consent
 *  12. no language resolvable                                            → language_unknown
 *  13. non-emergency and ≥ 4 calls to this phone in 30 days               → frequency_cap
 *  14. (dispatch stage only) outside the calling window                   → defer until the next opening
 */

import { isDialable, type PurposeSpec } from '@/lib/sampark/catalogue';
import { isFeeCallable } from '@/lib/sampark/rules/fee-categories';
import { callerIdReady } from '@/lib/sampark/policy/carrier-readiness';
import { resolveLanguage } from '@/lib/sampark/policy/language';
import { samparkWindowVerdict } from '@/lib/sampark/policy/window';
import type {
    BlockReason,
    CarrierKind,
    GuardianPreferences,
    ParentLanguage,
    SamparkGuardian,
    SamparkSchool,
    SamparkStudent,
    Suppression,
} from '@/types/sampark';

/** Routine calls per phone per 30 days before the cap blocks (plan §4④ "Frequency"). */
export const FREQUENCY_CAP = 4;
export const FREQUENCY_WINDOW_DAYS = 30;
export const FREQUENCY_WINDOW_MS = FREQUENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Used only if the window can never open (an empty school window): look again in a day. */
const NO_OPENING_RETRY_MS = 24 * 60 * 60 * 1000;

export interface GateInput {
    school: SamparkSchool;
    spec: PurposeSpec;
    guardian: SamparkGuardian;
    students: SamparkStudent[];
    preferences: GuardianPreferences | null;
    suppression: Suppression | null;
    /** Calls to this phoneHash in the last 30 days (non-emergency). */
    recentCallsToPhone: number;
    /** The carrier that WOULD place the call. */
    carrierKind: CarrierKind;
    now: Date;
    stage: 'materialise' | 'dispatch';
    /** True only for an intent created from an approved rule proposal; rule-driven purposes are refused without it. */
    viaProposal?: boolean;
}

export type GateVerdict =
    | { kind: 'allow'; language: ParentLanguage }
    | { kind: 'defer'; until: Date; reason: string }
    | { kind: 'block'; reason: BlockReason };

/** Dialable per the spec in hand AND per the catalogue — either saying no is enough (fail closed). */
function purposeIsDialable(spec: PurposeSpec): boolean {
    if (spec.mode === 'human_only' || spec.commercial !== 'service') return false;
    try {
        return isDialable(spec.id);
    } catch {
        return false;
    }
}

/**
 * A suppression stops routine calls (scope 'routine') or everything (scope 'all').
 * One the office has REVERSED after checking with the family (plan §5.1, e.g. a
 * child pressed 9) no longer suppresses.
 */
export function suppressionApplies(suppression: Suppression | null, spec: PurposeSpec): boolean {
    if (!suppression || suppression.officeVerification === 'reversed') return false;
    if (suppression.scope === 'all') return true;
    return suppression.scope === 'routine' && !spec.emergency;
}

/** True when a live (non-simulated) carrier may be used at all for this school right now. */
function liveDialPermitted(school: SamparkSchool): boolean {
    return process.env.SAMPARK_LIVE_DIAL_ENABLED === 'true' && school.mode !== 'practice';
}

export function evaluateGate(input: GateInput): GateVerdict {
    const { school, spec, guardian, students, preferences, suppression, carrierKind, now, stage } = input;
    const block = (reason: BlockReason): GateVerdict => ({ kind: 'block', reason });

    // 1–2. Purpose
    if (!purposeIsDialable(spec)) return block('human_only_purpose');
    if (spec.status === 'rule_driven') {
        if (!input.viaProposal) return block('purpose_not_available');
    } else if (spec.status !== 'available') return block('purpose_not_available');

    // 3–4. Do-not-contact
    if (!guardian.active || guardian.crmDoNotContact) return block('crm_do_not_contact');
    if (suppressionApplies(suppression, spec)) return block('suppressed');

    // 5–8. Number and carrier
    if (guardian.phoneClass === 'invalid') return block('invalid_number');
    const realCarrier = carrierKind !== 'simulated';
    if (realCarrier && guardian.phoneClass !== 'mobile') return block('synthetic_number_not_allowed');
    if (realCarrier && school.isDemo) return block('synthetic_number_not_allowed');
    if (realCarrier && !liveDialPermitted(school)) return block('mode_forbids_dialing');
    if (realCarrier && !callerIdReady(school, carrierKind)) return block('caller_id_not_ready');

    // 9–10. The children this call concerns
    if (spec.audience === 'child' && students.some((s) => (s.sensitiveFlags ?? []).length > 0)) {
        return block('sensitive_flag');
    }
    if (spec.excludesFeeWaived && students.some((s) => !isFeeCallable(s.feeCategory))) {
        return block('fee_category_excluded');
    }

    // 11. Consent, per purpose group
    // A dialable purpose without a consent group is a catalogue error: fail closed.
    if (!spec.consentGroup) return block('no_consent');
    const consentStatus = preferences?.consent?.[spec.consentGroup]?.status ?? 'unknown';
    // An explicit refusal binds even in an emergency: the bypass exists for families whose
    // consent was never recorded (plan §2 D4, §15.5), not to override a parent's "no".
    if (consentStatus === 'denied') return block('consent_denied');
    const consentBypassed = spec.emergency && school.emergencyBypassConsent === true;
    if (consentStatus !== 'granted' && !consentBypassed) return block('no_consent');

    // 12. Language
    const language = resolveLanguage(guardian, preferences, school);
    if (!language) return block('language_unknown');

    // 13. Frequency (emergencies are exempt from the cap only)
    if (!spec.emergency && input.recentCallsToPhone >= FREQUENCY_CAP) return block('frequency_cap');

    // 14. Hours — at dispatch only; materialisation happens whenever the campaign is approved.
    if (stage === 'dispatch') {
        const window = samparkWindowVerdict(school, spec, now);
        if (!window.allowed) {
            return {
                kind: 'defer',
                until: window.nextAllowedAt ?? new Date(now.getTime() + NO_OPENING_RETRY_MS),
                reason: window.reason,
            };
        }
    }

    return { kind: 'allow', language };
}
