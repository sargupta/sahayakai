/**
 * @jest-environment node
 */
import { purposeSpec, type PurposeSpec } from '@/lib/sampark/catalogue';
import { istInstant } from '@/lib/sampark/policy/ist';
import { effectiveRoutineWindow, samparkWindowVerdict } from '@/lib/sampark/policy/window';

import { school } from './_fixtures';

const PTM = purposeSpec('ptm_invite');
const D4 = purposeSpec('emergency_closure');
const ist = (date: string, hour: number, minute = 0) => istInstant(date, hour, minute);

describe('IST conversion (no hard-coded offset, correct regardless of server zone)', () => {
    it('istInstant maps IST wall-clock to the right UTC instant', () => {
        expect(ist('2026-10-07', 11).toISOString()).toBe('2026-10-07T05:30:00.000Z');
        expect(ist('2026-10-08', 0).toISOString()).toBe('2026-10-07T18:30:00.000Z');
        expect(ist('2027-01-01', 6).toISOString()).toBe('2027-01-01T00:30:00.000Z');
    });
});

describe('samparkWindowVerdict — routine purposes', () => {
    const s = school();

    it('allows inside the school window on a school day', () => {
        const v = samparkWindowVerdict(s, PTM, ist('2026-10-07', 11));
        expect(v).toEqual({ allowed: true, reason: '', nextAllowedAt: null });
    });

    it('start hour is inclusive and end hour exclusive', () => {
        expect(samparkWindowVerdict(s, PTM, ist('2026-10-07', 10)).allowed).toBe(true);
        expect(samparkWindowVerdict(s, PTM, ist('2026-10-07', 19, 59)).allowed).toBe(true);
        const at20 = samparkWindowVerdict(s, PTM, ist('2026-10-07', 20));
        expect(at20.allowed).toBe(false);
        expect(at20.nextAllowedAt?.toISOString()).toBe(ist('2026-10-08', 10).toISOString());
    });

    it('before the window opens → next opening the same day', () => {
        const v = samparkWindowVerdict(s, PTM, ist('2026-10-07', 7, 15));
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/10:00/);
        expect(v.nextAllowedAt?.toISOString()).toBe(ist('2026-10-07', 10).toISOString());
    });

    it('clamps a wider school window into [10, 20): 09:30 and 20:30 are refused even if the school says 8–22', () => {
        const wide = school({ callingWindow: { startHour: 8, endHour: 22, offDays: [0] } });
        expect(effectiveRoutineWindow(wide.callingWindow)).toEqual({ startHour: 10, endHour: 20 });
        expect(samparkWindowVerdict(wide, PTM, ist('2026-10-07', 9, 30)).allowed).toBe(false);
        expect(samparkWindowVerdict(wide, PTM, ist('2026-10-07', 20, 30)).allowed).toBe(false);
        expect(samparkWindowVerdict(wide, PTM, ist('2026-10-07', 10)).allowed).toBe(true);
    });

    it('a narrower school window is honoured', () => {
        const narrow = school({ callingWindow: { startHour: 11, endHour: 13, offDays: [0] } });
        expect(samparkWindowVerdict(narrow, PTM, ist('2026-10-07', 10, 30)).allowed).toBe(false);
        expect(samparkWindowVerdict(narrow, PTM, ist('2026-10-07', 12, 59)).allowed).toBe(true);
        const after = samparkWindowVerdict(narrow, PTM, ist('2026-10-07', 13));
        expect(after.allowed).toBe(false);
        expect(after.nextAllowedAt?.toISOString()).toBe(ist('2026-10-08', 11).toISOString());
    });

    it('an empty window after clamping is never allowed and has no next opening', () => {
        const empty = school({ callingWindow: { startHour: 20, endHour: 23, offDays: [] } });
        const v = samparkWindowVerdict(empty, PTM, ist('2026-10-07', 12));
        expect(v.allowed).toBe(false);
        expect(v.nextAllowedAt).toBeNull();
    });

    it('Sunday (default off-day) is refused; nextAllowedAt skips to Monday 10:00', () => {
        const v = samparkWindowVerdict(s, PTM, ist('2026-10-11', 12)); // Sunday
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/Sunday/);
        expect(v.nextAllowedAt?.toISOString()).toBe(ist('2026-10-12', 10).toISOString());
    });

    it('Saturday 20:30 → next opening is Monday 10:00 (across the Sunday)', () => {
        const v = samparkWindowVerdict(s, PTM, ist('2026-10-10', 20, 30));
        expect(v.nextAllowedAt?.toISOString()).toBe(ist('2026-10-12', 10).toISOString());
    });

    it('holidays are refused (IST date) and skipped by nextAllowedAt, together with off-days', () => {
        const h = school({ holidays: ['2026-10-12', '2026-10-13'] }); // Mon + Tue (e.g. Durga Puja)
        const onHoliday = samparkWindowVerdict(h, PTM, ist('2026-10-12', 12));
        expect(onHoliday.allowed).toBe(false);
        expect(onHoliday.reason).toMatch(/holiday/);
        const sat = samparkWindowVerdict(h, PTM, ist('2026-10-10', 21));
        expect(sat.nextAllowedAt?.toISOString()).toBe(ist('2026-10-14', 10).toISOString());
    });

    it('a holiday is judged on the IST date, not the UTC date', () => {
        const h = school({ holidays: ['2026-10-13'] }); // Tuesday
        // 2026-10-12T20:00Z is still Monday in UTC but 01:30 on Tuesday 13 October in IST.
        const v = samparkWindowVerdict(h, PTM, new Date('2026-10-12T20:00:00Z'));
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/2026-10-13 is a school holiday/);
        expect(v.nextAllowedAt?.toISOString()).toBe(ist('2026-10-14', 10).toISOString());
    });

    it('custom off-days (Saturday + Sunday)', () => {
        const s2 = school({ callingWindow: { startHour: 10, endHour: 20, offDays: [0, 6] } });
        const fri = samparkWindowVerdict(s2, PTM, ist('2026-10-09', 20));
        expect(fri.nextAllowedAt?.toISOString()).toBe(ist('2026-10-12', 10).toISOString());
    });

    it('concern purposes (noFridaySaturday) are never placed on Friday or Saturday', () => {
        const concern: PurposeSpec = { ...purposeSpec('academic_talk') };
        const fri = samparkWindowVerdict(s, concern, ist('2026-10-09', 12));
        expect(fri.allowed).toBe(false);
        expect(fri.nextAllowedAt?.toISOString()).toBe(ist('2026-10-12', 10).toISOString());
        expect(samparkWindowVerdict(s, PTM, ist('2026-10-09', 12)).allowed).toBe(true);
    });
});

