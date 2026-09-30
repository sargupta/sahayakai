/**
 * The purpose catalogue — the single place each call purpose is classified.
 *
 * Plan §2. Every decision about a purpose (mode, who approves, whether it names
 * a child, which consent group it needs, whether it is a TRAI "service" call)
 * is made HERE, once, and read everywhere else. Class gates iterate this table:
 *   - gate 8: every purpose is classified, and no promotional purpose can be scheduled;
 *   - gate 10: human-only purposes never produce a dialable intent.
 *
 * `status` says whether the purpose has reviewed templates and may be used in a
 * campaign today. Slice 1 ships ptm_invite, event_invite and emergency_closure.
 */

import type {
    Approver,
    CallMode,
    ChannelRule,
    CommercialClass,
    ConsentGroup,
    PurposeAudience,
    PurposeFamily,
    PurposeId,
} from '@/types/sampark';

/** What each key means on a notice call. Keys not listed are "invalid, repeat menu". Key 9 is always opt-out. */
export interface MenuSpec {
    /** Meaning of key 1, or null if key 1 is not offered. */
    key1: 'confirm' | 'heard' | 'call_me' | 'already_paid' | 'child_with_me' | null;
    /** Meaning of key 2, or null if not offered. */
    key2: 'decline' | 'talk_to_accounts' | 'did_not_know' | null;
    /** Opt-out (9, confirmed with a second 9). Emergency notices keep reaching the family either way. */
    optOut: boolean;
}

export interface PurposeSpec {
    id: PurposeId;
    /** The plan's catalogue code, e.g. "B1". */
    code: string;
    family: PurposeFamily;
    mode: CallMode;
    audience: PurposeAudience;
    channel: ChannelRule;
    approver: Approver;
    consentGroup: ConsentGroup | null;
    commercial: CommercialClass;
    /** Purposes that bypass the frequency cap and may start at 06:00 with principal approval (only D4). */
    emergency: boolean;
    /** RTE / fee-waived children never receive this purpose (class gate 12). */
    excludesFeeWaived: boolean;
    /** Concern-type purposes are never placed on Friday or Saturday (plan §2A). */
    noFridaySaturday: boolean;
    menu: MenuSpec | null;
    /** Attempts per intent (plan §4⑦). Emergency closures retry faster, not more. */
    maxAttempts: number;
    /** Minutes to wait after no-answer / busy before the next attempt. */
    retryAfterMinutes: number;
    status: 'available' | 'planned';
}

const NOTICE_MENU_CONFIRM: MenuSpec = { key1: 'confirm', key2: 'decline', optOut: true };
const NOTICE_MENU_HEARD: MenuSpec = { key1: 'heard', key2: null, optOut: true };
const NOTICE_MENU_CALL_ME: MenuSpec = { key1: 'call_me', key2: null, optOut: true };

function notice(
    id: PurposeId,
    code: string,
    family: PurposeFamily,
    audience: PurposeAudience,
    approver: Approver,
    consentGroup: ConsentGroup,
    menu: MenuSpec,
    extra: Partial<PurposeSpec> = {},
): PurposeSpec {
    return {
        id,
        code,
        family,
        mode: 'notice',
        audience,
        channel: 'message_first',
        approver,
        consentGroup,
        commercial: 'service',
        emergency: false,
        excludesFeeWaived: false,
        noFridaySaturday: false,
        menu,
        maxAttempts: 3,
        retryAfterMinutes: 120,
        status: 'planned',
        ...extra,
    };
}

function humanOnly(id: PurposeId, code: string): PurposeSpec {
    return {
        id,
        code,
        family: 'human',
        mode: 'human_only',
        audience: 'child',
        channel: 'call_first',
        approver: 'none',
        consentGroup: null,
        commercial: 'service',
        emergency: false,
        excludesFeeWaived: false,
        noFridaySaturday: false,
        menu: null,
        maxAttempts: 0,
        retryAfterMinutes: 0,
        status: 'planned',
    };
}

