/**
 * @jest-environment node
 *
 * Every branch of evaluateGate, in contract order, plus the precedence between them.
 */
import { purposeSpec, type PurposeSpec } from '@/lib/sampark/catalogue';
import { evaluateGate, FREQUENCY_CAP, type GateInput } from '@/lib/sampark/policy/gate';
import { istInstant } from '@/lib/sampark/policy/ist';
import type { Suppression } from '@/types/sampark';

import { guardian, prefs, school, student, WED_11_IST } from './_fixtures';

const PTM = purposeSpec('ptm_invite');
const D4 = purposeSpec('emergency_closure');
/** A child-audience notice made 'available' so the child-specific rules can be reached. */
const FEE_DUE: PurposeSpec = { ...purposeSpec('fee_due'), status: 'available' };

function input(overrides: Partial<GateInput> = {}): GateInput {
    return {
        school: school(),
        spec: PTM,
        guardian: guardian('g1', { studentIds: ['s1'] }),
        students: [student('s1', { guardianIds: ['g1'] })],
        preferences: prefs('g1'),
        suppression: null,
        recentCallsToPhone: 0,
        carrierKind: 'simulated',
        now: WED_11_IST,
        stage: 'dispatch',
        ...overrides,
    };
}

function suppression(overrides: Partial<Suppression> = {}): Suppression {
    return {
        orgId: 'hillview-demo',
        phoneHash: 'hash:g1',
        phoneLast4: '0000',
        scope: 'routine',
        source: 'keypad',
        officeVerification: 'pending',
        createdAt: '2026-10-01T00:00:00.000Z',
        callId: null,
        ...overrides,
    };
}

const blockReason = (i: GateInput) => {
    const v = evaluateGate(i);
    return v.kind === 'block' ? v.reason : v.kind;
};

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

describe('evaluateGate — allow', () => {
    it('allows a consented guardian with a language, inside the window, on the simulated carrier', () => {
        expect(evaluateGate(input())).toEqual({ kind: 'allow', language: 'Nepali' });
    });
});

