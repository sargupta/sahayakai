/**
 * Regression tests for the privilege-escalation + default-clobber fix in
 * POST /api/user/profile (src/app/api/user/profile/route.ts).
 *
 * Before the fix:
 *   1. `planType` was part of UserProfileSchema, survived Zod parsing, and was
 *      written through `dbAdapter.createUser` — an UNFILTERED set(merge:true).
 *      Any authenticated user could POST { planType: 'premium' } and self-grant
 *      a paid plan, bypassing what firestore.rules `protectedUserFields()`
 *      encodes. The doc-level planType is the enforcing gate for the paid
 *      attendance/parent-call feature (src/server/attendance.ts requireProPlan,
 *      /api/attendance/outreach) and for daily caps (usage-tracker).
 *   2. Zod applies schema defaults on EVERY parse, and those were written back
 *      through the same unfiltered path — so saving a display name wrote
 *      planType:'free', impactScore:0, contentSharedCount:0, subjects:[] and
 *      downgraded a paying teacher.
 */

const createUserMock = jest.fn(async () => {});
const updateUserMock = jest.fn(async () => {});
const getUserMock = jest.fn();

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: (...args: any[]) => getUserMock(...args),
        createUser: (...args: any[]) => createUserMock(...args),
        updateUser: (...args: any[]) => updateUserMock(...args),
    },
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const fanoutMock = jest.fn(async () => ({ sent: 0 }));
jest.mock('@/lib/notifications/fanout', () => ({
    fanoutNewTeacherJoinedNotification: (...args: any[]) => fanoutMock(...args),
}));

import { POST } from '@/app/api/user/profile/route';

/** An existing PAYING teacher with real server-computed aggregates. */
const PAID_TEACHER = {
    uid: 'teacher-1',
    email: 'asha@school.example',
    displayName: 'Asha Rao',
    planType: 'premium',
    impactScore: 4200,
    contentSharedCount: 37,
    subjects: ['Mathematics'],
    gradeLevels: ['Class 8'],
    schoolName: 'GHS Mysuru',
    followersCount: 12,
};

function makeRequest(body: unknown, userId: string | null = 'teacher-1') {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        headers: { get: (k: string) => headers.get(k) ?? null },
        json: async () => body,
    } as any;
}

/** The payload that actually reached Firestore, whichever path wrote it. */
function writtenPayload(): Record<string, any> {
    if (createUserMock.mock.calls.length > 0) {
        return (createUserMock.mock.calls[0] as any[])[0];
    }
    return (updateUserMock.mock.calls[0] as any[])[1];
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('POST /api/user/profile — privilege escalation is blocked', () => {
    it('IGNORES a client-supplied planType for an existing user (self-grant blocked)', async () => {
        getUserMock.mockResolvedValue({ ...PAID_TEACHER, planType: 'free' });

        const res = await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha Rao',
            planType: 'premium',
        }));

        expect(res.status).toBe(200);
        expect(createUserMock).not.toHaveBeenCalled();
        expect(updateUserMock).toHaveBeenCalledTimes(1);
        expect(writtenPayload()).not.toHaveProperty('planType');
    });

    it('IGNORES a client-supplied planType on FIRST save (new users are always free)', async () => {
        getUserMock.mockResolvedValue(null);

        const res = await POST(makeRequest({
            uid: 'teacher-1',
            email: 'asha@school.example',
            displayName: 'Asha Rao',
            planType: 'premium',
        }));

        expect(res.status).toBe(200);
        expect(createUserMock).toHaveBeenCalledTimes(1);
        // The seed is server-stamped 'free', NOT the requested 'premium'.
        expect(writtenPayload().planType).toBe('free');
    });

    it('IGNORES client-supplied impactScore / contentSharedCount (server-computed aggregates)', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);

        await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha Rao',
            impactScore: 999999,
            contentSharedCount: 999999,
        }));

        const written = writtenPayload();
        expect(written).not.toHaveProperty('impactScore');
        expect(written).not.toHaveProperty('contentSharedCount');
    });

    it('IGNORES admin / billing flags smuggled in the body', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);

        await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha Rao',
            planType: 'premium',
            planTier: 'premium',
            isAdmin: true,
            role: 'admin',
            adminRoles: ['superadmin'],
            organizationId: 'victim-org',
            subscriptionStatus: 'active',
            razorpaySubscriptionId: 'sub_forged',
            monthlyCredits: 1e9,
        }));

        const written = writtenPayload();
        for (const forbidden of [
            'planType', 'planTier', 'isAdmin', 'role', 'adminRoles',
            'organizationId', 'subscriptionStatus', 'razorpaySubscriptionId',
            'monthlyCredits',
        ]) {
            expect(written).not.toHaveProperty(forbidden);
        }
    });

    it('never lets the client rewrite email / createdAt on an existing profile', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);

        await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha Rao',
            email: 'attacker@evil.example',
            createdAt: '1999-01-01',
        }));

        const written = writtenPayload();
        expect(written).not.toHaveProperty('email');
        expect(written).not.toHaveProperty('createdAt');
    });

    it('writes to the AUTHENTICATED uid even when body.uid is an empty string', async () => {
        // '' is falsy, so it slipped past the `if (body.uid && ...)` ownership
        // check while still satisfying `z.string()` — the write then targeted
        // doc(''). The uid is now always server-supplied.
        getUserMock.mockResolvedValue(null);

        await POST(makeRequest({ uid: '', displayName: 'Asha Rao' }));

        expect(createUserMock).toHaveBeenCalledTimes(1);
        expect(writtenPayload().uid).toBe('teacher-1');
    });

    it('still rejects a cross-user write with 403', async () => {
        const res = await POST(makeRequest({ uid: 'someone-else', displayName: 'X' }));
        expect(res.status).toBe(403);
        expect(createUserMock).not.toHaveBeenCalled();
        expect(updateUserMock).not.toHaveBeenCalled();
    });

    it('still rejects an unauthenticated write with 401', async () => {
        const res = await POST(makeRequest({ uid: 'teacher-1', displayName: 'X' }, null));
        expect(res.status).toBe(401);
        expect(getUserMock).not.toHaveBeenCalled();
    });
});

