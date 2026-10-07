/**
 * @jest-environment node
 */
import { applyCallEvent, classifyHeard, isTerminal } from '@/lib/sampark/dispatch/state';
import type { CallEvent, SamparkCall } from '@/types/sampark';
import { TERMINAL_CALL_STATES } from '@/types/sampark';

function call(overrides: Partial<SamparkCall> = {}): SamparkCall {
    return {
        id: 'call-1',
        orgId: 'hillview-demo',
        intentId: 'intent-1',
        campaignId: 'camp',
        purpose: 'ptm_invite',
        guardianId: 'g1',
        phoneHash: 'hash:g1',
        phoneLast4: '0000',
        language: 'Nepali',
        variant: 'default',
        attempt: 1,
        state: 'dialing',
        leaseUntil: '2026-10-07T05:32:00.000Z',
        carrier: 'simulated',
        providerCallId: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: null,
        billedSeconds: null,
        costPaise: null,
        audioSeconds: 40,
        createdAt: '2026-10-07T05:30:00.000Z',
        updatedAt: '2026-10-07T05:30:00.000Z',
        endedAt: null,
        failureReason: null,
        ...overrides,
    };
}

const at = (s: number) => new Date(Date.parse('2026-10-07T05:30:00.000Z') + s * 1000).toISOString();
const run = (c: SamparkCall, events: CallEvent[]) => events.reduce(applyCallEvent, c);

describe('classifyHeard', () => {
    it('null duration → none', () => expect(classifyHeard(null, 40)).toBe('none'));
    it('< 5 s → early_hangup', () => {
        expect(classifyHeard(0, 40)).toBe('early_hangup');
        expect(classifyHeard(4.9, 40)).toBe('early_hangup');
    });
    it('< 90% of the audio → partial; ≥ 90% → full', () => {
        expect(classifyHeard(5, 40)).toBe('partial');
        expect(classifyHeard(35.9, 40)).toBe('partial');
        expect(classifyHeard(36, 40)).toBe('full');
        expect(classifyHeard(60, 40)).toBe('full');
    });
    it('unknown audio length → ≥ 20 s counts as full', () => {
        expect(classifyHeard(19, null)).toBe('partial');
        expect(classifyHeard(20, null)).toBe('full');
    });
});

describe('isTerminal', () => {
    it('matches TERMINAL_CALL_STATES exactly', () => {
        for (const s of TERMINAL_CALL_STATES) expect(isTerminal(s)).toBe(true);
        for (const s of ['dialing', 'ringing', 'in_progress'] as const) expect(isTerminal(s)).toBe(false);
    });
});

