/** @jest-environment node */
/**
 * One calls view (Sampark + MCP integration brief, Step 1B): teachers' Contact calls
 * from `parent_outreach`, read-only, for the school's Calls screen and Today feed.
 *
 *   - Scoped to the school: teachers are the doc ids of organizations/{orgId}/members,
 *     read in `in` chunks of 30; a record whose teacher is not a member never appears,
 *     even if a query returned it.
 *   - Only deliveryMethod 'twilio_call'; newest first; at most `limit`.
 *   - Malformed and legacy records degrade safely or are skipped, never break the list.
 *   - GET /api/sampark/[orgId]/teacher-calls runs the shared guard (404 dark → 401 → 403).
 *
 * CLASS GATE — "no full phone number or message reaches the browser": every synthetic
 * record carries phone numbers and message text in every field the outreach flow writes,
 * plus fields it does not write yet. The route's response may contain no run of 5+ digits
 * from any planted number and none of the planted text, and each entry's keys must be
 * exactly the allow-listed projection — so a field added later fails here first.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

// ── fake Firestore: organizations (+members) and parent_outreach ────────────
const mockDocs = new Map<string, Record<string, any>>();
const mockInQueries: string[][] = [];
const mockLeakyQuery = { on: false };
function mockSnap(path: string) {
    return { id: path.split('/').pop()!, exists: mockDocs.has(path), data: () => mockDocs.get(path) };
}
function mockChildren(path: string) {
    return [...mockDocs.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'));
}
function mockColl(path: string): any {
    return {
        doc: (id: string) => ({ get: async () => mockSnap(`${path}/${id}`), collection: (c: string) => mockColl(`${path}/${id}/${c}`) }),
        get: async () => ({ docs: mockChildren(path).map(mockSnap) }),
        where: (field: string, op: string, values: string[]) => {
            if (op !== 'in' || values.length > 30) throw new Error(`bad query ${field} ${op} ${values.length}`);
            mockInQueries.push(values);
            return {
                orderBy: (_f: string, _dir: string) => ({
                    limit: (n: number) => ({
                        get: async () => ({
                            docs: mockChildren(path)
                                // a "leaky" query also returns records it should not, to prove the post-filter
                                .filter((k) => mockLeakyQuery.on || values.includes(mockDocs.get(k)![field]))
                                .sort((a, b) => String(mockDocs.get(b)!.createdAt).localeCompare(String(mockDocs.get(a)!.createdAt)))
                                .slice(0, n)
                                .map(mockSnap),
                        }),
                    }),
                }),
            };
        },
    };
}
const mockDb = { collection: (c: string) => mockColl(c) };
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockDb, initializeFirebase: async () => undefined }));

import { NextResponse } from 'next/server';

import { listTeacherCalls, phoneLast4, toTeacherCallEntry } from '@/server/sampark/teacher-calls';
import { mergeCallRows } from '@/components/sampark/call-source';
import { feedRows } from '@/components/sampark/today-cards';
import type { CallLogEntry, RecentCall } from '@/types/sampark';
import { ADMIN, ORG } from './_helpers';

const OTHER_ORG = 'other-school';
const PLANTED_PHONES = ['+919876500720', '+918765400111', '+917654300222', '+916543200333'];
const PLANTED_TEXT = ['Namaste, Ravi has been absent since Monday', 'Mrs Rao spoke to', 'CA_secret_sid', 'teacher private note'];

let seq = 0;
function outreach(teacherUid: string, overrides: Record<string, unknown> = {}) {
    seq += 1;
    const id = `out-${String(seq).padStart(4, '0')}`;
    mockDocs.set(`parent_outreach/${id}`, {
        teacherUid,
        classId: 'class-7b',
        className: 'Class 7B',
        studentId: `stu-${seq}`,
        studentName: 'Synthetic Student',
        parentPhone: PLANTED_PHONES[seq % PLANTED_PHONES.length],
        parentLanguage: 'Hindi',
        reason: 'consecutive_absences',
        teacherNote: PLANTED_TEXT[3],
        generatedMessage: PLANTED_TEXT[0],
        spokenScript: `${PLANTED_TEXT[0]} — call ${PLANTED_PHONES[0]}`,
        deliveryMethod: 'twilio_call',
        callStatus: 'completed',
        callSid: PLANTED_TEXT[2],
        teacherName: PLANTED_TEXT[1],
        transcript: [{ role: 'parent', text: `my other number is ${PLANTED_PHONES[1]}` }],
        callDurationSeconds: 41.6,
        // fields the outreach flow does not write today
        alternatePhone: PLANTED_PHONES[2],
        guardian: { phone: PLANTED_PHONES[3] },
        createdAt: new Date(Date.UTC(2026, 9, 5, 5, 30, seq)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 9, 5, 5, 31, seq)).toISOString(),
        ...overrides,
    });
    return id;
}

beforeEach(() => {
    mockDocs.clear();
    mockInQueries.length = 0;
    mockLeakyQuery.on = false;
    seq = 0;
    process.env.SAMPARK_ENABLED = 'true';
    mockDocs.set(`organizations/${ORG}`, { name: 'Hillview Demo School', adminUserId: ADMIN });
    mockDocs.set(`organizations/${ORG}/members/teacher-a`, { userId: 'teacher-a', role: 'teacher' });
    mockDocs.set(`organizations/${ORG}/members/teacher-b`, { userId: 'teacher-b', role: 'teacher' });
    mockDocs.set(`organizations/${OTHER_ORG}`, { name: 'Other School', adminUserId: 'other-admin' });
    mockDocs.set(`organizations/${OTHER_ORG}/members/teacher-x`, { userId: 'teacher-x', role: 'teacher' });
});

// ── route harness ───────────────────────────────────────────────────────────
const jsonSpy = jest.spyOn(NextResponse, 'json');
type Handler = (req: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>;
async function get(opts: { uid?: string | null; orgId?: string; limit?: string } = {}) {
    const { GET } = (await import('@/app/api/sampark/[orgId]/teacher-calls/route')) as unknown as { GET: Handler };
    const uid = opts.uid === undefined ? ADMIN : opts.uid;
    const sp = new URLSearchParams(opts.limit ? { limit: opts.limit } : {});
    const req = { headers: { get: (k: string) => (k.toLowerCase() === 'x-user-id' ? uid : null) }, nextUrl: { searchParams: sp } };
    jsonSpy.mockClear();
    await GET(req, { params: Promise.resolve({ orgId: opts.orgId ?? ORG }) });
    const last = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    return { status: (last[1] as { status?: number } | undefined)?.status ?? 200, body: last[0] as any };
}

const ENTRY_KEYS = ['className', 'createdAt', 'durationSeconds', 'id', 'outcome', 'phoneLast4', 'reason', 'source'];

describe('scoping and filtering', () => {
    it('lists only the school\'s teachers\' phone calls, newest first, labelled teacher', async () => {
        const a1 = outreach('teacher-a');
        const b1 = outreach('teacher-b', { reason: 'positive_feedback', callStatus: 'no_answer' });
        outreach('teacher-x'); // another school's teacher
        outreach('teacher-a', { deliveryMethod: 'whatsapp_copy', callStatus: 'manual' }); // not a call
        outreach('not-a-member');

        const res = await get();
        expect(res.status).toBe(200);
        expect(res.body.calls.map((c: any) => c.id)).toEqual([b1, a1]);
        expect(res.body.calls[0]).toEqual({
            id: b1, source: 'teacher', createdAt: mockDocs.get(`parent_outreach/${b1}`)!.createdAt, phoneLast4: phoneLast4(mockDocs.get(`parent_outreach/${b1}`)!.parentPhone),
            className: 'Class 7B', reason: 'positive_feedback', outcome: 'no_answer', durationSeconds: 42,
        });
    });

    it('a query that returns another school\'s records still yields only this school\'s teachers', async () => {
        const a1 = outreach('teacher-a');
        outreach('teacher-x');
        outreach('stranger');
        mockLeakyQuery.on = true;
        expect((await listTeacherCalls(ORG, { limit: 100 })).map((c) => c.id)).toEqual([a1]);
    });

    it('reads members in chunks of 30 (Firestore\'s `in` limit) and finds a teacher in the last chunk', async () => {
        for (let i = 0; i < 65; i++) mockDocs.set(`organizations/${ORG}/members/t-${i}`, { userId: `t-${i}`, role: 'teacher' });
        const last = outreach('t-64');
        const calls = await listTeacherCalls(ORG, { limit: 100 });
        expect(mockInQueries.map((q) => q.length)).toEqual([30, 30, 7]);
        expect(calls.map((c) => c.id)).toEqual([last]);
    });

    it('a school with no members has no teacher calls and runs no outreach query', async () => {
        expect(await listTeacherCalls('empty-school', { limit: 100 })).toEqual([]);
        expect(mockInQueries).toHaveLength(0);
    });

    it('honours the limit across chunks', async () => {
        for (let i = 0; i < 5; i++) outreach('teacher-a');
        for (let i = 0; i < 5; i++) outreach('teacher-b');
        const res = await get({ limit: '3' });
        expect(res.body.calls).toHaveLength(3);
        expect(res.body.calls.map((c: any) => c.id)).toEqual(['out-0010', 'out-0009', 'out-0008']);
    });

    it('malformed and legacy records degrade safely or are skipped', () => {
        expect(toTeacherCallEntry('x', null)).toBeNull();
        expect(toTeacherCallEntry('x', { deliveryMethod: 'twilio_call' })).toBeNull(); // no createdAt
        expect(toTeacherCallEntry('x', { deliveryMethod: 'twilio_call', createdAt: 'not a date' })).toBeNull();
        expect(toTeacherCallEntry('x', { deliveryMethod: 'twilio_call', createdAt: '2026-10-05T05:30:00Z', reason: 'debt', callStatus: 'weird', parentPhone: 12345, className: 7, callDurationSeconds: -3 }))
            .toEqual({ id: 'x', source: 'teacher', createdAt: '2026-10-05T05:30:00.000Z', phoneLast4: '', className: null, reason: 'other', outcome: 'unknown', durationSeconds: null });
        expect(phoneLast4('+91 98765-00720')).toBe('0720');
        expect(phoneLast4('12')).toBe('');
    });
});

describe('GET /api/sampark/[orgId]/teacher-calls — guard', () => {
    it('404 when Sampark is switched off, before auth', async () => {
        delete process.env.SAMPARK_ENABLED;
        expect((await get({ uid: null })).status).toBe(404);
    });
    it('401 signed out; 403 for a teacher, another school\'s admin and a stranger; 400 for a bad limit', async () => {
        outreach('teacher-a');
        expect((await get({ uid: null })).status).toBe(401);
        expect((await get({ uid: 'teacher-a' })).status).toBe(403);
        expect((await get({ uid: 'other-admin' })).status).toBe(403);
        expect((await get({ uid: 'stranger' })).status).toBe(403);
        expect((await get({ limit: '0' })).status).toBe(400);
        expect((await get({ limit: '501' })).status).toBe(400);
    });
    it('another school\'s admin asking for this school by id gets 403, and their own school shows only their teacher', async () => {
        const x = outreach('teacher-x');
        outreach('teacher-a');
        expect((await get({ uid: 'other-admin', orgId: ORG })).status).toBe(403);
        expect((await get({ uid: 'other-admin', orgId: OTHER_ORG })).body.calls.map((c: any) => c.id)).toEqual([x]);
    });
});

describe('CLASS GATE: no full phone number or message reaches the browser', () => {
    it('the response carries no 5-digit run of any planted number, none of the planted text, and only allow-listed keys', async () => {
        for (let i = 0; i < 6; i++) outreach(i % 2 ? 'teacher-a' : 'teacher-b', { callStatus: ['initiated', 'completed', 'failed', 'no_answer', 'busy', 'manual'][i] });
        const res = await get();
        expect(res.body.calls).toHaveLength(6);
        for (const entry of res.body.calls) {
            expect(Object.keys(entry).sort()).toEqual(ENTRY_KEYS);
            expect(entry.phoneLast4).toMatch(/^\d{4}$/);
        }
        const wire = JSON.stringify(res.body);
        const digitRuns = wire.replace(/\D+/g, ' ');
        for (const phone of PLANTED_PHONES) {
            const d = phone.replace(/\D/g, '');
            for (let i = 0; i + 5 <= d.length; i++) expect(digitRuns).not.toContain(d.slice(i, i + 5));
        }
        for (const text of [...PLANTED_TEXT, 'Synthetic Student', 'teacher-a', 'teacher-b', 'transcript', 'generatedMessage', 'spokenScript']) {
            expect(wire).not.toContain(text);
        }
    });

    it('the Calls screen and Today feed merge keep each source labelled and add no phone field', () => {
        const teacher = toTeacherCallEntry('t1', { deliveryMethod: 'twilio_call', createdAt: '2026-10-05T06:00:00Z', parentPhone: PLANTED_PHONES[0], className: 'Class 7B', reason: 'poor_performance', callStatus: 'busy' })!;
        const campaign = { id: 'c1', createdAt: '2026-10-05T05:00:00Z', phoneLast4: '0111' } as CallLogEntry;
        const rows = mergeCallRows([campaign], [teacher], 10);
        expect(rows.map((r) => [r.source, r.call.id])).toEqual([['teacher', 't1'], ['campaign', 'c1']]);
        expect(JSON.stringify(rows)).not.toContain('98765');

        const recent = { id: 'r1', createdAt: '2026-10-05T05:00:00Z' } as RecentCall;
        const yesterday = { ...teacher, id: 't0', createdAt: '2026-10-04T06:00:00Z' };
        expect(feedRows([recent], [teacher, yesterday], '2026-10-05').map((r) => [r.source, r.call.id])).toEqual([['teacher', 't1'], ['campaign', 'r1']]);
    });
});
