/** @jest-environment node */
/**
 * Principal cards on Today (the demo school's principal monitor, on real data):
 * "Why teachers called" counts the last 7 days by reason, and "Callbacks today"
 * shows what is due today plus every proposal waiting for a person.
 */

import { callbacksForToday, isSwitchedOff, istDayStart, teacherReasonsThisWeek, teachersThisWeek } from '@/components/sampark/principal-cards';
import { ApiError } from '@/lib/api/client';
import type { CallbackView } from '@/lib/api/sampark-callbacks';
import type { TeacherCallEntry, TeacherCallReason } from '@/types/sampark';

const NOW = Date.parse('2026-11-21T10:00:00+05:30');
const DAY = 86_400_000;

function call(id: string, reason: TeacherCallReason, agoMs: number, who: Partial<TeacherCallEntry> = {}): TeacherCallEntry {
    return {
        id, source: 'teacher', createdAt: new Date(NOW - agoMs).toISOString(),
        phoneLast4: '0720', className: 'Class 7B', reason, outcome: 'completed', durationSeconds: 40,
        teacherUid: 'teacher-a', teacherName: 'Anjali Rai', ...who,
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

describe('teachersThisWeek', () => {
    const rao = { teacherUid: 'teacher-b', teacherName: 'Mrs Rao' };

    it('counts calls and reached per teacher over 7 days, most calls first', () => {
        const rows = teachersThisWeek(
            [
                call('a1', 'consecutive_absences', 1 * DAY),
                call('b1', 'poor_performance', 1 * DAY, { ...rao, outcome: 'no_answer' }),
                call('b2', 'poor_performance', 2 * DAY, rao),
                call('b3', 'positive_feedback', 3 * DAY, rao),
                call('b-old', 'positive_feedback', 8 * DAY, rao),
            ],
            NOW,
        );
        expect(rows).toEqual([
            { teacherUid: 'teacher-b', teacherName: 'Mrs Rao', calls: 3, reached: 2 },
            { teacherUid: 'teacher-a', teacherName: 'Anjali Rai', calls: 1, reached: 1 },
        ]);
    });

    it('groups by teacher id, not name; skips calls with no teacher id; keeps the latest name', () => {
        const rows = teachersThisWeek(
            [
                call('n1', 'other', 1 * DAY, { teacherUid: 'teacher-c', teacherName: 'Priya Thapa' }),
                call('n2', 'other', 2 * DAY, { teacherUid: 'teacher-c', teacherName: 'Priya T.' }),
                call('same-name', 'other', 1 * DAY, { teacherUid: 'teacher-d', teacherName: 'Priya Thapa' }),
                call('none', 'other', 1 * DAY, { teacherUid: '', teacherName: 'Ghost' }),
            ],
            NOW,
        );
        expect(rows.map((r) => [r.teacherUid, r.teacherName, r.calls])).toEqual([
            ['teacher-c', 'Priya Thapa', 2],
            ['teacher-d', 'Priya Thapa', 1],
        ]);
    });

    it('a teacher without a recorded name sorts after named teachers', () => {
        const rows = teachersThisWeek([call('x', 'other', DAY, { teacherUid: 't-x', teacherName: null }), call('y', 'other', DAY)], NOW);
        expect(rows.map((r) => r.teacherUid)).toEqual(['teacher-a', 't-x']);
    });
});
