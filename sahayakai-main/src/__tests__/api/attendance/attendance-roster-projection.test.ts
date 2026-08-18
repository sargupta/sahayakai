/**
 * GET /api/attendance/classes/[classId]/students — ?projection=roster PII gate.
 *
 * This suite is the spec for the masking. Two invariants it exists to protect:
 *
 * 1. The masked projection carries EXACTLY six fields and the full E.164
 *    parentPhone appears nowhere in the serialized response — not under a
 *    different key, not inside a nested object. Assertions check the whole
 *    JSON payload as a string, so a future field that re-embeds the number
 *    fails here rather than in production.
 * 2. The DEFAULT response (no `projection`) is unchanged, field for field,
 *    including parentPhone. The web student-manager depends on it.
 *
 * Body assertions use the repo convention of spying on NextResponse.json —
 * jsdom's Response.json() can't re-read the body.
 */

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonBody(): any {
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0];
}

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => ({ planType: 'pro' })),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/plan-utils', () => ({
    hasAdvancedPlan: () => true,
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── In-memory firestore double ──────────────────────────────────────────────

interface FakeClass { teacherUid: string }

const fakeClasses: Record<string, FakeClass> = {};
const fakeStudents: Record<string, Array<{ id: string } & Record<string, any>>> = {};

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (coll: string) => ({
            doc: (classId: string) => {
                if (coll !== 'classes') return {};
                return {
                    get: async () => ({
                        exists: !!fakeClasses[classId],
                        data: () => fakeClasses[classId],
                    }),
                    collection: (sub: string) => ({
                        orderBy: () => ({
                            get: async () => ({
                                docs: (sub === 'students' ? (fakeStudents[classId] ?? []) : [])
                                    .map(({ id, ...data }) => ({ id, data: () => data })),
                            }),
                        }),
                    }),
                };
            },
        }),
    }),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const UID = 'teacher-A';
const FULL_PHONE = '+919876543210';

/** The exact Firestore document shape the legacy default response returns. */
const ASHA_DOC = {
    id: 's1',
    classId: 'c1',
    name: 'Asha Devi',
    rollNumber: 1,
    parentPhone: FULL_PHONE,
    parentLanguage: 'Hindi',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
};

/** A student whose parent has no phone on file — the hasParentPhone=false leg. */
const BIKASH_DOC = {
    id: 's2',
    classId: 'c1',
    name: 'Bikash Roy',
    rollNumber: 2,
    parentPhone: '',
    parentLanguage: 'Bengali',
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
};

function makeRequest(opts: { userId?: string | null; url?: string } = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    return {
        url: opts.url ?? 'http://localhost/api/attendance/classes/c1/students',
        json: async () => ({}),
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as import('next/server').NextRequest;
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

const rosterUrl = 'http://localhost/api/attendance/classes/c1/students?projection=roster';

beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(fakeClasses)) delete fakeClasses[k];
    for (const k of Object.keys(fakeStudents)) delete fakeStudents[k];
    fakeClasses['c1'] = { teacherUid: UID };
    fakeStudents['c1'] = [ASHA_DOC, BIKASH_DOC];
});

// ── Default projection: must not move ───────────────────────────────────────

describe('GET students — default response is unchanged', () => {
    it('returns the full student documents verbatim, parentPhone included', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(makeRequest({ userId: UID }), ctx({ classId: 'c1' }));

        expect(res.status).toBe(200);
        // Deep equality against the raw documents — any added, dropped or
        // reordered field fails this.
        expect(lastJsonBody()).toEqual([ASHA_DOC, BIKASH_DOC]);
        expect(lastJsonBody()[0].parentPhone).toBe(FULL_PHONE);
    });

    it('is unaffected by unrelated query parameters', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');

        await GET(makeRequest({ userId: UID }), ctx({ classId: 'c1' }));
        const withoutParams = JSON.stringify(lastJsonBody());

        await GET(
            makeRequest({ userId: UID, url: 'http://localhost/api/attendance/classes/c1/students?limit=5' }),
            ctx({ classId: 'c1' }),
        );

        expect(JSON.stringify(lastJsonBody())).toBe(withoutParams);
    });

    it('rejects an empty projection rather than silently serving the full shape', async () => {
        // A client that builds `?projection=${mode}` with an unset mode is
        // buggy; failing loudly beats handing it every parent's phone number.
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(
            makeRequest({ userId: UID, url: 'http://localhost/api/attendance/classes/c1/students?projection=' }),
            ctx({ classId: 'c1' }),
        );
        expect(res.status).toBe(400);
    });
});

// ── Masked projection: the PII gate ─────────────────────────────────────────