describe('POST /api/user/profile — a legitimate save does not corrupt a paying user', () => {
    beforeEach(() => {
        getUserMock.mockResolvedValue(PAID_TEACHER);
    });

    it('saving ONLY displayName does not reset planType / impactScore / contentSharedCount', async () => {
        const res = await POST(makeRequest({ uid: 'teacher-1', displayName: 'Asha R. Rao' }));

        expect(res.status).toBe(200);
        const written = writtenPayload();
        expect(written.displayName).toBe('Asha R. Rao');
        // The whole point: these keys must be ABSENT, so merge:true leaves the
        // stored values (premium / 4200 / 37) untouched.
        expect(written).not.toHaveProperty('planType');
        expect(written).not.toHaveProperty('impactScore');
        expect(written).not.toHaveProperty('contentSharedCount');
    });

    it('saving ONLY displayName does not wipe subjects / gradeLevels (Zod default resurrection)', async () => {
        await POST(makeRequest({ uid: 'teacher-1', displayName: 'Asha R. Rao' }));

        const written = writtenPayload();
        expect(written).not.toHaveProperty('subjects');
        expect(written).not.toHaveProperty('gradeLevels');
        expect(written).not.toHaveProperty('preferredLanguage');
    });

    it('sending `gradeLevels` (unsupported alias) does not wipe stored grades', async () => {
        await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha Rao',
            gradeLevels: ['Class 5'],
        }));

        // The alias is not part of the schema, so it is ignored — but crucially
        // it no longer causes gradeLevels:[] to be written over Class 8.
        expect(writtenPayload()).not.toHaveProperty('gradeLevels');
    });
});

describe('POST /api/user/profile — legitimate editable fields still save', () => {
    it('persists the client-writable slice for an existing user', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);

        const res = await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha R. Rao',
            schoolName: 'KV Mysuru',
            subjects: ['Science', 'Mathematics'],
            teachingGradeLevels: ['Class 9'],
            preferredLanguage: 'Kannada',
            phoneNumber: '+919876543210',
        }));

        expect(res.status).toBe(200);
        const [uid, written] = updateUserMock.mock.calls[0] as any[];
        expect(uid).toBe('teacher-1');
        expect(written.displayName).toBe('Asha R. Rao');
        expect(written.schoolName).toBe('KV Mysuru');
        expect(written.subjects).toEqual(['Science', 'Mathematics']);
        expect(written.preferredLanguage).toBe('Kannada');
        expect(written.phoneNumber).toBe('+919876543210');
        // Wire field teachingGradeLevels is stored as gradeLevels.
        expect(written.gradeLevels).toEqual(['Class 9']);
        expect(written).not.toHaveProperty('teachingGradeLevels');
    });

    it('resets groupsInitialized when a group-affecting field actually changes', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);

        await POST(makeRequest({
            uid: 'teacher-1',
            displayName: 'Asha Rao',
            schoolName: 'KV Mysuru', // changed from GHS Mysuru
        }));

        expect(writtenPayload().groupsInitialized).toBe(false);
    });

    it('does NOT reset groupsInitialized when group-affecting fields are merely omitted', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);

        await POST(makeRequest({ uid: 'teacher-1', displayName: 'Asha Rao' }));

        expect(writtenPayload()).not.toHaveProperty('groupsInitialized');
    });

    it('seeds a new profile with the client fields plus server-stamped aggregates', async () => {
        getUserMock.mockResolvedValue(null);

        await POST(makeRequest({
            uid: 'teacher-1',
            email: 'asha@school.example',
            displayName: 'Asha Rao',
            subjects: ['Mathematics'],
            teachingGradeLevels: ['Class 8'],
        }));

        const written = writtenPayload();
        expect(written.displayName).toBe('Asha Rao');
        expect(written.subjects).toEqual(['Mathematics']);
        expect(written.gradeLevels).toEqual(['Class 8']);
        expect(written.planType).toBe('free');
        expect(written.impactScore).toBe(0);
        expect(written.contentSharedCount).toBe(0);
        expect(written.followersCount).toBe(0);
        expect(written.verifiedStatus).toBe('none');
        expect(fanoutMock).toHaveBeenCalledWith('teacher-1');
    });

    it('does not fan out for an existing user', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);
        await POST(makeRequest({ uid: 'teacher-1', displayName: 'Asha Rao' }));
        expect(fanoutMock).not.toHaveBeenCalled();
    });

    it('still rejects a schema-invalid body with 400 before any write', async () => {
        getUserMock.mockResolvedValue(PAID_TEACHER);
        const res = await POST(makeRequest({ uid: 'teacher-1' })); // displayName missing
        expect(res.status).toBe(400);
        expect(createUserMock).not.toHaveBeenCalled();
        expect(updateUserMock).not.toHaveBeenCalled();
    });
});
