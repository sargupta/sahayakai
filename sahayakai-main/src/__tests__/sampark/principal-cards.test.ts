/** @jest-environment node */
/**
 * Principal cards on Today (the demo school's principal monitor, on real data):
 * "Why teachers called" counts the last 7 days by reason, and "Callbacks today"
 * shows what is due today plus every proposal waiting for a person.
 */

import { callbacksForToday, isSwitchedOff, istDayStart, teacherReasonsThisWeek } from '@/components/sampark/principal-cards';
import { ApiError } from '@/lib/api/client';
import type { CallbackView } from '@/lib/api/sampark-callbacks';
import type { TeacherCallEntry, TeacherCallReason } from '@/types/sampark';

const NOW = Date.parse('2026-11-21T10:00:00+05:30');
const DAY = 86_400_000;

function call(id: string, reason: TeacherCallReason, agoMs: number): TeacherCallEntry {
    return {
        id, source: 'teacher', createdAt: new Date(NOW - agoMs).toISOString(),
        phoneLast4: '0720', className: 'Class 7B', reason, outcome: 'completed', durationSeconds: 40,
    };
}

function cb(id: string, status: CallbackView['status'], scheduledAt: string | null): CallbackView {
    return { id, status, scheduledAt } as CallbackView;
}

describe('teacherReasonsThisWeek', () => {
    it('counts only the last 7 days, in a fixed order, with zeros kept', () => {
        const rows = teacherReasonsThisWeek(
            [
                call('a', 'consecutive_absences', 1 * DAY),
                call('b', 'consecutive_absences', 2 * DAY),
                call('c', 'positive_feedback', 6.9 * DAY),
                call('d', 'behavioral_concern', 7 * DAY), // exactly a week ago: out
                call('e', 'poor_performance', 30 * DAY),
            ],
            NOW,
        );
        expect(rows).toEqual([
            { reason: 'consecutive_absences', count: 2 },
            { reason: 'poor_performance', count: 0 },
            { reason: 'behavioral_concern', count: 0 },
            { reason: 'positive_feedback', count: 1 },
        ]);
    });

    it('adds "other" only when such calls exist, and ignores future or unparseable times', () => {
        const future = { ...call('f', 'other', 0), createdAt: new Date(NOW + DAY).toISOString() };
        const broken = { ...call('g', 'other', 0), createdAt: 'not a date' };
        expect(teacherReasonsThisWeek([future, broken], NOW).map((r) => r.reason)).not.toContain('other');
        expect(teacherReasonsThisWeek([call('h', 'other', DAY)], NOW).at(-1)).toEqual({ reason: 'other', count: 1 });
    });
});

describe('callbacksForToday', () => {
    const today = '2026-11-21';

    it('keeps proposals and today\'s scheduled, running and missed callbacks; proposals first, then by time', () => {
        const rows = callbacksForToday(
            [
                cb('s-late', 'scheduled', '2026-11-21T12:30:00Z'),
                cb('s-early', 'scheduled', '2026-11-21T05:00:00Z'),
                cb('missed', 'missed', '2026-11-21T04:00:00Z'),
                cb('done', 'completed', '2026-11-21T04:30:00Z'),
                cb('cancelled', 'cancelled', '2026-11-21T06:00:00Z'),
                cb('tomorrow', 'scheduled', '2026-11-22T05:00:00Z'),
            ],
            [cb('p', 'proposed', null)],
            today,
        );
        expect(rows.map((r) => r.id)).toEqual(['p', 'missed', 's-early', 's-late']);
    });

    it('uses the IST day: 20 Nov 19:00 UTC is already 21 Nov in India', () => {
        expect(callbacksForToday([cb('x', 'scheduled', '2026-11-20T19:00:00Z')], [], today).map((r) => r.id)).toEqual(['x']);
        expect(callbacksForToday([cb('y', 'scheduled', '2026-11-20T18:00:00Z')], [], today)).toEqual([]);
    });

    it('lists a callback once even if it comes back in both lists', () => {
        const p = cb('p', 'proposed', null);
        expect(callbacksForToday([p], [p], today)).toHaveLength(1);
    });
});

describe('istDayStart', () => {
    it('is IST midnight', () => {
        expect(istDayStart('2026-11-21').toISOString()).toBe('2026-11-20T18:30:00.000Z');
    });
});

describe('isSwitchedOff', () => {
    it('is true only for a 404 from the API (feature not on for this deployment)', () => {
        expect(isSwitchedOff(new ApiError(404, 'Not found'))).toBe(true);
        expect(isSwitchedOff(new ApiError(500, 'boom'))).toBe(false);
        expect(isSwitchedOff(new Error('network'))).toBe(false);
        expect(isSwitchedOff(null)).toBe(false);
    });
});