describe('evaluateGate — each block reason', () => {
    it('1. human-only purpose → human_only_purpose', () => {
        expect(blockReason(input({ spec: purposeSpec('safeguarding') }))).toBe('human_only_purpose');
    });

    it('1. a promotional spec → human_only_purpose (not dialable)', () => {
        expect(blockReason(input({ spec: { ...PTM, commercial: 'promotional' } }))).toBe('human_only_purpose');
    });

    it('2. planned purpose → purpose_not_available', () => {
        expect(blockReason(input({ spec: purposeSpec('exam_notice') }))).toBe('purpose_not_available');
    });

    it('3. inactive guardian or CRM do-not-contact → crm_do_not_contact', () => {
        expect(blockReason(input({ guardian: guardian('g1', { active: false }) }))).toBe('crm_do_not_contact');
        expect(blockReason(input({ guardian: guardian('g1', { crmDoNotContact: true }) }))).toBe('crm_do_not_contact');
    });

    it('4. suppression scope all → suppressed, for every purpose including emergencies', () => {
        expect(blockReason(input({ suppression: suppression({ scope: 'all' }) }))).toBe('suppressed');
        expect(blockReason(input({ spec: D4, suppression: suppression({ scope: 'all' }) }))).toBe('suppressed');
    });

    it('4. suppression scope routine → suppressed for routine purposes, NOT for emergency closures', () => {
        expect(blockReason(input({ suppression: suppression() }))).toBe('suppressed');
        expect(evaluateGate(input({ spec: D4, suppression: suppression(), now: istInstant('2026-10-07', 7) })).kind).toBe('allow');
    });

    it('4. a suppression the office reversed no longer suppresses', () => {
        expect(evaluateGate(input({ suppression: suppression({ officeVerification: 'reversed' }) })).kind).toBe('allow');
    });

    it('5. invalid phone → invalid_number', () => {
        expect(blockReason(input({ guardian: guardian('g1', { phoneClass: 'invalid' }) }))).toBe('invalid_number');
    });

    it('6. synthetic phone on a non-simulated carrier → synthetic_number_not_allowed', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(blockReason(input({ carrierKind: 'vobiz', school: school({ mode: 'live' }) }))).toBe('synthetic_number_not_allowed');
    });

    it('7. demo school on a non-simulated carrier → synthetic_number_not_allowed (even with a real mobile)', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(
            blockReason(input({ carrierKind: 'vobiz', school: school({ mode: 'live', isDemo: true }), guardian: guardian('g1', { phoneClass: 'mobile' }) })),
        ).toBe('synthetic_number_not_allowed');
    });

    it('8. vobiz while SAMPARK_LIVE_DIAL_ENABLED is not "true" → mode_forbids_dialing', () => {
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        const live = { carrierKind: 'vobiz' as const, school: school({ mode: 'live' }), guardian: guardian('g1', { phoneClass: 'mobile' }) };
        expect(blockReason(input(live))).toBe('mode_forbids_dialing');
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'TRUE';
        expect(blockReason(input(live))).toBe('mode_forbids_dialing');
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(evaluateGate(input(live)).kind).toBe('allow');
    });

    it('8. a school in practice mode never reaches a non-simulated carrier, flag or not', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(blockReason(input({ carrierKind: 'vobiz', guardian: guardian('g1', { phoneClass: 'mobile' }) }))).toBe('mode_forbids_dialing');
    });

    it('9. child-audience purpose with a sensitive-flag child → sensitive_flag', () => {
        const flagged = [student('s1', { sensitiveFlags: ['custody_restriction'] })];
        expect(blockReason(input({ spec: FEE_DUE, students: flagged }))).toBe('sensitive_flag');
    });

    it('9. class-audience purposes are NOT blocked by sensitive flags', () => {
        const flagged = [student('s1', { sensitiveFlags: ['domestic_issue'] })];
        expect(evaluateGate(input({ students: flagged })).kind).toBe('allow');
    });

    it('10. fee-excluding purpose with an RTE, waived, scholarship or staff-ward child → fee_category_excluded', () => {
        expect(blockReason(input({ spec: FEE_DUE, students: [student('s1', { feeCategory: 'rte' })] }))).toBe('fee_category_excluded');
        expect(blockReason(input({ spec: FEE_DUE, students: [student('s1', { feeCategory: 'waived' })] }))).toBe('fee_category_excluded');
        expect(blockReason(input({ spec: FEE_DUE, students: [student('s1', { feeCategory: 'scholarship' })] }))).toBe('fee_category_excluded');
        expect(blockReason(input({ spec: FEE_DUE, students: [student('s1', { feeCategory: 'staff_ward' })] }))).toBe('fee_category_excluded');
        expect(evaluateGate(input({ spec: FEE_DUE, students: [student('s1', { feeCategory: 'regular' })] })).kind).toBe('allow');
        // PTM does not exclude RTE families.
        expect(evaluateGate(input({ students: [student('s1', { feeCategory: 'rte' })] })).kind).toBe('allow');
    });

    it('11. consent denied → consent_denied; unknown or missing → no_consent', () => {
        expect(blockReason(input({ preferences: prefs('g1', { notices: 'denied' }) }))).toBe('consent_denied');
        expect(blockReason(input({ preferences: prefs('g1', { notices: 'unknown' }) }))).toBe('no_consent');
        expect(blockReason(input({ preferences: null, guardian: guardian('g1') }))).toBe('no_consent');
        // Consent is per purpose group: 'progress' consent does not cover a notice.
        expect(blockReason(input({ preferences: prefs('g1', { progress: 'granted' }) }))).toBe('no_consent');
    });

    it('11. emergency closure bypasses UNRECORDED consent only when the school set emergencyBypassConsent', () => {
        const at = istInstant('2026-10-07', 7);
        expect(blockReason(input({ spec: D4, now: at, preferences: null }))).toBe('no_consent');
        const bypass = school({ emergencyBypassConsent: true });
        expect(evaluateGate(input({ spec: D4, now: at, preferences: null, school: bypass })).kind).toBe('allow');
        // An explicit "no" still binds in an emergency; the bypass only covers unrecorded consent.
        expect(blockReason(input({ spec: D4, now: at, preferences: prefs('g1', { notices: 'denied' }), school: bypass }))).toBe('consent_denied');
        // …and never for a routine purpose.
        expect(blockReason(input({ preferences: null, school: bypass }))).toBe('no_consent');
    });

    it('12. no language anywhere → language_unknown', () => {
        expect(blockReason(input({ guardian: guardian('g1', { crmLanguage: null }) }))).toBe('language_unknown');
    });

    it('13. ≥ 4 routine calls in 30 days → frequency_cap; emergencies are exempt', () => {
        expect(evaluateGate(input({ recentCallsToPhone: FREQUENCY_CAP - 1 })).kind).toBe('allow');
        expect(blockReason(input({ recentCallsToPhone: FREQUENCY_CAP }))).toBe('frequency_cap');
        expect(evaluateGate(input({ spec: D4, recentCallsToPhone: 40, now: istInstant('2026-10-07', 7) })).kind).toBe('allow');
    });
});

