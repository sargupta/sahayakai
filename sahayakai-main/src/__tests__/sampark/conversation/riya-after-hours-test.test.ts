/**
 * The local after-hours Riya test exception (localAfterHoursTestOverride): it opens the calling
 * window for exactly the authorised school, student and number, on the local emulator only, once.
 */

import { hashPhone } from '@/lib/sampark/phone';
import type { SamparkSchool } from '@/types/sampark';
import { LOCAL_AFTER_HOURS_TEST, localAfterHoursTestOverride } from '@/server/sampark/conversation';

import { setPhoneEnv } from '../server/_helpers';

const NOW = new Date('2026-10-29T15:00:00Z'); // 20:30 IST, after the 10:00–20:00 window
const ARMED = { armedAt: '2026-10-29T14:55:00Z', until: '2026-10-29T15:55:00Z' };

const localEnv = (over: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    NODE_ENV: 'development',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: LOCAL_AFTER_HOURS_TEST.phoneE164,
    ...over,
});

function school(over: Partial<SamparkSchool> = {}): SamparkSchool {
    return {
        orgId: LOCAL_AFTER_HOURS_TEST.orgId,
        isDemo: false,
        mode: 'test',
        testPhoneHash: hashPhone(LOCAL_AFTER_HOURS_TEST.phoneE164),
        localAfterHoursTest: ARMED,
        ...over,
    } as SamparkSchool;
}

const run = (o: { env?: Record<string, string | undefined>; school?: Partial<SamparkSchool>; student?: string; destination?: 'test_phone' | 'guardian' | null; now?: Date; attempts?: number } = {}) =>
    localAfterHoursTestOverride(
        o.env ?? localEnv(),
        school(o.school),
        o.student ?? LOCAL_AFTER_HOURS_TEST.studentId,
        o.destination === undefined ? 'test_phone' : o.destination,
        o.now ?? NOW,
        o.attempts ?? 0,
    );

describe('local after-hours Riya test exception', () => {
    beforeAll(setPhoneEnv);

    it('opens the window for the authorised school, student and number, once', () => {
        expect(run()).toEqual({ active: true, until: '2026-10-29T15:55:00.000Z', inactiveReason: null });
    });

    it('is off when not armed, so the normal 10:00–20:00 rule applies', () => {
        expect(run({ school: { localAfterHoursTest: null } })).toMatchObject({ active: false, inactiveReason: null });
    });

    it('never applies outside the local emulator or in production', () => {
        expect(run({ env: localEnv({ FIRESTORE_EMULATOR_HOST: undefined }) })).toMatchObject({ active: false, inactiveReason: 'not_local_emulator' });
        expect(run({ env: localEnv({ NODE_ENV: 'production' }) })).toMatchObject({ active: false, inactiveReason: 'not_local_emulator' });
        expect(run({ env: localEnv({ SAMPARK_FIRESTORE_DATABASE: undefined }) })).toMatchObject({ active: false, inactiveReason: 'not_nonprod_database' });
    });

    it('never applies to another school, a demo school, another student or a non-test destination', () => {
        expect(run({ school: { orgId: 'hillview-demo' } })).toMatchObject({ active: false, inactiveReason: 'not_test_school' });
        expect(run({ school: { isDemo: true } })).toMatchObject({ active: false, inactiveReason: 'not_test_school' });
        expect(run({ student: 'riya-demo-student' })).toMatchObject({ active: false, inactiveReason: 'not_test_student' });
        expect(run({ school: { mode: 'practice' } })).toMatchObject({ active: false, inactiveReason: 'not_test_phone' });
        expect(run({ destination: 'guardian' })).toMatchObject({ active: false, inactiveReason: 'not_test_phone' });
    });

    it('never applies to another number, or when the number is not on the allow-list', () => {
        expect(run({ school: { testPhoneHash: hashPhone('+919800000001') } })).toMatchObject({ active: false, inactiveReason: 'not_test_number' });
        expect(run({ env: localEnv({ SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: '+919800000001' }) })).toMatchObject({ active: false, inactiveReason: 'not_test_number' });
    });

    it('allows one attempt only, expires, and cannot be armed for longer than 3 hours', () => {
        expect(run({ attempts: 1 })).toMatchObject({ active: false, inactiveReason: 'already_used' });
        expect(run({ now: new Date('2026-10-29T16:00:00Z') })).toMatchObject({ active: false, inactiveReason: 'expired' });
        expect(run({ school: { localAfterHoursTest: { armedAt: ARMED.armedAt, until: '2026-10-29T20:00:00Z' } } })).toMatchObject({ active: false, inactiveReason: 'longer_than_3_hours' });
        expect(run({ school: { localAfterHoursTest: { armedAt: 'x', until: ARMED.until } } })).toMatchObject({ active: false, inactiveReason: 'unparseable' });
    });
});
