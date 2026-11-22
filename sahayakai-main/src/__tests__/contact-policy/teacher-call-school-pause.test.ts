/** @jest-environment node */
/**
 * A school's pause stops the teacher's Contact button too. Before this, pausing a school in the
 * Sampark console stopped campaigns but a teacher could still dial a parent of that school
 * (found by the independent review, 22 Nov 2026). A teacher's call is routine, so both pause
 * scopes ('all' and 'routine') stop it; a teacher with no school, or a school that is not paused,
 * goes on to the usual contact check; failing to read the school fails closed.
 */

import { clearTeacherCall, type TeacherSchoolDb } from '@/lib/contact-policy/teacher';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SchoolPause } from '@/types/sampark';

jest.mock('@/lib/sampark/repo/factory', () => ({ getSamparkRepo: async () => { throw new Error('use the injected repo'); } }));

const ORG = 'hillview-demo';
const PARENT = '+919812345678';
/** 11:00 IST on Wednesday 7 Oct 2026: inside calling hours. */
const AT = new Date(Date.UTC(2026, 9, 7, 5, 30));

beforeAll(() => {
    process.env.SAMPARK_PII_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.SAMPARK_PHONE_PEPPER = 'test-pepper';
});

function db(orgId: string | null): TeacherSchoolDb {
    return {
        collection: (name: string) => ({
            doc: (id: string) => ({
                get: async () => (name === 'users' && orgId
                    ? { exists: true, data: () => ({ organizationId: orgId }) }
                    : { exists: false, data: () => undefined }),
                collection: () => ({ doc: () => ({ get: async () => ({ exists: orgId !== null && id === orgId }) }) }),
            }),
        }),
    } as unknown as TeacherSchoolDb;
}

const pause = (scope: SchoolPause['scope']): SchoolPause => ({ at: AT.toISOString(), by: 'admin', reason: 'test', scope });

async function clear(orgId: string | null, schoolPause: SchoolPause | null | 'no-school' | 'error') {
    const store = createMemorySamparkRepo();
    const schools = {
        getSchool: async () => {
            if (schoolPause === 'error') throw new Error('store down');
            return schoolPause === 'no-school' ? null : { pause: schoolPause };
        },
    };
    return clearTeacherCall({ db: db(orgId), uid: 't1', parentPhone: PARENT, at: AT, store, schools });
}

describe('a school pause stops the teacher Contact button', () => {
    it.each(['all', 'routine'] as const)('a %s pause refuses the call as school_paused', async (scope) => {
        const out = await clear(ORG, pause(scope));
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.decision.reason).toBe('school_paused');
    });

    it('an unpaused school goes on to the contact check and is allowed', async () => {
        expect((await clear(ORG, null)).ok).toBe(true);
    });

    it('a school Sampark does not know has no pause to apply', async () => {
        expect((await clear(ORG, 'no-school')).ok).toBe(true);
    });

    it('a teacher with no school is never asked about a pause', async () => {
        expect((await clear(null, 'error')).ok).toBe(true);
    });

    it('fails closed when the school cannot be read', async () => {
        const out = await clear(ORG, 'error');
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.decision.reason).toBe('policy_unavailable');
    });
});
