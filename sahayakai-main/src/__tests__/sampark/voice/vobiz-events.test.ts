/**
 * @jest-environment node
 *
 * Vobiz hangup callback → reducer event. Vobiz documents the callback as
 * form-encoded but shows a JSON example carrying `Status` and `Duration` (no
 * `HangupCause`), with numbers as numbers; our attendance path has seen
 * `HangupCause` and `BillDuration` as form strings. Both shapes must land on
 * the same outcome, and an unknown value must never count as "heard".
 */

import { hangupCauseFromVobiz, hangupEventFromVobiz } from '@/lib/sampark/voice/vobiz-events';

const AT = '2026-10-07T05:31:00.000Z';

describe('HangupCause (form-bodied callback)', () => {
    it.each([
        ['NORMAL_CLEARING', 'completed'],
        ['USER_BUSY', 'busy'],
        ['NO_ANSWER', 'no_answer'],
        ['NO_USER_RESPONSE', 'no_answer'],
        ['TIMEOUT', 'no_answer'],
        ['CALL_REJECTED', 'failed'],
        ['UNALLOCATED_NUMBER', 'failed'],
        ['INVALID_NUMBER_FORMAT', 'failed'],
        ['ORIGINATOR_CANCEL', 'failed'],
        ['normal_clearing', 'completed'],
        // Added with the cause table (H7); gate-h7-hangup-cause-table checks every row.
        ['ALLOTTED_TIMEOUT', 'no_answer'],
        ['SUBSCRIBER_ABSENT', 'no_answer'],
        ['NORMAL_CIRCUIT_CONGESTION', 'failed'],
        ['NUMBER_CHANGED', 'failed'],
        ['INCOMPATIBLE_DESTINATION', 'failed'],
    ])('%s → %s', (cause, expected) => {
        expect(hangupCauseFromVobiz({ HangupCause: cause, Duration: '12' })).toBe(expected);
    });

    it('wins over Status when both are present', () => {
        expect(hangupCauseFromVobiz({ HangupCause: 'USER_BUSY', Status: 'completed', Duration: '30' })).toBe('busy');
    });

    it('an unknown cause is completed only when the call lasted, else failed', () => {
        expect(hangupCauseFromVobiz({ HangupCause: 'SOMETHING_NEW', Duration: '9' })).toBe('completed');
        expect(hangupCauseFromVobiz({ HangupCause: 'SOMETHING_NEW', Duration: '0' })).toBe('failed');
        expect(hangupCauseFromVobiz({ HangupCause: 'SOMETHING_NEW' })).toBe('failed');
    });

    it('reads the full form: BillDuration as reported, and the raw cause', () => {
        expect(hangupEventFromVobiz({ CallUUID: 'u', HangupCause: 'NORMAL_CLEARING', Duration: '47', BillDuration: '60' }, AT)).toEqual({
            type: 'hangup',
            at: AT,
            cause: 'completed',
            durationSeconds: 47,
            billedSeconds: 60,
            hangupCause: 'NORMAL_CLEARING',
        });
    });

    it('keeps the raw cause upper case, even one the table does not know, and bounded in length', () => {
        expect(hangupEventFromVobiz({ HangupCause: ' unallocated_number ' }, AT)).toMatchObject({ cause: 'failed', hangupCause: 'UNALLOCATED_NUMBER' });
        expect(hangupEventFromVobiz({ hangup_cause: 'Something_New', Duration: '3' }, AT)).toMatchObject({ cause: 'completed', hangupCause: 'SOMETHING_NEW' });
        expect(hangupEventFromVobiz({ HangupCause: 'X'.repeat(500) }, AT).hangupCause).toHaveLength(64);
    });

    it('carries no hangupCause when the carrier sent none', () => {
        expect(hangupEventFromVobiz({ Status: 'completed', Duration: 12 }, AT)).not.toHaveProperty('hangupCause');
        expect(hangupEventFromVobiz({ HangupCause: '   ', Status: 'busy' }, AT)).not.toHaveProperty('hangupCause');
    });
});

describe('Status / CallStatus (JSON-bodied callback, numbers as numbers)', () => {
    it.each([
        [{ Status: 'completed', Duration: 25 }, 'completed'],
        [{ Status: 'completed', Duration: 0 }, 'no_answer'],
        [{ Status: 'completed' }, 'no_answer'],
        [{ Status: 'busy', Duration: 0 }, 'busy'],
        [{ Status: 'no-answer', Duration: 0 }, 'no_answer'],
        [{ Status: 'no_answer' }, 'no_answer'],
        [{ Status: 'timeout' }, 'no_answer'],
        [{ Status: 'failed' }, 'failed'],
        [{ Status: 'canceled' }, 'failed'],
        [{ Status: 'cancelled' }, 'failed'],
        [{ Status: 'rejected' }, 'failed'],
        [{ CallStatus: 'Completed', Duration: '4' }, 'completed'],
        [{ Status: 'in-progress-ish', Duration: 3 }, 'completed'],
        [{ Status: 'in-progress-ish', Duration: 0 }, 'failed'],
        [{}, 'failed'],
    ])('%j → %s', (form, expected) => {
        expect(hangupCauseFromVobiz(form)).toBe(expected);
    });

    it('a JSON hangup with only Status and Duration bills whole minutes, at least one', () => {
        expect(hangupEventFromVobiz({ Status: 'completed', Duration: 61 }, AT)).toEqual({
            type: 'hangup',
            at: AT,
            cause: 'completed',
            durationSeconds: 61,
            billedSeconds: 120,
        });
        expect(hangupEventFromVobiz({ Status: 'completed', Duration: 5 }, AT)).toMatchObject({ billedSeconds: 60 });
    });

    it('an unanswered call is free unless the carrier says otherwise', () => {
        expect(hangupEventFromVobiz({ Status: 'no-answer', Duration: 0 }, AT)).toMatchObject({ cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 });
        expect(hangupEventFromVobiz({ Status: 'busy', BillDuration: 0 }, AT)).toMatchObject({ billedSeconds: 0 });
    });

    it('ignores garbage numbers rather than recording NaN', () => {
        const event = hangupEventFromVobiz({ HangupCause: 'NORMAL_CLEARING', Duration: 'abc', BillDuration: '-5' }, AT);
        expect(event).toMatchObject({ cause: 'completed', durationSeconds: 0, billedSeconds: 60 });
    });
});
