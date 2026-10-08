/**
 * Class gate for parent-call status races (audit F7/F9,
 * docs/calling/PARENT_CALL_AUDIT_2026-10-08.md).
 *
 * Several writers touch `callStatus` in no guaranteed order. These tests pin
 * the rule for EVERY pair of transitions: status only moves forward, the first
 * terminal status wins, and readers never see a stale "initiated" as live.
 */
import {
    isTerminalCallStatus,
    nextCallStatus,
    reconcileCallStatus,
    STALE_INITIATED_MS,
    TERMINAL_CALL_STATUSES,
    writeCallStatus,
} from '@/lib/attendance/reconcile-call-status';
import type { CallStatus } from '@/types/attendance';
import { createFakeDb, type Store } from '../helpers/fake-attendance-db';

const LIVE: CallStatus[] = ['initiated', 'ringing', 'in_progress'];
const ALL: CallStatus[] = [...LIVE, ...TERMINAL_CALL_STATUSES, 'manual'];

describe('nextCallStatus', () => {
    it('moves forward through the live states', () => {
        expect(nextCallStatus('initiated', 'ringing')).toBe('ringing');
        expect(nextCallStatus('ringing', 'in_progress')).toBe('in_progress');
        expect(nextCallStatus('in_progress', 'completed')).toBe('completed');
        expect(nextCallStatus(null, 'initiated')).toBe('initiated');
    });

    it.each(ALL.flatMap((cur) => ALL.map((inc) => [cur, inc] as const)))(
        'never regresses: %s then %s',
        (current, incoming) => {
            const next = nextCallStatus(current, incoming);
            if (isTerminalCallStatus(current) || current === 'manual') {
                expect(next).toBe(current); // the first terminal (or a non-call) is final
            } else if (next !== current) {
                expect(next).toBe(incoming);
            }
        },
    );

    it('a late "initiated" after a fast hangup does not overwrite the outcome', () => {
        expect(nextCallStatus('busy', 'initiated')).toBe('busy');
        expect(nextCallStatus('in_progress', 'initiated')).toBe('in_progress');
    });
});

describe('writeCallStatus', () => {
    it('applies forward moves, ignores regressions, and always merges fields', async () => {
        const store: Store = { parent_outreach: { o1: { callStatus: 'initiated' } } };
        const db = createFakeDb(store);

        await writeCallStatus(db, 'o1', 'in_progress', { answeredAt: 'a' });
        expect(store.parent_outreach.o1).toMatchObject({ callStatus: 'in_progress', answeredAt: 'a' });

        await writeCallStatus(db, 'o1', 'completed', { callDurationSeconds: 42 });
        const late = await writeCallStatus(db, 'o1', 'ringing', { ringingAt: 'r' });
        expect(late).toEqual({ status: 'completed', applied: false });
        expect(store.parent_outreach.o1).toMatchObject({ callStatus: 'completed', callDurationSeconds: 42, ringingAt: 'r' });

        const second = await writeCallStatus(db, 'o1', 'failed');
        expect(second).toEqual({ status: 'completed', applied: false });
        const duplicate = await writeCallStatus(db, 'o1', 'completed');
        expect(duplicate).toEqual({ status: 'completed', applied: true });
    });

    it('reports a missing record without writing', async () => {
        const store: Store = { parent_outreach: {} };
        expect(await writeCallStatus(createFakeDb(store), 'nope', 'failed')).toEqual({ status: null, applied: false });
        expect(store.parent_outreach.nope).toBeUndefined();
    });
});

describe('reconcileCallStatus (the reader every consumer uses)', () => {
    const now = Date.parse('2026-10-08T12:00:00Z');

    it('passes live and terminal statuses through', () => {
        expect(reconcileCallStatus({ callStatus: 'in_progress', updatedAt: '2026-10-08T11:59:00Z' }, now)).toBe('in_progress');
        expect(reconcileCallStatus({ callStatus: 'busy' }, now)).toBe('busy');
        expect(reconcileCallStatus({}, now)).toBeNull();
    });

    it('a stale "initiated" reads as failed, not "Calling…" forever', () => {
        const old = new Date(now - STALE_INITIATED_MS - 1000).toISOString();
        const fresh = new Date(now - 60_000).toISOString();
        expect(reconcileCallStatus({ callStatus: 'initiated', updatedAt: old }, now)).toBe('failed');
        expect(reconcileCallStatus({ callStatus: 'initiated', updatedAt: fresh }, now)).toBe('initiated');
    });

    it('a completed call whose conversation engine never came up reads as failed', () => {
        expect(reconcileCallStatus({ callStatus: 'completed', engineFailure: { errorType: 'RuntimeError' } }, now)).toBe('failed');
    });
});
