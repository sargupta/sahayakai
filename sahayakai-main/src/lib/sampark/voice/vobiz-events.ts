/**
 * Vobiz's hangup callback → the reducer's `hangup` event.
 *
 * The callback is the one authoritative report of how a call ended, and its
 * shape is not stable across Vobiz's own docs: the documented content type is
 * form-encoded but the example body is JSON, the example carries `Status` and
 * `Duration` but no `HangupCause`, and numbers may arrive as strings or as
 * numbers. So this reads every spelling we know and decides in a fixed order:
 *
 *   1. `HangupCause` when present (the telephony cause, as the teacher-path
 *      attendance webhook already maps it);
 *   2. otherwise `Status` / `CallStatus`;
 *   3. a value we do not recognise counts as `completed` ONLY when the call
 *      lasted more than zero seconds, else `failed` — a new provider string can
 *      never quietly inflate the "parent heard it" numbers.
 *
 * Billing: `BillDuration` when the carrier sends it; otherwise an answered call
 * is billed in whole 60-second units (at least one), and an unanswered call is
 * free (Vobiz bills answered calls only, plan §7).
 *
 * Pure: no clock, no I/O. `at` is supplied by the caller.
 */

import type { CallEvent } from '@/types/sampark';

export type HangupEvent = Extract<CallEvent, { type: 'hangup' }>;
export type HangupCause = HangupEvent['cause'];

/** Telephony hangup causes (same vocabulary as src/app/api/attendance/vobiz/status/route.ts). */
const HANGUP_CAUSE_MAP: Readonly<Record<string, HangupCause>> = {
    NORMAL_CLEARING: 'completed',
    ORIGINATOR_CANCEL: 'failed',
    USER_BUSY: 'busy',
    NO_ANSWER: 'no_answer',
    NO_USER_RESPONSE: 'no_answer',
    TIMEOUT: 'no_answer',
    CALL_REJECTED: 'failed',
    UNALLOCATED_NUMBER: 'failed',
    INVALID_NUMBER_FORMAT: 'failed',
};

/** Call statuses (`Status` / `CallStatus`), normalised to lower case with '-' and ' ' as '_'. */
const STATUS_MAP: Readonly<Record<string, HangupCause | 'completed_if_heard'>> = {
    completed: 'completed_if_heard',
    busy: 'busy',
    no_answer: 'no_answer',
    noanswer: 'no_answer',
    timeout: 'no_answer',
    failed: 'failed',
    canceled: 'failed',
    cancelled: 'failed',
    rejected: 'failed',
};

/** First present, non-empty value among `names`, as a trimmed string. Numbers are accepted. */
function pick(form: Readonly<Record<string, unknown>>, names: readonly string[]): string {
    for (const name of names) {
        const value = form[name];
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
    }
    return '';
}

/** Whole non-negative seconds, or null when absent or not a number. */
function seconds(raw: string): number | null {
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** The cause the reducer records for this callback. Exported for tests. */
export function hangupCauseFromVobiz(form: Readonly<Record<string, unknown>>): HangupCause {
    const duration = seconds(pick(form, ['Duration', 'duration', 'CallDuration'])) ?? 0;
    const cause = pick(form, ['HangupCause', 'hangup_cause', 'HangupCauseName']).toUpperCase();
    if (cause) return HANGUP_CAUSE_MAP[cause] ?? (duration > 0 ? 'completed' : 'failed');

    const status = pick(form, ['Status', 'CallStatus', 'status', 'call_status']).toLowerCase().replace(/[\s-]+/g, '_');
    const mapped = STATUS_MAP[status];
    if (mapped === 'completed_if_heard') return duration > 0 ? 'completed' : 'no_answer';
    if (mapped) return mapped;
    return duration > 0 ? 'completed' : 'failed';
}

/** The reducer's hangup event for this callback. Typed as the hangup member of CallEvent. */
export function hangupEventFromVobiz(form: Readonly<Record<string, unknown>>, at: string): HangupEvent {
    const cause = hangupCauseFromVobiz(form);
    const durationSeconds = seconds(pick(form, ['Duration', 'duration', 'CallDuration'])) ?? 0;
    const answered = cause === 'completed';
    const reportedBill = seconds(pick(form, ['BillDuration', 'bill_duration', 'BillableDuration']));
    const billedSeconds = reportedBill ?? (answered ? Math.max(1, Math.ceil(durationSeconds / 60)) * 60 : 0);
    return { type: 'hangup', at, cause, durationSeconds, billedSeconds };
}