const SPECS: PurposeSpec[] = [
    // A — progress & holistic card. Concerns become REQUESTS TO TALK (plan §2A).
    notice('attendance_talk', 'A1', 'progress', 'child', 'class_teacher', 'progress', NOTICE_MENU_CALL_ME, { channel: 'call_first', noFridaySaturday: true }),
    notice('absence_today', 'A2', 'progress', 'child', 'class_teacher', 'progress',
        { key1: 'child_with_me', key2: 'did_not_know', optOut: true },
        { channel: 'call_first', maxAttempts: 2, retryAfterMinutes: 15 }),
    notice('academic_talk', 'A3', 'progress', 'child', 'class_teacher', 'progress', NOTICE_MENU_CALL_ME, { channel: 'call_first', noFridaySaturday: true }),
    notice('conduct_talk', 'A4', 'progress', 'child', 'coordinator', 'progress', NOTICE_MENU_CALL_ME, { channel: 'call_first', noFridaySaturday: true }),
    notice('recognition', 'A5', 'progress', 'child', 'class_teacher', 'progress', NOTICE_MENU_HEARD, { channel: 'call_first' }),
    notice('term_summary', 'A6', 'progress', 'child', 'coordinator', 'progress', NOTICE_MENU_CALL_ME),
    { ...notice('hpc_parent_input', 'A7', 'progress', 'child', 'coordinator', 'hpc_input', NOTICE_MENU_HEARD), mode: 'conversation', menu: null },

    // B — meetings
    notice('ptm_invite', 'B1', 'meeting', 'class', 'coordinator', 'notices', NOTICE_MENU_CONFIRM, { status: 'available' }),
    notice('principal_meeting_confirm', 'B2', 'meeting', 'child', 'principal', 'progress', { key1: 'confirm', key2: null, optOut: true }),
    notice('meeting_reminder', 'B4', 'meeting', 'child', 'auto', 'notices', NOTICE_MENU_HEARD),

    // C — fees (accounts). Listener check first, amount only after (plan §2C).
    notice('fee_due', 'C1', 'fees', 'child', 'accounts', 'notices',
        { key1: 'already_paid', key2: 'talk_to_accounts', optOut: true },
        { excludesFeeWaived: true, maxAttempts: 2 }),
    notice('fee_overdue', 'C2', 'fees', 'child', 'accounts', 'notices',
        { key1: 'already_paid', key2: 'talk_to_accounts', optOut: true },
        { excludesFeeWaived: true, maxAttempts: 2 }),
    notice('documents_pending', 'C4', 'fees', 'child', 'office', 'notices', NOTICE_MENU_HEARD),
    notice('re_enrolment', 'C5', 'fees', 'child', 'office', 'notices', NOTICE_MENU_CONFIRM),
    notice('deadline_notice', 'C6', 'fees', 'child', 'office', 'notices', NOTICE_MENU_HEARD),

    // D — events & notices
    notice('event_invite', 'D1', 'notice', 'class', 'coordinator', 'notices', NOTICE_MENU_CONFIRM, { status: 'available' }),
    notice('exam_notice', 'D2', 'notice', 'class', 'coordinator', 'notices', NOTICE_MENU_HEARD),
    notice('holiday_notice', 'D3', 'notice', 'class', 'coordinator', 'notices', NOTICE_MENU_HEARD),
    notice('emergency_closure', 'D4', 'notice', 'class', 'principal', 'notices', NOTICE_MENU_HEARD, {
        channel: 'call_first',
        emergency: true,
        maxAttempts: 3,
        retryAfterMinutes: 15,
        status: 'available',
    }),
    notice('transport_notice', 'D5', 'notice', 'class', 'transport', 'notices', NOTICE_MENU_HEARD, { channel: 'call_first' }),
    notice('early_dismissal', 'D6', 'notice', 'class', 'principal', 'notices', NOTICE_MENU_HEARD, { channel: 'call_first' }),
    notice('illness_notice', 'D7', 'notice', 'class', 'principal', 'notices', NOTICE_MENU_HEARD),
    notice('health_camp', 'D8', 'notice', 'class', 'coordinator', 'notices', NOTICE_MENU_HEARD, { excludesFeeWaived: false }),
    notice('boarder_notice', 'D9', 'notice', 'class', 'office', 'notices', NOTICE_MENU_HEARD),

    // E — human-only. The engine pages a named person and never dials (class gate 10).
    humanOnly('counsellor_meeting', 'B3'),
    humanOnly('fee_hardship', 'C3'),
    humanOnly('child_unwell', 'E1'),
    humanOnly('wellbeing', 'E2'),
    humanOnly('safeguarding', 'E3'),
    humanOnly('discipline_decision', 'E4'),
    humanOnly('child_missing', 'E5'),
    humanOnly('security_incident', 'E6'),
];

export const PURPOSE_CATALOGUE: Readonly<Record<PurposeId, PurposeSpec>> = Object.freeze(
    Object.fromEntries(SPECS.map((s) => [s.id, Object.freeze(s)])) as Record<PurposeId, PurposeSpec>,
);

export function purposeSpec(id: PurposeId): PurposeSpec {
    const spec = PURPOSE_CATALOGUE[id];
    if (!spec) throw new Error(`Unknown Sampark purpose: ${id}`);
    return spec;
}

/** Purposes with reviewed templates that a campaign may use today. */
export function availablePurposes(): PurposeSpec[] {
    return SPECS.filter((s) => s.status === 'available');
}

/** True only for purposes a machine may ever dial. */
export function isDialable(id: PurposeId): boolean {
    const spec = purposeSpec(id);
    return spec.mode !== 'human_only' && spec.commercial === 'service';
}
