/**
 * GET /api/attendance/classes/[classId]/summaries — the wire contract.
 *
 * Splitting `consecutiveAbsences` into `currentAbsenceStreak` /
 * `longestAbsenceStreak` corrected the meaning of the number, and this route
 * returns `getStudentSummaries()` straight out to JSON, so the rename went out
 * on the wire too. The Flutter client in this repo still reads the old key, and
 * reads it nullably:
 *
 *     consecutiveAbsences: json['consecutiveAbsences'] as num?   // DTO
 *     consecutiveAbsences: consecutiveAbsences?.toInt() ?? 0     // toDomain
 *
 * So it did not throw. It decoded 0 for every student, and three live surfaces
 * went quiet with no error anywhere to say why: the month screen's absence
 * banner (`> 1`), the notifications feed's attendance lane
 * (`< kAbsenceRunThreshold` → skip), and the count that lane renders. The Dart
 * tests stayed green because their harness builds its own fixture JSON that
 * still contains the key.
 *
 * That is the class of bug this suite exists for: a server-side rename that is
 * invisible to every test on both sides because the client's decode is
 * tolerant. The assertions below therefore check the SERIALIZED body, and
 * re-run the three Dart predicates against it.
 *
 * The alias is pinned to `currentAbsenceStreak`, never `longestAbsenceStreak`.
 * Every consumer of this key speaks in the present tense, so repointing it at
 * the month's high-water mark would put the original "we told a parent their
 * child is absent right now" bug back on mobile while the web app looked fixed.
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
        serialize: (x: unknown) => x,
    },
}));

jest.mock('@/lib/plan-utils', () => ({
    hasAdvancedPlan: () => true,
}));

jest.mock('@/lib/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ── In-memory firestore double ──────────────────────────────────────────────

interface FakeStudent { id: string; name: string; rollNumber: number }

const UID = 'teacher-A';
const CLASS_ID = 'c1';

let fakeStudents: FakeStudent[] = [];
/** date (YYYY-MM-DD) → studentId → status */
let fakeRecords: Record<string, Record<string, string>> = {};

const snapOf = (docs: Array<{ id: string; data: () => unknown }>) => ({ docs });

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (coll: string) => ({
            doc: (id: string) => {
                if (coll === 'classes') {
                    return {
                        get: async () => ({ exists: id === CLASS_ID, data: () => ({ teacherUid: UID }) }),
                        collection: () => ({
                            orderBy: () => ({
                                get: async () => snapOf(
                                    [...fakeStudents]
                                        .sort((a, b) => a.rollNumber - b.rollNumber)
                                        .map((s) => ({ id: s.id, data: () => ({ name: s.name, rollNumber: s.rollNumber }) })),
                                ),
                            }),
                        }),
                    };
                }
                if (coll === 'attendance') {
                    const bounds: Array<[string, string]> = [];
                    const query = {
                        where: (_field: string, op: string, value: string) => {
                            bounds.push([op, value]);
                            return query;
                        },
                        get: async () => {
                            const lo = bounds.find(([op]) => op === '>=')?.[1] ?? '';
                            const hi = bounds.find(([op]) => op === '<')?.[1] ?? '9999-99-99';
                            return snapOf(
                                Object.keys(fakeRecords)
                                    .filter((date) => date >= lo && date < hi)
                                    .map((date) => ({ id: date, data: () => ({ date, records: fakeRecords[date] }) })),
                            );
                        },
                    };
                    return { collection: () => query };
                }
                return {};
            },
        }),
    }),
}));

// ── Fixture ─────────────────────────────────────────────────────────────────
//
// The same June 2026 roster the streak-semantics suite uses, so the two suites
// cannot drift: the point of these students is that current and longest
// DISAGREE, which is what makes a mis-pointed alias visible.

const SCHOOL_DAYS = [
    '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
    '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
];

