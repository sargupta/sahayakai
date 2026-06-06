/**
 * F9 forensics fixes — POST /api/attendance/outreach
 *
 * Covers:
 * - F9-001: cross-teacher ownership bypass — teacher B cannot create an
 *   outreach for teacher A's student (must 403); caller-supplied parentPhone
 *   is ignored in favour of the student record's stored phone.
 * - F9-003: per-(teacher, student) 5-minute dedup window returns 429.
 */

import { NextResponse } from 'next/server';
const jsonSpy = jest.spyOn(NextResponse, 'json');
function lastJsonCall(): { body: any; status: number } {
    const calls = jsonSpy.mock.calls;
    const lastCall = calls[calls.length - 1];
    const body = lastCall[0];
    const opts = lastCall[1] as { status?: number } | undefined;
    return { body, status: opts?.status ?? 200 };
}

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => ({ planType: 'pro' })),
    },
}));

jest.mock('@/lib/plan-utils', () => ({
    hasAdvancedPlan: () => true,
}));

// In-memory fake Firestore — just enough for the route's reads/writes.
type DocMap = Record<string, Record<string, any>>;
const fakeStore: {
    classes: DocMap;
    students: Record<string /* classId */, DocMap>;
    outreach: DocMap & { _writes: any[] };
} = {
    classes: {},
    students: {},
    outreach: Object.assign({}, { _writes: [] as any[] }),
};

let dedupReturnsRecent = false;
let lastOutreachId = '';

function makeDocRef(coll: string, id?: string) {
    const docId = id ?? `doc_${Math.random().toString(36).slice(2, 9)}`;
    if (coll === 'parent_outreach') lastOutreachId = docId;
    return {
        id: docId,
        get: async () => {
            if (coll === 'classes') {
                const data = fakeStore.classes[docId];
                return { exists: !!data, data: () => data, id: docId };
            }
            return { exists: false, data: () => undefined, id: docId };
        },
        set: async (rec: any) => {
            if (coll === 'parent_outreach') {
                fakeStore.outreach[docId] = rec;
                fakeStore.outreach._writes.push({ id: docId, rec });
            }
        },
        collection: (sub: string) => {
            // classes/{id}/students/{studentId}
            return {
                doc: (studentId: string) => ({
                    id: studentId,
                    get: async () => {
                        const map = fakeStore.students[docId] ?? {};
                        const data = map[studentId];
                        return { exists: !!data, data: () => data, id: studentId };
                    },
                }),
            };
        },
    };
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (coll: string) => ({
            doc: (id?: string) => makeDocRef(coll, id),
            where: () => {
                // chainable query — only used by the dedup check
                const q: any = {
                    where: () => q,
                    limit: () => q,
                    get: async () => ({
                        empty: !dedupReturnsRecent,
                        docs: dedupReturnsRecent
                            ? [{ data: () => ({ createdAt: new Date(Date.now() - 60_000).toISOString() }) }]
                            : [],
                    }),
                };
                return q;
            },
        }),
    }),
}));

function makeRequest(body: any, userId: string | null = 'teacher-A') {
    const headers = new Map<string, string>();
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as Request;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/attendance/outreach — F9 security/dedup fixes', () => {
    let POST: (req: Request) => Promise<Response>;

    beforeAll(async () => {
        const mod = await import('@/app/api/attendance/outreach/route');
        POST = mod.POST as any;
    });

    beforeEach(() => {
        fakeStore.classes = {
            'classA': { teacherUid: 'teacher-A' },
            'classB': { teacherUid: 'teacher-B' },
        };
        fakeStore.students = {
            'classA': {
                's-alice': { name: 'Alice', parentPhone: '+919812345678', parentLanguage: 'Hindi' },
            },
            'classB': {
                's-bob': { name: 'Bob', parentPhone: '+919800000000', parentLanguage: 'Hindi' },
            },
        };
        fakeStore.outreach = Object.assign({}, { _writes: [] as any[] });
        dedupReturnsRecent = false;
        lastOutreachId = '';
    });

    it('F9-001: teacher B cannot create outreach for teacher A\'s student (403)', async () => {
        const res = await POST(makeRequest({
            classId: 'classA',           // owned by teacher-A
            className: 'Hijack 101',
            studentId: 's-alice',
            studentName: 'Alice',
            parentPhone: '+919999999999', // attacker-supplied — must be ignored
            parentLanguage: 'Hindi',
            reason: 'absence',
            generatedMessage: 'msg',
            deliveryMethod: 'twilio_call',
        }, 'teacher-B'));

        expect(res.status).toBe(403);
        expect(fakeStore.outreach._writes).toHaveLength(0);
    });

    it('F9-001: caller-supplied parentPhone is ignored — stored phone is used', async () => {
        const res = await POST(makeRequest({
            classId: 'classA',
            className: 'Class A',
            studentId: 's-alice',
            studentName: 'Alice',
            parentPhone: '+919999999999', // attacker-controlled
            parentLanguage: 'Hindi',
            reason: 'absence',
            generatedMessage: 'msg',
            deliveryMethod: 'twilio_call',
        }, 'teacher-A'));

        expect(res.status).toBe(200);
        expect(fakeStore.outreach._writes).toHaveLength(1);
        expect(fakeStore.outreach._writes[0].rec.parentPhone).toBe('+919812345678'); // server-stored
    });

    it('F9-003: second outreach within 5 minutes returns 429', async () => {
        dedupReturnsRecent = true;
        const res = await POST(makeRequest({
            classId: 'classA',
            className: 'Class A',
            studentId: 's-alice',
            studentName: 'Alice',
            parentLanguage: 'Hindi',
            reason: 'absence',
            generatedMessage: 'msg',
            deliveryMethod: 'twilio_call',
        }, 'teacher-A'));

        expect(res.status).toBe(429);
        const { body, status } = lastJsonCall();
        expect(status).toBe(429);
        expect(body.retryAfterSeconds).toBeGreaterThan(0);
        expect(fakeStore.outreach._writes).toHaveLength(0);
    });

    it('rejects when supplied classId does not exist', async () => {
        const res = await POST(makeRequest({
            classId: 'classDOES_NOT_EXIST',
            className: 'X',
            studentId: 's-alice',
            studentName: 'Alice',
            parentLanguage: 'Hindi',
            reason: 'absence',
            generatedMessage: 'msg',
            deliveryMethod: 'twilio_call',
        }, 'teacher-A'));

        expect(res.status).toBe(404);
    });
});