describe('applyCallEvent', () => {
    it('is pure: never mutates its input', () => {
        const c = call();
        const frozen = JSON.stringify(c);
        applyCallEvent(c, { type: 'digit', at: at(30), digit: '1' });
        applyCallEvent(c, { type: 'hangup', at: at(50), cause: 'completed', durationSeconds: 45, billedSeconds: 60 });
        expect(JSON.stringify(c)).toBe(frozen);
    });

    it('walks dialing → ringing → in_progress → completed and classifies the listen', () => {
        const done = run(call(), [
            { type: 'placed', at: at(0.5), providerCallId: 'p1' },
            { type: 'ringing', at: at(1) },
            { type: 'answered', at: at(6) },
            { type: 'hangup', at: at(50), cause: 'completed', durationSeconds: 44, billedSeconds: 60 },
        ]);
        expect(done).toMatchObject({ state: 'completed', providerCallId: 'p1', durationSeconds: 44, billedSeconds: 60, endedAt: at(50) });
        expect(done.outcome.heard).toBe('full');
    });

    it('placed keeps dialing and never overwrites an existing provider id', () => {
        const c = applyCallEvent(call(), { type: 'placed', at: at(0.5), providerCallId: 'p1' });
        expect(c.state).toBe('dialing');
        expect(applyCallEvent(c, { type: 'placed', at: at(1), providerCallId: 'p2' }).providerCallId).toBe('p1');
    });

    it('ignores backwards moves (late ringing after answer)', () => {
        const c = run(call(), [{ type: 'answered', at: at(6) }, { type: 'ringing', at: at(7) }]);
        expect(c.state).toBe('in_progress');
    });

    it('never leaves a terminal state — later events are ignored', () => {
        const ended = run(call(), [{ type: 'answered', at: at(6) }, { type: 'hangup', at: at(20), cause: 'completed', durationSeconds: 14, billedSeconds: 60 }]);
        const after = run(ended, [
            { type: 'ringing', at: at(21) },
            { type: 'answered', at: at(22) },
            { type: 'digit', at: at(23), digit: '9' },
            { type: 'hangup', at: at(30), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 },
            { type: 'place_failed', at: at(31), reason: 'x' },
        ]);
        expect(after).toEqual(ended);
        for (const s of TERMINAL_CALL_STATES) {
            expect(applyCallEvent(call({ state: s }), { type: 'answered', at: at(1) }).state).toBe(s);
        }
    });

    it('place_failed → failed with reason, nothing heard', () => {
        const c = applyCallEvent(call(), { type: 'place_failed', at: at(0.2), reason: 'carrier_down' });
        expect(c).toMatchObject({ state: 'failed', failureReason: 'carrier_down', billedSeconds: 0, endedAt: at(0.2) });
        expect(c.outcome.heard).toBe('none');
    });

    it('no_answer / busy → terminal with heard none and null duration', () => {
        const na = run(call(), [{ type: 'ringing', at: at(1) }, { type: 'hangup', at: at(40), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 }]);
        expect(na).toMatchObject({ state: 'no_answer', durationSeconds: null, billedSeconds: 0 });
        expect(na.outcome.heard).toBe('none');
        const busy = applyCallEvent(call(), { type: 'hangup', at: at(3), cause: 'busy', durationSeconds: 0, billedSeconds: 0 });
        expect(busy.state).toBe('busy');
    });

    it('a hangup stores the carrier’s raw cause when it sent one (H7), and only then', () => {
        const ended = run(call(), [{ type: 'hangup', at: at(30), cause: 'failed', durationSeconds: 0, billedSeconds: 0, hangupCause: 'UNALLOCATED_NUMBER' }]);
        expect(ended).toMatchObject({ state: 'failed', hangupCause: 'UNALLOCATED_NUMBER' });
        expect(run(call(), [{ type: 'hangup', at: at(30), cause: 'no_answer', durationSeconds: 0, billedSeconds: 0 }])).not.toHaveProperty('hangupCause');
        // A late, duplicated hangup never rewrites the cause of an ended call.
        expect(applyCallEvent(ended, { type: 'hangup', at: at(40), cause: 'completed', durationSeconds: 9, billedSeconds: 60, hangupCause: 'NORMAL_CLEARING' }).hangupCause).toBe('UNALLOCATED_NUMBER');
    });

    it('hangup failed → failed with a default reason', () => {
        expect(applyCallEvent(call(), { type: 'hangup', at: at(3), cause: 'failed', durationSeconds: 0, billedSeconds: 0 }).failureReason).toBe('carrier_failed');
    });

    it('digit 1 → confirmed; 2 → declined; the last action key wins', () => {
        const base = applyCallEvent(call(), { type: 'answered', at: at(6) });
        const one = applyCallEvent(base, { type: 'digit', at: at(40), digit: '1' });
        expect(one.outcome).toMatchObject({ digits: '1', confirmed: true, declined: false });
        const two = applyCallEvent(base, { type: 'digit', at: at(40), digit: '2' });
        expect(two.outcome).toMatchObject({ digits: '2', confirmed: false, declined: true });
        const changed = applyCallEvent(two, { type: 'digit', at: at(42), digit: '1' });
        expect(changed.outcome).toMatchObject({ digits: '21', confirmed: true, declined: false });
    });

    it('9 → opt-out requested; 99 → confirmed', () => {
        const base = applyCallEvent(call(), { type: 'answered', at: at(6) });
        const nine = applyCallEvent(base, { type: 'digit', at: at(40), digit: '9' });
        expect(nine.outcome.optOut).toBe('requested');
        const ninenine = applyCallEvent(nine, { type: 'digit', at: at(43), digit: '9' });
        expect(ninenine.outcome).toMatchObject({ digits: '99', optOut: 'confirmed' });
    });

    it('keys are read against the purpose menu: key 2 is not "declined" on an emergency closure', () => {
        const d4 = applyCallEvent(call({ purpose: 'emergency_closure', state: 'in_progress' }), { type: 'digit', at: at(40), digit: '2' });
        expect(d4.outcome).toMatchObject({ digits: '2', declined: false, confirmed: false });
        const d4one = applyCallEvent(call({ purpose: 'emergency_closure', state: 'in_progress' }), { type: 'digit', at: at(40), digit: '1' });
        expect(d4one.outcome.confirmed).toBe(true);
    });

    it('a digit proves the call was answered even if the answered event was lost', () => {
        expect(applyCallEvent(call({ state: 'ringing' }), { type: 'digit', at: at(30), digit: '1' }).state).toBe('in_progress');
    });

    it('ignores malformed digits', () => {
        const c = applyCallEvent(call({ state: 'in_progress' }), { type: 'digit', at: at(30), digit: '12' });
        expect(c.outcome.digits).toBe('');
    });

    it('a short answered call is early_hangup; half the audio is partial', () => {
        const early = run(call(), [{ type: 'answered', at: at(6) }, { type: 'hangup', at: at(9), cause: 'completed', durationSeconds: 3, billedSeconds: 60 }]);
        expect(early.outcome.heard).toBe('early_hangup');
        const part = run(call(), [{ type: 'answered', at: at(6) }, { type: 'hangup', at: at(26), cause: 'completed', durationSeconds: 20, billedSeconds: 60 }]);
        expect(part.outcome.heard).toBe('partial');
    });
});