describe('GET students?projection=roster — masked roster', () => {
    const ROSTER_FIELDS = [
        'id', 'name', 'rollNumber', 'parentLanguage', 'hasParentPhone', 'parentPhoneLast4',
    ];

    it('returns exactly the six roster fields and nothing else', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(makeRequest({ userId: UID, url: rosterUrl }), ctx({ classId: 'c1' }));

        expect(res.status).toBe(200);
        const body = lastJsonBody();
        expect(body).toHaveLength(2);
        for (const entry of body) {
            expect(Object.keys(entry).sort()).toEqual([...ROSTER_FIELDS].sort());
        }
    });

    it('never emits the full parent phone number anywhere in the payload', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        await GET(makeRequest({ userId: UID, url: rosterUrl }), ctx({ classId: 'c1' }));

        const serialized = JSON.stringify(lastJsonBody());
        expect(serialized).not.toContain(FULL_PHONE);
        expect(serialized).not.toContain('9876543210');   // bare 10-digit form
        expect(serialized).not.toContain('parentPhone"'); // the key itself
        for (const entry of lastJsonBody()) {
            expect(entry).not.toHaveProperty('parentPhone');
        }
    });

    it('masks a present phone down to hasParentPhone + last four digits', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        await GET(makeRequest({ userId: UID, url: rosterUrl }), ctx({ classId: 'c1' }));

        expect(lastJsonBody()[0]).toEqual({
            id: 's1',
            name: 'Asha Devi',
            rollNumber: 1,
            parentLanguage: 'Hindi',
            hasParentPhone: true,
            parentPhoneLast4: '3210',
        });
    });

    it('reports hasParentPhone=false with an empty last4 when no phone is on file', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        await GET(makeRequest({ userId: UID, url: rosterUrl }), ctx({ classId: 'c1' }));

        expect(lastJsonBody()[1]).toEqual({
            id: 's2',
            name: 'Bikash Roy',
            rollNumber: 2,
            parentLanguage: 'Bengali',
            hasParentPhone: false,
            parentPhoneLast4: '',
        });
    });

    it('rejects an unrecognised projection instead of falling back to the full shape', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(
            makeRequest({ userId: UID, url: 'http://localhost/api/attendance/classes/c1/students?projection=full' }),
            ctx({ classId: 'c1' }),
        );

        expect(res.status).toBe(400);
        expect(lastJsonBody().error).toBe('Invalid query parameters');
    });
});

// ── Auth and ownership are inherited, not re-implemented ────────────────────

describe('GET students?projection=roster — auth and ownership', () => {
    it('401s without x-user-id', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(makeRequest({ userId: null, url: rosterUrl }), ctx({ classId: 'c1' }));
        expect(res.status).toBe(401);
    });

    it('403s for a class owned by another teacher', async () => {
        fakeClasses['c1'] = { teacherUid: 'teacher-B' };
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(makeRequest({ userId: UID, url: rosterUrl }), ctx({ classId: 'c1' }));
        expect(res.status).toBe(403);
        expect(lastJsonBody().error).toBe('Unauthorized');
    });

    it('404s for a class that does not exist', async () => {
        const { GET } = await import('@/app/api/attendance/classes/[classId]/students/route');
        const res = await GET(
            makeRequest({ userId: UID, url: 'http://localhost/api/attendance/classes/nope/students?projection=roster' }),
            ctx({ classId: 'nope' }),
        );
        expect(res.status).toBe(404);
        expect(lastJsonBody().error).toBe('Class not found');
    });
});

// ── Masking primitive ───────────────────────────────────────────────────────

describe('toRosterStudent', () => {
    it('strips non-digits before taking the last four', async () => {
        const { toRosterStudent } = await import('@/server/attendance');
        expect(toRosterStudent({ ...ASHA_DOC, parentPhone: '+91 98765-43 210' } as any).parentPhoneLast4)
            .toBe('3210');
    });

    it('returns an empty last4 rather than a partial one for short input', async () => {
        const { toRosterStudent } = await import('@/server/attendance');
        const masked = toRosterStudent({ ...ASHA_DOC, parentPhone: '210' } as any);
        expect(masked.parentPhoneLast4).toBe('');
        expect(masked.hasParentPhone).toBe(true);
    });

    it('tolerates a missing parentPhone field on a legacy document', async () => {
        const { toRosterStudent } = await import('@/server/attendance');
        const withoutPhone = { ...ASHA_DOC } as Partial<typeof ASHA_DOC>;
        delete withoutPhone.parentPhone;
        const masked = toRosterStudent(withoutPhone as any);
        expect(masked.hasParentPhone).toBe(false);
        expect(masked.parentPhoneLast4).toBe('');
    });

    it('does not carry over any field outside the six-field contract', async () => {
        const { toRosterStudent } = await import('@/server/attendance');
        const masked = toRosterStudent({ ...ASHA_DOC, secretNote: 'parent is +919876543210' } as any);
        expect(JSON.stringify(masked)).not.toContain('9876543210');
        expect(masked).not.toHaveProperty('secretNote');
        expect(masked).not.toHaveProperty('createdAt');
    });
});
