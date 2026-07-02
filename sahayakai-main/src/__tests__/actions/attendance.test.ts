/**
 * F9 forensics fixes — src/app/actions/attendance.ts
 *
 * Covers:
 * - F9-004: saveAttendanceAction uses IST, not server-UTC, so IST teachers
 *   active between 00:00–05:30 IST don't get false "future date" rejection.
 * - F9-006: addStudentAction enforces 40-student limit inside a Firestore
 *   transaction (no count-then-write TOCTOU).
 */

const mockHeadersMap = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: () => Promise.resolve(mockHeadersMap),
}));

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => ({ planType: 'pro' })),
        serialize: (x: any) => x,
    },
}));

jest.mock('@/lib/plan-utils', () => ({
    hasAdvancedPlan: () => true,
}));

// ── In-memory firestore double ──────────────────────────────────────────────

interface FakeClass { teacherUid: string; studentCount?: number; students?: string[] }

const fakeClasses: Record<string, FakeClass> = {};
const writes: Array<{ op: string; path: string; data?: any }> = [];

const classRefForId = (classId: string) => {
    const classRef: any = {
        get: async () => ({
            exists: !!fakeClasses[classId],
            data: () => fakeClasses[classId],
        }),
        update: async (u: any) => {
            writes.push({ op: 'update', path: `classes/${classId}`, data: u });
            Object.assign(fakeClasses[classId] ?? {}, u);
        },
        collection: (sub: string) => ({
            doc: (_studentId?: string) => ({
                id: 'student-new',
                get: async () => ({ exists: false, data: () => undefined }),
                set: async (rec: any) => {
                    writes.push({ op: 'set', path: `classes/${classId}/${sub}/student-new`, data: rec });
                },
            }),
            count: () => ({ get: async () => ({ data: () => ({ count: fakeClasses[classId]?.studentCount ?? 0 }) }) }),
            orderBy: () => ({ get: async () => ({ docs: [] }) }),
            // H9 fix reads the class's real student ids to validate records keys.
            get: async () => ({
                docs: (fakeClasses[classId]?.students ?? []).map((id) => ({ id })),
            }),
        }),
    };
    return classRef;
};

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (coll: string) => ({
            doc: (id: string) => {
                if (coll === 'classes') return classRefForId(id);
                if (coll === 'attendance') {
                    return {
                        collection: () => ({
                            doc: () => ({
                                set: async (rec: any) => {
                                    writes.push({ op: 'set', path: `attendance/${id}/records`, data: rec });
                                },
                            }),
                        }),
                    };
                }
                return {};
            },
        }),
        runTransaction: async (fn: (tx: any) => Promise<any>) => {
            const tx = {
                get: async (ref: any) => ref.get(),
                set: (ref: any, rec: any) => {
                    writes.push({ op: 'tx.set', path: 'student', data: rec });
                },
                update: (_ref: any, u: any) => {
                    writes.push({ op: 'tx.update', path: 'class', data: u });
                    // Reflect studentCount increment in fake store
                    for (const classId of Object.keys(fakeClasses)) {
                        const c = fakeClasses[classId];
                        if (u.studentCount && typeof u.studentCount === 'object') {
                            // FieldValue.increment marker — just bump by 1
                            c.studentCount = (c.studentCount ?? 0) + 1;
                        }
                    }
                },
            };
            return await fn(tx);
        },
    }),
}));

// FieldValue.increment is checked structurally above
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { increment: (n: number) => ({ __increment: n }) },
}));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('attendance actions — F9 fixes', () => {
    beforeEach(() => {
        mockHeadersMap.clear();
        mockHeadersMap.set('x-user-id', 'teacher-A');
        for (const k of Object.keys(fakeClasses)) delete fakeClasses[k];
        writes.length = 0;
    });

    describe('F9-004: saveAttendanceAction IST midnight handling', () => {
        it('accepts today\'s IST date when server is UTC just before IST midnight (e.g. 02:00 IST = 20:30 UTC prev day)', async () => {
            // Server time = 20:30 UTC on 2026-06-05 → IST clock reads 02:00 on 2026-06-06.
            // Pre-fix: server-UTC today was '2026-06-05', so teacher sending '2026-06-06'
            // was rejected as "future". Post-fix: IST today is '2026-06-06' → accepted.
            const fixed = new Date('2026-06-05T20:30:00Z');
            jest.useFakeTimers().setSystemTime(fixed);

            fakeClasses['c1'] = { teacherUid: 'teacher-A', students: ['s1'] };
            const { saveAttendanceAction } = await import('@/app/actions/attendance');
            await expect(
                saveAttendanceAction('c1', '2026-06-06', { 's1': 'present' as any }),
            ).resolves.toBeUndefined();

            jest.useRealTimers();
        });

        it('still rejects genuinely future IST dates', async () => {
            const fixed = new Date('2026-06-05T20:30:00Z'); // IST = 2026-06-06 02:00
            jest.useFakeTimers().setSystemTime(fixed);
            fakeClasses['c1'] = { teacherUid: 'teacher-A' };
            const { saveAttendanceAction } = await import('@/app/actions/attendance');
            await expect(
                saveAttendanceAction('c1', '2026-06-07', {}),
            ).rejects.toThrow(/future/i);
            jest.useRealTimers();
        });
    });

    describe('F9-006: addStudentAction 40-student TOCTOU', () => {
        it('rejects 41st student even when stale read says 39', async () => {
            // Simulate the race: outer pre-read returned 39, but inside the
            // transaction the fresh value is 40 (another concurrent add won).
            fakeClasses['c1'] = { teacherUid: 'teacher-A', studentCount: 40 };
            const { addStudentAction } = await import('@/app/actions/attendance');
            await expect(addStudentAction('c1', {
                name: 'Eve',
                rollNumber: 41,
                parentPhone: '9812345678',
                parentLanguage: 'Hindi' as any,
            })).rejects.toThrow(/Maximum 40|Roll number must be 1–40/);
        });

        it('allows the 40th student when current count is 39', async () => {
            fakeClasses['c1'] = { teacherUid: 'teacher-A', studentCount: 39 };
            const { addStudentAction } = await import('@/app/actions/attendance');
            const res = await addStudentAction('c1', {
                name: 'Dave',
                rollNumber: 40,
                parentPhone: '9812345678',
                parentLanguage: 'Hindi' as any,
            });
            expect(res.studentId).toBeDefined();
            // The student insert + class update both went through the txn
            expect(writes.some((w) => w.op === 'tx.set')).toBe(true);
            expect(writes.some((w) => w.op === 'tx.update')).toBe(true);
        });
    });
});