/** 'A' = absent, 'P' = present, 'L' = late — one character per school day. */
const ROSTER: Array<{ id: string; name: string; rollNumber: number; pattern: string }> = [
    // Back in class after an early run. current 0, longest 3.
    { id: 's1', name: 'Asha',    rollNumber: 1, pattern: 'AAAPPPPPPP' },
    // On a live run, but a longer one already healed. current 2, longest 4.
    { id: 's2', name: 'Bikram',  rollNumber: 2, pattern: 'AAAAPPPPAA' },
    // Never absent. Both 0.
    { id: 's3', name: 'Chandan', rollNumber: 3, pattern: 'PPPPPPPPPP' },
    // Absent throughout — the one student where the two numbers agree, and the
    // only one the notifications lane should raise. current 10, longest 10.
    { id: 's4', name: 'Dipa',    rollNumber: 4, pattern: 'AAAAAAAAAA' },
    // A late day breaks the run. current 0, longest 2.
    { id: 's5', name: 'Esha',    rollNumber: 5, pattern: 'AAPPPPPPPL' },
];

const STATUS: Record<string, string> = { A: 'absent', P: 'present', L: 'late' };

function loadFixture() {
    fakeStudents = ROSTER.map(({ id, name, rollNumber }) => ({ id, name, rollNumber }));
    fakeRecords = {};
    SCHOOL_DAYS.forEach((date, i) => {
        fakeRecords[date] = {};
        for (const student of ROSTER) {
            fakeRecords[date][student.id] = STATUS[student.pattern[i]];
        }
    });
}

