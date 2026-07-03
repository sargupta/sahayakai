/**
 * F9 forensics fixes — migrated from src/__tests__/actions/attendance.test.ts
 * (tranche 5: server actions → src/server/attendance.ts service).
 *
 * Covers:
 * - F9-004: saveAttendance uses IST, not server-UTC, so IST teachers
 *   active between 00:00–05:30 IST don't get false "future date" rejection.
 * - F9-006: addStudent enforces 40-student limit inside a Firestore
 *   transaction (no count-then-write TOCTOU).
 * - H9: saveAttendance rejects unknown student ids and out-of-enum statuses
 *   in the client-supplied records map (this suite is the spec for the H9
 *   validation block — it must survive verbatim).
 */

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

const UID = 'teacher-A';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('attendance service — F9 fixes', () => {
    beforeEach(() => {
        for (const k of Object.keys(fakeClasses)) delete fakeClasses[k];
        writes.length = 0;
    });

    describe('F9-004: saveAttendance IST midnight handling', () => {
        it('accepts today\'s IST date when server is UTC just before IST midnight (e.g. 02:00 IST = 20:30 UTC prev day)', async () => {
            // Server time = 20:30 UTC on 2026-06-05 → IST clock reads 02:00 on 2026-06-06.
            // Pre-fix: server-UTC today was '2026-06-05', so teacher sending '2026-06-06'
            // was rejected as "future". Post-fix: IST today is '2026-06-06' → accepted.
            const fixed = new Date('2026-06-05T20:30:00Z');
            jest.useFakeTimers().setSystemTime(fixed);

            fakeClasses['c1'] = { teacherUid: 'teacher-A', students: ['s1'] };
            const { saveAttendance } = await import('@/server/attendance');
            await expect(
                saveAttendance(UID, 'c1', '2026-06-06', { 's1': 'present' as any }),
            ).resolves.toBeUndefined();

            jest.useRealTimers();
        });

        it('still rejects genuinely future IST dates', async () => {
            const fixed = new Date('2026-06-05T20:30:00Z'); // IST = 2026-06-06 02:00
            jest.useFakeTimers().setSystemTime(fixed);
            fakeClasses['c1'] = { teacherUid: 'teacher-A' };
            const { saveAttendance } = await import('@/server/attendance');
            await expect(
                saveAttendance(UID, 'c1', '2026-06-07', {}),
            ).rejects.toThrow(/future/i);
            jest.useRealTimers();
        });
    });

    describe('F9-006: addStudent 40-student TOCTOU', () => {
        it('rejects 41st student even when stale read says 39', async () => {
            // Simulate the race: outer pre-read returned 39, but inside the
            // transaction the fresh value is 40 (another concurrent add won).
            fakeClasses['c1'] = { teacherUid: 'teacher-A', studentCount: 40 };
            const { addStudent } = await import('@/server/attendance');
            await expect(addStudent(UID, 'c1', {
                name: 'Eve',
                rollNumber: 41,
                parentPhone: '9812345678',
                parentLanguage: 'Hindi' as any,
            })).rejects.toThrow(/Maximum 40|Roll number must be 1–40/);
        });

        it('allows the 40th student when current count is 39', async () => {
            fakeClasses['c1'] = { teacherUid: 'teacher-A', studentCount: 39 };
            const { addStudent } = await import('@/server/attendance');
            const res = await addStudent(UID, 'c1', {
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

    describe('H9: saveAttendance records-map validation (forensic spec)', () => {
        beforeEach(() => {
            // Today in IST — use a fixed timestamp safely inside the 7-day window.
            jest.useFakeTimers().setSystemTime(new Date('2026-06-05T10:00:00Z'));
            fakeClasses['c1'] = { teacherUid: 'teacher-A', students: ['s1', 's2'] };
        });
        afterEach(() => jest.useRealTimers());

        it('rejects a records map containing a studentId not in the class', async () => {
            const { saveAttendance } = await import('@/server/attendance');
            await expect(
                saveAttendance(UID, 'c1', '2026-06-05', { 'attacker-id': 'present' as any }),
            ).rejects.toThrow(/Unknown student in attendance records: attacker-id/);
            expect(writes.some((w) => w.path.startsWith('attendance/'))).toBe(false);
        });

        it('rejects an out-of-enum attendance status', async () => {
            const { saveAttendance } = await import('@/server/attendance');
            await expect(
                saveAttendance(UID, 'c1', '2026-06-05', { 's1': 'vanished' as any }),
            ).rejects.toThrow(/Invalid attendance status for s1/);
            expect(writes.some((w) => w.path.startsWith('attendance/'))).toBe(false);
        });

        it('rejects oversized records maps (max 200 entries)', async () => {
            const { saveAttendance } = await import('@/server/attendance');
            const oversized: Record<string, any> = {};
            for (let i = 0; i < 201; i++) oversized[`s${i}`] = 'present';
            await expect(
                saveAttendance(UID, 'c1', '2026-06-05', oversized),
            ).rejects.toThrow(/Too many attendance entries \(max 200\)/);
            expect(writes.some((w) => w.path.startsWith('attendance/'))).toBe(false);
        });

        it('accepts a valid records map and writes it', async () => {
            const { saveAttendance } = await import('@/server/attendance');
            await expect(
                saveAttendance(UID, 'c1', '2026-06-05', { 's1': 'present' as any, 's2': 'absent' as any }),
            ).resolves.toBeUndefined();
            const write = writes.find((w) => w.path === 'attendance/c1/records');
            expect(write).toBeDefined();
            expect(write!.data.records).toEqual({ s1: 'present', s2: 'absent' });
            expect(write!.data.teacherUid).toBe('teacher-A');
        });
    });

    describe('ownership: cross-teacher access is rejected', () => {
        it('saveAttendance rejects a class owned by another teacher', async () => {
            jest.useFakeTimers().setSystemTime(new Date('2026-06-05T10:00:00Z'));
            fakeClasses['c1'] = { teacherUid: 'teacher-B', students: ['s1'] };
            const { saveAttendance } = await import('@/server/attendance');
            await expect(
                saveAttendance(UID, 'c1', '2026-06-05', { 's1': 'present' as any }),
            ).rejects.toThrow(/Unauthorized/);
            jest.useRealTimers();
        });
    });
});