describe('evaluateGate — window (dispatch stage only)', () => {
    it('outside the window at dispatch → defer until the next opening', () => {
        const v = evaluateGate(input({ now: istInstant('2026-10-07', 21) }));
        expect(v.kind).toBe('defer');
        if (v.kind === 'defer') {
            expect(v.until.toISOString()).toBe(istInstant('2026-10-08', 10).toISOString());
            expect(v.reason).toMatch(/IST/);
        }
    });

    it('never defers at materialise — the window is judged when the call is placed', () => {
        expect(evaluateGate(input({ now: istInstant('2026-10-07', 23), stage: 'materialise' }))).toEqual({ kind: 'allow', language: 'Nepali' });
    });

    it('an emergency closure may dispatch at 06:30 IST on a Sunday', () => {
        expect(evaluateGate(input({ spec: D4, now: istInstant('2026-10-11', 6, 30) })).kind).toBe('allow');
    });

    it('a school whose window can never open defers by a day rather than failing open', () => {
        const v = evaluateGate(input({ school: school({ callingWindow: { startHour: 21, endHour: 23, offDays: [] } }) }));
        expect(v.kind).toBe('defer');
        if (v.kind === 'defer') expect(v.until.getTime()).toBe(WED_11_IST.getTime() + 24 * 3600 * 1000);
    });
});

describe('evaluateGate — precedence (first rule wins)', () => {
    it('human-only beats every other failure', () => {
        const everythingWrong = input({
            spec: purposeSpec('child_missing'),
            guardian: guardian('g1', { active: false, phoneClass: 'invalid', crmLanguage: null }),
            preferences: null,
            suppression: suppression({ scope: 'all' }),
            recentCallsToPhone: 99,
        });
        expect(blockReason(everythingWrong)).toBe('human_only_purpose');
    });

    it('do-not-contact beats suppression; suppression beats invalid number; invalid beats synthetic', () => {
        expect(blockReason(input({ guardian: guardian('g1', { crmDoNotContact: true }), suppression: suppression() }))).toBe('crm_do_not_contact');
        expect(blockReason(input({ guardian: guardian('g1', { phoneClass: 'invalid' }), suppression: suppression() }))).toBe('suppressed');
        expect(blockReason(input({ guardian: guardian('g1', { phoneClass: 'invalid' }), carrierKind: 'vobiz' }))).toBe('invalid_number');
    });

    it('carrier safety beats sensitive flags, fee rules and consent', () => {
        expect(
            blockReason(input({ spec: FEE_DUE, carrierKind: 'vobiz', students: [student('s1', { sensitiveFlags: ['safeguarding_open'], feeCategory: 'rte' })], preferences: null })),
        ).toBe('synthetic_number_not_allowed');
    });

    it('sensitive flag beats fee exclusion; fee exclusion beats consent; consent beats language; language beats frequency', () => {
        const both = [student('s1', { sensitiveFlags: ['severe_illness'], feeCategory: 'rte' })];
        expect(blockReason(input({ spec: FEE_DUE, students: both }))).toBe('sensitive_flag');
        expect(blockReason(input({ spec: FEE_DUE, students: [student('s1', { feeCategory: 'rte' })], preferences: null }))).toBe('fee_category_excluded');
        expect(blockReason(input({ preferences: null, guardian: guardian('g1', { crmLanguage: null }) }))).toBe('no_consent');
        expect(blockReason(input({ guardian: guardian('g1', { crmLanguage: null }), recentCallsToPhone: 9 }))).toBe('language_unknown');
    });

    it('any block beats the window: a blocked call is not merely deferred', () => {
        expect(blockReason(input({ now: istInstant('2026-10-07', 22), recentCallsToPhone: 9 }))).toBe('frequency_cap');
    });
});