describe('samparkWindowVerdict — emergency (D4) path: 06:00–21:00 IST any day', () => {
    const s = school({ holidays: ['2026-10-08'] });

    it('allows from 06:00 IST — the one sanctioned widening of the 09:00 platform floor', () => {
        expect(samparkWindowVerdict(s, D4, ist('2026-10-07', 6)).allowed).toBe(true);
        expect(samparkWindowVerdict(s, D4, ist('2026-10-07', 5, 59)).allowed).toBe(false);
        // Routine purposes stay closed at the same instant.
        expect(samparkWindowVerdict(s, PTM, ist('2026-10-07', 6, 30)).allowed).toBe(false);
    });

    it('ends at 21:00 IST (the platform end, not widened)', () => {
        expect(samparkWindowVerdict(s, D4, ist('2026-10-07', 20, 59)).allowed).toBe(true);
        const late = samparkWindowVerdict(s, D4, ist('2026-10-07', 21));
        expect(late.allowed).toBe(false);
        expect(late.nextAllowedAt?.toISOString()).toBe(ist('2026-10-08', 6).toISOString());
    });

    it('ignores off-days and holidays', () => {
        expect(samparkWindowVerdict(s, D4, ist('2026-10-11', 6, 30)).allowed).toBe(true); // Sunday
        expect(samparkWindowVerdict(s, D4, ist('2026-10-08', 7)).allowed).toBe(true); // holiday
    });

    it('before 06:00 → 06:00 the same IST day', () => {
        const v = samparkWindowVerdict(s, D4, ist('2026-10-08', 4, 10));
        expect(v.nextAllowedAt?.toISOString()).toBe(ist('2026-10-08', 6).toISOString());
    });

    it('only the catalogue emergency flag unlocks it: emergency_closure is the only emergency purpose', () => {
        const { PURPOSE_CATALOGUE } = jest.requireActual('@/lib/sampark/catalogue') as typeof import('@/lib/sampark/catalogue');
        const emergencies = Object.values(PURPOSE_CATALOGUE).filter((p) => p.emergency).map((p) => p.id);
        expect(emergencies).toEqual(['emergency_closure']);
    });
});
