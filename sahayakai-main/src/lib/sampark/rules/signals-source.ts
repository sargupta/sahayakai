/**
 * Where the rules' CRM signals come from (plan §3.3: REST to pull, CSV as the
 * fallback). A SignalsSource returns a validated CrmSignals plus the records it
 * refused, with reasons — a malformed record is quarantined, never half-used,
 * and a confidential entry that carries note text is refused outright
 * (HpcNoteSchema), so confidential words cannot enter the system.
 *
 * Sources:
 *   static   — an in-memory CrmSignals (tests, demos)
 *   rest     — the CRM's `/v1/hpc/entries`, `/v1/attendance`, `/v1/assessments`,
 *              `/v1/meetings`, `/v1/incidents` (and, if the CRM serves it,
 *              `/v1/fees/dues`; a CRM without it simply has no fee dues)
 *
 * ASSUMPTION flagged for the founder: the wire shapes below are the mock CRM's
 * v1 draft. A real school's ERP will differ; this adapter is the only place
 * that changes.
 */

import { z } from 'zod';

import type { CrmSource } from '@/lib/sampark/ports';

import {
    AssessmentScoreSchema,
    AttendanceMarkSchema,
    FeeDueSchema,
    HpcNoteSchema,
    IncidentSignalSchema,
    MeetingRequestSignalSchema,
    emptySignals,
    type CrmSignals,
} from './signals';

export interface RejectedSignal {
    entity: 'attendance' | 'hpc' | 'assessment' | 'meeting' | 'incident' | 'fee_due';
    id: string | null;
    reason: string;
}

export interface SignalsLoad {
    signals: CrmSignals;
    rejected: RejectedSignal[];
}

export interface SignalsSource {
    load(): Promise<SignalsLoad>;
}

export function createStaticSignalsSource(signals: CrmSignals): SignalsSource {
    return { load: async () => ({ signals, rejected: [] }) };
}

// ── Wire shapes (mock CRM v1 draft) ─────────────────────────────────────────

const WireHpc = z.object({
    id: z.string(),
    studentId: z.string(),
    observedOn: z.string(),
    respondent: z.object({ type: z.string() }),
    sentiment: z.enum(['positive', 'neutral', 'concern']),
    note: z.string().nullable(),
    confidential: z.boolean(),
    reasonCode: z.string().nullable(),
    unit: z.object({ id: z.string() }).nullable(),
    ability: z.string().nullable(),
    rubric: z.object({ level: z.number(), label: z.string() }).nullable(),
});

function reasonOf(err: z.ZodError): string {
    const i = err.issues[0];
    return i ? `${i.path.join('.') || 'record'}: ${i.message}` : 'invalid record';
}

function idOf(raw: unknown): string | null {
    const id = (raw as { id?: unknown })?.id;
    return typeof id === 'string' ? id : null;
}

/** Map and validate raw CRM records into CrmSignals. Pure. */
export function signalsFromWire(wire: {
    hpc: unknown[];
    attendance: unknown[];
    assessments: unknown[];
    meetings: unknown[];
    incidents: unknown[];
    feeDues: unknown[];
}): SignalsLoad {
    const out = emptySignals();
    const rejected: RejectedSignal[] = [];

    for (const raw of wire.hpc) {
        const w = WireHpc.safeParse(raw);
        if (!w.success) {
            rejected.push({ entity: 'hpc', id: idOf(raw), reason: reasonOf(w.error) });
            continue;
        }
        const note = HpcNoteSchema.safeParse({
            id: w.data.id,
            studentId: w.data.studentId,
            observedOn: w.data.observedOn,
            respondentType: w.data.respondent.type,
            sentiment: w.data.sentiment,
            note: w.data.note,
            confidential: w.data.confidential,
            reasonCode: w.data.reasonCode,
            unitId: w.data.unit ? w.data.unit.id : null,
            ability: w.data.ability,
            rubric: w.data.rubric,
        });
        if (note.success) out.hpc.push(note.data);
        else rejected.push({ entity: 'hpc', id: w.data.id, reason: reasonOf(note.error) });
    }
    const simple = <T>(entity: RejectedSignal['entity'], raws: unknown[], schema: z.ZodType<T>, into: T[]) => {
        for (const raw of raws) {
            const p = schema.safeParse(raw);
            if (p.success) into.push(p.data);
            else rejected.push({ entity, id: idOf(raw), reason: reasonOf(p.error as z.ZodError) });
        }
    };
    simple('attendance', wire.attendance, AttendanceMarkSchema, out.attendance);
    simple('assessment', wire.assessments, AssessmentScoreSchema, out.assessments);
    simple('meeting', wire.meetings, MeetingRequestSignalSchema, out.meetings);
    simple('incident', wire.incidents, IncidentSignalSchema, out.incidents);
    simple('fee_due', wire.feeDues, FeeDueSchema, out.feeDues);
    return { signals: out, rejected };
}

/** Pull the signal endpoints from a REST CRM source. A CRM without a fee endpoint has no fee dues. */
export function createRestSignalsSource(crm: CrmSource): SignalsSource {
    return {
        async load() {
            if (!crm.fetchRecords) throw new Error('This CRM source cannot list records');
            const get = (path: string) => crm.fetchRecords!(path);
            const [hpc, attendance, assessments, meetings, incidents] = await Promise.all([
                get('/v1/hpc/entries'),
                get('/v1/attendance'),
                get('/v1/assessments'),
                get('/v1/meetings'),
                get('/v1/incidents'),
            ]);
            let feeDues: unknown[] = [];
            try {
                feeDues = await get('/v1/fees/dues');
            } catch {
                feeDues = []; // not every CRM serves fee dues
            }
            return signalsFromWire({ hpc, attendance, assessments, meetings, incidents, feeDues });
        },
    };
}