function makeRequest(opts: { userId?: string | null; url?: string } = {}) {
    const headers = new Map<string, string>();
    if (opts.userId) headers.set('x-user-id', opts.userId);
    return {
        url: opts.url ?? `http://localhost/api/attendance/classes/${CLASS_ID}/summaries?year=2026&month=6`,
        json: async () => ({}),
        headers: { get: (key: string) => headers.get(key) ?? null },
    } as unknown as import('next/server').NextRequest;
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

async function getSummariesBody(): Promise<any[]> {
    const { GET } = await import('@/app/api/attendance/classes/[classId]/summaries/route');
    const res = await GET(makeRequest({ userId: UID }), ctx({ classId: CLASS_ID }));
    expect(res.status).toBe(200);
    return lastJsonBody();
}

const byName = (rows: Array<{ studentName: string }>, name: string) =>
    rows.find((r) => r.studentName === name)!;

beforeEach(() => {
    jest.clearAllMocks();
    loadFixture();
});

// ── The alias exists, and points at the present-tense number ────────────────

describe('summaries wire shape — deprecated consecutiveAbsences alias', () => {
    it('still publishes consecutiveAbsences for every student', async () => {
        const body = await getSummariesBody();

        expect(body).toHaveLength(ROSTER.length);
        for (const row of body) {
            expect(row).toHaveProperty('consecutiveAbsences');
            expect(typeof row.consecutiveAbsences).toBe('number');
        }
        // The regression was the key going missing from the serialized payload,
        // so assert against the JSON text, not just the object.
        expect(JSON.stringify(body)).toContain('"consecutiveAbsences"');
    });

    it('pins the alias to currentAbsenceStreak, row for row', async () => {
        const body = await getSummariesBody();

        for (const row of body) {
            expect(row.consecutiveAbsences).toBe(row.currentAbsenceStreak);
        }
    });

    it('does NOT publish the month high-water mark under the old name', async () => {
        const body = await getSummariesBody();

        // Asha, Bikram and Esha are the students whose two streaks differ. If a
        // future cleanup repoints the alias at longestAbsenceStreak, all three
        // fail here — a fixture where the numbers happened to agree would let
        // that through silently, which is why the roster is built this way.
        for (const name of ['Asha', 'Bikram', 'Esha']) {
            const row = byName(body, name);
            expect(row.currentAbsenceStreak).not.toBe(row.longestAbsenceStreak);
            expect(row.consecutiveAbsences).not.toBe(row.longestAbsenceStreak);
        }

        expect(byName(body, 'Asha').consecutiveAbsences).toBe(0);    // longest 3
        expect(byName(body, 'Bikram').consecutiveAbsences).toBe(2);  // longest 4
        expect(byName(body, 'Esha').consecutiveAbsences).toBe(0);    // longest 2
    });

    it('keeps both new fields on the wire alongside the alias', async () => {
        const body = await getSummariesBody();
        const asha = byName(body, 'Asha');

        // The alias is additive. Clients already migrated to the new names must
        // keep working, so dropping either of these is also a wire break.
        expect(asha.currentAbsenceStreak).toBe(0);
        expect(asha.longestAbsenceStreak).toBe(3);
    });

    it('leaves the rest of the row untouched', async () => {
        const body = await getSummariesBody();

        expect(byName(body, 'Asha')).toEqual({
            studentId: 's1',
            studentName: 'Asha',
            rollNumber: 1,
            totalDays: 10,
            presentDays: 7,
            absentDays: 3,
            lateDays: 0,
            attendanceRate: 70,
            currentAbsenceStreak: 0,
            longestAbsenceStreak: 3,
            consecutiveAbsences: 0,
        });
    });
});

// ── The three Flutter surfaces the missing key killed ───────────────────────
//
// Re-run of the Dart predicates against the real serialized body. `decodeDart`
// reproduces attendance_dtos.dart exactly — nullable read, `?? 0` — so if the
// key disappears again these read 0 and the expectations below fail, which is
// the failure the Dart suite cannot produce for itself.

/** attendance_dtos.dart:499 + :524 */
const decodeDart = (row: any): number => (row['consecutiveAbsences'] as number | undefined) ?? 0;

/** teacher_notification.dart:49 */
const kAbsenceRunThreshold = 3;

describe('Flutter month screen decodes a live number, not a silent 0', () => {
    it('renders the absence banner for the students on a run (> 1)', async () => {
        const body = await getSummariesBody();

        // attendance_month_screen.dart:399
        const banner = body.filter((row) => decodeDart(row) > 1).map((row) => row.studentName).sort();
        expect(banner).toEqual(['Bikram', 'Dipa']);
    });

    it('keeps the notifications feed attendance lane alive', async () => {
        const body = await getSummariesBody();

        // attendance_month_screen.dart:207 — `continue` below the threshold.
        const raised = body
            .filter((row) => decodeDart(row) >= kAbsenceRunThreshold)
            .map((row) => ({ label: row.studentName, count: decodeDart(row) }));

        // attendance_month_screen.dart:218 — the count the row renders.
        expect(raised).toEqual([{ label: 'Dipa', count: 10 }]);
    });

    it('does not raise a notification for a student who has come back', async () => {
        const body = await getSummariesBody();

        // Asha's longest run is 3 — exactly the threshold. She is in class, so
        // the lane must stay silent for her. This is the assertion that fails
        // if the alias is ever repointed at longestAbsenceStreak.
        expect(decodeDart(byName(body, 'Asha'))).toBe(0);
        expect(decodeDart(byName(body, 'Asha')) >= kAbsenceRunThreshold).toBe(false);
    });
});

// ── Source-level guard on the Dart harness ──────────────────────────────────
//
// The Dart tests stayed green through this regression because their harness
// hand-builds the fixture JSON instead of recording a real response. That is
// fine as long as the two shapes are kept in step, so pin the harness key to
// the key this route actually emits.

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const HARNESS = resolve(
    __dirname, '../../../../../',
    'sahayakai-flutter/test/features/attendance/attendance_harness.dart',
);

describe('the Dart fixture harness and this route agree on the shape', () => {
    it('fakes only keys the route actually emits', async () => {
        if (!existsSync(HARNESS)) return;   // flutter app not present in this checkout

        const body = await getSummariesBody();
        const source = readFileSync(HARNESS, 'utf8');

        const block = source.match(
            /Map<String, dynamic> summaryJson\([\s\S]*?\}\) => <String, dynamic>\{([\s\S]*?)\n\};/,
        );
        // If the builder is renamed or restructured this guard would quietly
        // stop guarding, so treat a miss as a failure, not a skip.
        expect(block).not.toBeNull();

        const harnessKeys = [...block![1].matchAll(/'([A-Za-z0-9_]+)':/g)].map((m) => m[1]);
        expect(harnessKeys.length).toBeGreaterThan(0);

        // The gate for the whole class of bug, not just this field: any summary
        // key the server renames or drops leaves the harness faking a key that
        // no longer exists, and the Dart suite keeps passing against a shape
        // production never sends. Catch it here instead.
        const served = Object.keys(body[0]);
        expect(harnessKeys.filter((k) => !served.includes(k))).toEqual([]);
        expect(harnessKeys).toContain('consecutiveAbsences');
    });
});
