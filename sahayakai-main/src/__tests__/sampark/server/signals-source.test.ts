/** @jest-environment node */
/**
 * The signals adapter (plan §3.3): the mock CRM's v1 draft wire shapes map into
 * CrmSignals, every record is validated on its own, a confidential entry that
 * carries note text is refused, and a CRM without a fee endpoint has no dues.
 */
import { createRestSource } from '@/lib/sampark/crm/rest-source';
import { createRestSignalsSource, signalsFromWire } from '@/lib/sampark/rules/signals-source';

const hpc = (over: Record<string, unknown> = {}) => ({
    id: 'h1', studentId: 's1', observedOn: '2026-09-28', respondent: { type: 'teacher', official: true }, sentiment: 'concern', note: 'pushed a junior',
    confidential: false, reasonCode: null, unit: { kind: 'subject', id: 'u1', name: 'Maths' }, ability: 'awareness', rubric: { scaleId: 'bpa', level: 2, label: 'Proficient' },
    ...over,
});

describe('signalsFromWire', () => {
    it('maps the mock CRM wire shapes', () => {
        const { signals, rejected } = signalsFromWire({
            hpc: [hpc()],
            attendance: [{ id: 'a1', studentId: 's1', grade: 7, section: 'B', date: '2026-09-28', status: 'absent', leaveNote: false, markedAt: '2026-09-28T04:00:00+05:30', updatedAt: '2026-09-28T04:00:00+05:30' }],
            assessments: [{ studentId: 's1', assessmentId: 'PT1', assessmentName: 'PT1', subjectId: 'm', date: '2026-07-20', maxMarks: 100, marks: null, status: 'absent' }],
            meetings: [{ studentId: 's1', reasonCode: 'attendance', status: 'requested' }],
            incidents: [{ studentId: 's1', reasonCode: 'bullying_reported', severity: 'low', status: 'open' }],
            feeDues: [{ id: 'd1', studentId: 's1', dueDate: '2026-10-05', amountRupees: 12500, status: 'open' }],
        });
        expect(rejected).toEqual([]);
        expect(signals.hpc[0]).toMatchObject({ respondentType: 'teacher', unitId: 'u1', ability: 'awareness', rubric: { level: 2, label: 'Proficient' } });
        expect(signals.assessments[0]).toMatchObject({ marks: null, status: 'absent' }); // a missed test stays null, never zero
        expect(signals.attendance[0]).toMatchObject({ status: 'absent', leaveNote: false });
        expect(signals.feeDues).toHaveLength(1);
    });
    it('quarantines each bad record with a reason and keeps the rest', () => {
        const { signals, rejected } = signalsFromWire({
            hpc: [hpc(), hpc({ id: 'h2', sentiment: 'angry' })],
            attendance: [{ studentId: 's1', date: 'yesterday', status: 'absent', leaveNote: false }],
            assessments: [],
            meetings: [],
            incidents: [],
            feeDues: [{ id: 'd1', studentId: 's1', dueDate: '2026-10-05', amountRupees: -5, status: 'open' }],
        });
        expect(signals.hpc).toHaveLength(1);
        expect(rejected.map((r) => `${r.entity}:${r.id}`).sort()).toEqual(['attendance:null', 'fee_due:d1', 'hpc:h2']);
    });
    it('REFUSES a confidential entry that carries note text, so confidential words never enter', () => {
        const { signals, rejected } = signalsFromWire({
            hpc: [hpc({ id: 'k1', respondent: { type: 'counsellor', official: false }, confidential: true, note: 'parents are separating', reasonCode: 'counselling_session' }), hpc({ id: 'k2', respondent: { type: 'nurse', official: false }, confidential: false, note: 'diabetic', reasonCode: 'sick_bay_visit' })],
            attendance: [], assessments: [], meetings: [], incidents: [], feeDues: [],
        });
        expect(signals.hpc).toEqual([]);
        expect(rejected.map((r) => r.id)).toEqual(['k1', 'k2']);
        expect(JSON.stringify(signals)).not.toMatch(/separating|diabetic/);
    });
});

describe('REST signals source', () => {
    function fetchFor(routes: Record<string, unknown[] | number>): typeof fetch {
        return (async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            const hit = routes[url.pathname];
            if (typeof hit === 'number' || hit === undefined) return new Response('{}', { status: typeof hit === 'number' ? hit : 404 });
            return new Response(JSON.stringify({ data: hit, nextCursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch;
    }
    const base = { baseUrl: 'http://localhost:4700', apiKey: 'k', nodeEnv: 'test' };

    it('pulls the five endpoints, and treats a missing fee endpoint as no dues', async () => {
        const source = createRestSource({ ...base, fetchImpl: fetchFor({ '/v1/hpc/entries': [hpc()], '/v1/attendance': [], '/v1/assessments': [], '/v1/meetings': [], '/v1/incidents': [] }) });
        const { signals, rejected } = await createRestSignalsSource(source).load();
        expect(signals.hpc).toHaveLength(1);
        expect(signals.feeDues).toEqual([]);
        expect(rejected).toEqual([]);
    });
    it('uses the fee endpoint when the CRM serves it', async () => {
        const source = createRestSource({ ...base, fetchImpl: fetchFor({ '/v1/hpc/entries': [], '/v1/attendance': [], '/v1/assessments': [], '/v1/meetings': [], '/v1/incidents': [], '/v1/fees/dues': [{ id: 'd1', studentId: 's1', dueDate: '2026-10-05', amountRupees: 12500, status: 'open' }] }) });
        expect((await createRestSignalsSource(source).load()).signals.feeDues).toHaveLength(1);
    });
    it('a failing core endpoint fails the load (never a silent partial)', async () => {
        const source = createRestSource({ ...base, fetchImpl: fetchFor({ '/v1/hpc/entries': [], '/v1/attendance': 500, '/v1/assessments': [], '/v1/meetings': [], '/v1/incidents': [] }) });
        await expect(createRestSignalsSource(source).load()).rejects.toThrow(/CRM responded 500/);
    });
    it('only /v1/ list paths can be fetched through fetchRecords', async () => {
        const source = createRestSource({ ...base, fetchImpl: fetchFor({}) });
        expect(() => source.fetchRecords!('/admin/secrets')).toThrow(/unexpected CRM path/);
        expect(() => source.fetchRecords!('/v1/../etc')).toThrow(/unexpected CRM path/);
    });
});
