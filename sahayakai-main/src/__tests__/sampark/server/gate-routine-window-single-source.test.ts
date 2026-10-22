/**
 * Class gate (founder decision, 23 Oct 2026): every routine parent call happens between 10:00
 * and 19:00 IST, and every part of Sampark that knows the calling hours agrees on it.
 *
 * Before this gate the band lived in three places that had already drifted: the dispatcher
 * clamped to 20:00, the school API accepted an end of 20:00, and the settings screen built its
 * own hour lists from literals. The gate pins the decision to one module (routine-hours.ts) and
 * checks every consumer against it: the schema accepts exactly the hours the pickers offer, the
 * clamp never widens past the band (even for a school saved under the old ceiling), no routine
 * purpose is allowed at or after 19:00, and no shared fixture models a window the API refuses.
 */

import { PURPOSE_CATALOGUE } from '@/lib/sampark/catalogue';
import {
    ROUTINE_END_CEILING_HOUR,
    ROUTINE_END_HOUR_OPTIONS,
    ROUTINE_START_FLOOR_HOUR,
    ROUTINE_START_HOUR_OPTIONS,
} from '@/lib/sampark/policy/routine-hours';
import { effectiveRoutineWindow, samparkWindowVerdict } from '@/lib/sampark/policy/window';
import { SAMPLE_SCHOOL } from '@/lib/sampark/scripts/samples';
import { CallingWindowSchema } from '@/server/sampark/school';

import { school as engineSchool } from '../engine/_fixtures';
import { testSchool } from '../voice/_fixtures';

/** A Monday that is not a holiday in any fixture. */
const MONDAY = '2026-10-12';
const ist = (hhmm: string) => new Date(`${MONDAY}T${hhmm}:00+05:30`);

describe('gate: one routine calling band, 10:00 to 19:00 IST', () => {
    it('pins the decision', () => {
        expect(ROUTINE_START_FLOOR_HOUR).toBe(10);
        expect(ROUTINE_END_CEILING_HOUR).toBe(19);
    });

    it('the school API accepts exactly the hours the settings pickers offer', () => {
        for (let startHour = 0; startHour <= 24; startHour++) {
            for (let endHour = 0; endHour <= 24; endHour++) {
                const offered = ROUTINE_START_HOUR_OPTIONS.includes(startHour) && ROUTINE_END_HOUR_OPTIONS.includes(endHour) && startHour < endHour;
                const accepted = CallingWindowSchema.safeParse({ startHour, endHour, offDays: [0] }).success;
                expect({ startHour, endHour, accepted }).toEqual({ startHour, endHour, accepted: offered });
            }
        }
    });

    it('the clamp never widens past the band, whatever a stored school holds', () => {
        for (let startHour = 0; startHour <= 24; startHour++) {
            for (let endHour = 0; endHour <= 24; endHour++) {
                const w = effectiveRoutineWindow({ startHour, endHour, offDays: [] });
                expect(w.startHour).toBeGreaterThanOrEqual(ROUTINE_START_FLOOR_HOUR);
                expect(w.endHour).toBeLessThanOrEqual(ROUTINE_END_CEILING_HOUR);
            }
        }
    });

    const routine = Object.values(PURPOSE_CATALOGUE).filter((spec) => !spec.emergency);

    it.each(routine.map((spec) => [spec.id, spec] as const))('%s is refused at and after 19:00, even for a school saved with a 20:00 end', (_id, spec) => {
        const legacy = engineSchool({ callingWindow: { startHour: 10, endHour: 20, offDays: [0] }, holidays: [] });
        for (const t of ['19:00', '19:30', '19:59']) {
            expect(samparkWindowVerdict(legacy, spec, ist(t)).allowed).toBe(false);
        }
        expect(samparkWindowVerdict(legacy, spec, ist('09:59')).allowed).toBe(false);
    });

    it('no shared fixture or sample school models a window the API refuses', () => {
        for (const s of [SAMPLE_SCHOOL, engineSchool(), testSchool()]) {
            expect(CallingWindowSchema.safeParse(s.callingWindow).success).toBe(true);
        }
    });
});
