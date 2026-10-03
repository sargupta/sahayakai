/**
 * The dummy school CRM over node:http. A small route table, JSON errors
 * ({ error }), bearer-key auth on /v1/**, and an unauthenticated demo page at /
 * (a local demo tool: bind it to localhost, which is the default).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import type { CrmGuardian, CrmStudent } from './contract/crm-schema';
import { addDays, istDate, istInstant, isValidDate, schoolDaysBetween } from './calendar';
import { encodeCsv, guardiansCsv, studentsCsv } from './csv';
import { renderDemoPage } from './demo-page';
import { consentRows, handleMcpMessage, type JsonRpcRequest } from './mcp';
import { stageForGrade } from './generate';
import { BadRequest, paginate, parsePageQuery } from './pagination';
import {
    CLOSURE_REASONS,
    CommunicationInputSchema,
    EVENT_KINDS,
    GuardianPreferencesInputSchema,
    HPC_ABILITIES,
    HPC_SENTIMENTS,
    HpcEntrySchema,
    IncidentSchema,
    INCIDENT_REASON_CODES,
    MEETING_REASON_CODES,
    MeetingRequestSchema,
    OFFICIAL_RESPONDENTS,
    RESPONDENT_TYPES,
    RsvpInputSchema,
    SchoolEventSchema,
    type AttendanceRecord,
    type Communication,
    type HpcEntry,
    type Incident,
    type MeetingRequest,
    type Rsvp,
    type SchoolEvent,
} from './schemas';
import type { CrmState } from './state';
import { createSaver } from './store';
import { createWebhookSender, type EntityKind, type WebhookSender } from './webhooks';
import type { WebhookEventType } from './schemas';
import type { z } from 'zod';

export const CONSENT_CSV_COLUMNS = ['guardian', 'phone', 'studentAdmissionNo', 'purposeGroup', 'status', 'recordedAt', 'method', 'noticeVersion'] as const;
export const DEFAULT_API_KEY = 'mock-crm-dev-key';
const MAX_BODY_BYTES = 64 * 1024;

export interface AppOptions {
    state: CrmState;
    /** Where mutations are persisted; null keeps everything in memory (tests). */
    statePath: string | null;
    apiKey?: string;
    webhook?: WebhookSender;
    now?: () => Date;
}

export interface CrmApp {
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
    readonly state: CrmState;
    readonly webhook: WebhookSender;
    /** Resolves when every webhook fired so far has settled (tests). */
    flushWebhooks(): Promise<void>;
    /** Resolves when the latest state write has finished. */
    flushSaves(): Promise<void>;
}

class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    const text = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(text);
}

function sendText(res: ServerResponse, status: number, contentType: string, body: string, extra: Record<string, string> = {}): void {
    res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store', ...extra });
    res.end(body);
}

function redirect(res: ServerResponse, location: string): void {
    res.writeHead(303, { location, 'cache-control': 'no-store' });
    res.end();
}

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const buf = chunk as Buffer;
        size += buf.length;
        if (size > MAX_BODY_BYTES) throw new HttpError(413, 'request body too large');
        chunks.push(buf);
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function readJson(req: IncomingMessage): Promise<unknown> {
    const text = await readBody(req);
    if (text.trim() === '') throw new HttpError(400, 'request body must be JSON');
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new HttpError(400, 'request body is not valid JSON');
    }
}

function zodMessage(error: z.ZodError): string {
    return error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; ');
}

function authorised(req: IncomingMessage, apiKey: string): boolean {
    const header = req.headers.authorization ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) return false;
    const given = Buffer.from((m[1] ?? '').trim());
    const expected = Buffer.from(apiKey);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

// ── App ──────────────────────────────────────────────────────────────────────

export function createApp(options: AppOptions): CrmApp {
    const state = options.state;
    const apiKey = options.apiKey ?? DEFAULT_API_KEY;
    const now = options.now ?? (() => new Date());
    const webhook = options.webhook ?? createWebhookSender({ url: null, secret: null });
    const save = createSaver(options.statePath, () => state);
    let lastSave: Promise<void> = Promise.resolve();
    const pending = new Set<Promise<unknown>>();

    const persist = async () => {
        lastSave = save();
        await lastSave;
    };
    const hint = (type: WebhookEventType, kind: EntityKind, id: string) => {
        if (!webhook.enabled) return;
        const p = webhook.send(type, { kind, id }).finally(() => pending.delete(p));
        pending.add(p);
    };

    const studentById = (id: string) => state.students.find((s) => s.id === id);
    const guardianById = (id: string) => state.guardians.find((g) => g.id === id);
    const offDays = () =>
        new Set<string>([
            ...state.school.holidays.map((h) => h.date),
            ...state.events.filter((e) => e.kind === 'closure' && e.status === 'published').map((e) => e.date),
        ]);

    // ── /v1 handlers ─────────────────────────────────────────────────────────

    const listStudents = (params: URLSearchParams) => {
        const q = parsePageQuery(params);
        const records: (CrmStudent | Record<string, unknown>)[] = q.includeMalformed
            ? [...state.students, ...state.malformed.students]
            : state.students;
        return paginate(records, q);
    };
    const listGuardians = (params: URLSearchParams) => {
        const q = parsePageQuery(params);
        const records: (CrmGuardian | Record<string, unknown>)[] = q.includeMalformed
            ? [...state.guardians, ...state.malformed.guardians]
            : state.guardians;
        return paginate(records, q);
    };
    const findWithMalformed = (id: string, list: readonly { id: string }[], malformed: readonly Record<string, unknown>[], params: URLSearchParams) => {
        const hit = list.find((r) => r.id === id);
        if (hit) return hit;
        if (params.get('includeMalformed') === 'true') {
            const bad = malformed.find((r) => r.id === id);
            if (bad) return bad;
        }
        throw new HttpError(404, `no record with id ${id}`);
    };

    const createCommunication = async (req: IncomingMessage) => {
        const parsed = CommunicationInputSchema.safeParse(await readJson(req));
        if (!parsed.success) throw new HttpError(400, zodMessage(parsed.error));
        const input = parsed.data;
        const existing = state.communications.find((c) => c.externalId === input.externalId);
        if (existing) return { status: 200, body: existing };
        if (!guardianById(input.guardianId)) throw new HttpError(422, `unknown guardianId ${input.guardianId}`);
        for (const sid of input.studentIds) if (!studentById(sid)) throw new HttpError(422, `unknown studentId ${sid}`);
        state.counters.communication += 1;
        const record: Communication = { ...input, id: `com_${pad(state.counters.communication, 6)}`, receivedAt: now().toISOString() };
        state.communications.push(record);
        await persist();
        return { status: 201, body: record };
    };

    const upsertRsvp = async (eventId: string, req: IncomingMessage) => {
        const event = state.events.find((e) => e.id === eventId);
        if (!event) throw new HttpError(404, `no event with id ${eventId}`);
        if (!event.rsvpEnabled) throw new HttpError(409, 'this event does not take RSVPs');
        const parsed = RsvpInputSchema.safeParse(await readJson(req));
        if (!parsed.success) throw new HttpError(400, zodMessage(parsed.error));
        const input = parsed.data;
        if (!guardianById(input.guardianId)) throw new HttpError(422, `unknown guardianId ${input.guardianId}`);
        const updatedAt = now().toISOString();
        const existing = state.rsvps.find((r) => r.eventId === eventId && r.guardianId === input.guardianId);
        if (existing) {
            Object.assign(existing, input, { updatedAt });
            await persist();
            return { status: 200, body: existing };
        }
        state.counters.rsvp += 1;
        const record: Rsvp = { ...input, id: `rsvp_${pad(state.counters.rsvp, 6)}`, eventId, updatedAt };
        state.rsvps.push(record);
        await persist();
        return { status: 201, body: record };
    };

    const setGuardianPreferences = async (guardianId: string, req: IncomingMessage) => {
        const guardian = guardianById(guardianId);
        if (!guardian || guardian.deleted) throw new HttpError(404, `no guardian with id ${guardianId}`);
        const parsed = GuardianPreferencesInputSchema.safeParse(await readJson(req));
        if (!parsed.success) throw new HttpError(400, zodMessage(parsed.error));
        if (guardian.doNotContact !== parsed.data.doNotContact) {
            guardian.doNotContact = parsed.data.doNotContact;
            guardian.updatedAt = now().toISOString();
            await persist();
        }
        return guardian;
    };

    const consentCsv = () =>
        encodeCsv([
            [...CONSENT_CSV_COLUMNS],
            ...consentRows(state.guardians).map((r) => CONSENT_CSV_COLUMNS.map((c) => (r[c] === null || r[c] === undefined ? '' : String(r[c])))),
        ]);

    async function handleMcp(method: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (method !== 'POST') {
            res.setHeader('allow', 'POST');
            throw new HttpError(405, 'use POST (this server offers no SSE stream)');
        }
        let message: unknown;
        try {
            message = JSON.parse(await readBody(req));
        } catch (err) {
            if (err instanceof HttpError) throw err;
            return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
        }
        const reply = handleMcpMessage(state, message as JsonRpcRequest);
        if (reply === null) {
            res.writeHead(202, { 'cache-control': 'no-store' });
            res.end();
            return;
        }
        const initialising = (message as JsonRpcRequest)?.method === 'initialize';
        res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            ...(initialising ? { 'mcp-session-id': 'mock-crm-session' } : {}),
        });
        res.end(JSON.stringify(reply));
    }

    async function handleV1(method: string, pathname: string, params: URLSearchParams, req: IncomingMessage, res: ServerResponse): Promise<void> {
        const seg = pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // drop 'v1'
        const [a, b, c] = seg;
        const get = method === 'GET' || method === 'HEAD';

        if (a === 'school' && seg.length === 1 && get) return sendJson(res, 200, state.school);
        if (a === 'students' && seg.length === 1 && get) return sendJson(res, 200, listStudents(params));
        if (a === 'students' && seg.length === 2 && get && b) {
            return sendJson(res, 200, findWithMalformed(b, state.students, state.malformed.students, params));
        }
        if (a === 'guardians' && seg.length === 1 && get) return sendJson(res, 200, listGuardians(params));
        if (a === 'guardians' && seg.length === 2 && get && b) {
            return sendJson(res, 200, findWithMalformed(b, state.guardians, state.malformed.guardians, params));
        }
        if (a === 'guardians' && seg.length === 3 && c === 'preferences' && b) {
            if (method !== 'POST') throw new HttpError(405, 'use POST');
            return sendJson(res, 200, await setGuardianPreferences(b, req));
        }
        if (a === 'export' && seg.length === 2 && get) {
            const includeMalformed = params.get('includeMalformed') === 'true';
            if (b === 'students.csv') {
                const rows = includeMalformed ? [...state.students, ...state.malformed.students] : state.students;
                return sendText(res, 200, 'text/csv; charset=utf-8', studentsCsv(rows), { 'content-disposition': 'attachment; filename="students.csv"' });
            }
            if (b === 'guardians.csv') {
                const rows = includeMalformed ? [...state.guardians, ...state.malformed.guardians] : state.guardians;
                return sendText(res, 200, 'text/csv; charset=utf-8', guardiansCsv(rows), { 'content-disposition': 'attachment; filename="guardians.csv"' });
            }
        }
        if (a === 'consent' && seg.length === 1 && get) return sendJson(res, 200, paginate(consentRows(state.guardians), parsePageQuery(params)));
        if (a === 'export' && seg.length === 2 && b === 'consent.csv' && get) {
            return sendText(res, 200, 'text/csv; charset=utf-8', consentCsv(), { 'content-disposition': 'attachment; filename="consent.csv"' });
        }
        if (a === 'hpc' && b === 'entries' && seg.length === 2 && get) {
            const studentId = params.get('studentId');
            const rows = studentId ? state.hpcEntries.filter((e) => e.studentId === studentId) : state.hpcEntries;
            return sendJson(res, 200, paginate(rows, parsePageQuery(params)));
        }
        if (a === 'attendance' && seg.length === 1 && get) {
            const date = params.get('date');
            if (date !== null && !isValidDate(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');
            const studentId = params.get('studentId');
            const rows = state.attendance.filter((r) => (date === null || r.date === date) && (studentId === null || r.studentId === studentId));
            return sendJson(res, 200, paginate(rows, parsePageQuery(params)));
        }
        if (a === 'assessments' && seg.length === 1 && get) {
            const studentId = params.get('studentId');
            const rows = studentId ? state.assessments.filter((r) => r.studentId === studentId) : state.assessments;
            return sendJson(res, 200, paginate(rows, parsePageQuery(params)));
        }
        if (a === 'events' && seg.length === 1 && get) return sendJson(res, 200, paginate(state.events, parsePageQuery(params)));
        if (a === 'events' && seg.length === 2 && get && b) {
            const event = state.events.find((e) => e.id === b);
            if (!event) throw new HttpError(404, `no event with id ${b}`);
            return sendJson(res, 200, event);
        }
        if (a === 'events' && seg.length === 3 && c === 'rsvps' && b) {
            if (get) {
                if (!state.events.some((e) => e.id === b)) throw new HttpError(404, `no event with id ${b}`);
                return sendJson(res, 200, paginate(state.rsvps.filter((r) => r.eventId === b), parsePageQuery(params)));
            }
            if (method === 'POST') {
                const { status, body } = await upsertRsvp(b, req);
                return sendJson(res, status, body);
            }
            throw new HttpError(405, 'use GET or POST');
        }
        if (a === 'meetings' && seg.length === 1 && get) return sendJson(res, 200, paginate(state.meetings, parsePageQuery(params)));
        if (a === 'incidents' && seg.length === 1 && get) return sendJson(res, 200, paginate(state.incidents, parsePageQuery(params)));
        if (a === 'communications' && seg.length === 1) {
            if (get) return sendJson(res, 200, paginate(state.communications, parsePageQuery(params)));
            if (method === 'POST') {
                const { status, body } = await createCommunication(req);
                return sendJson(res, status, body);
            }
            throw new HttpError(405, 'use GET or POST');
        }
        throw new HttpError(404, 'not found');
    }

    // ── Demo page mutations ──────────────────────────────────────────────────

    const requireStudent = (id: string | null): CrmStudent => {
        const s = id ? studentById(id) : undefined;
        if (!s || s.deleted) throw new BadRequest('choose a student');
        return s;
    };
    const pick = <T extends string>(value: string | null, allowed: readonly T[], label: string): T => {
        if (value && (allowed as readonly string[]).includes(value)) return value as T;
        throw new BadRequest(`choose a ${label}`);
    };
    const nextSchoolDays = (from: string, count: number) => schoolDaysBetween(addDays(from, 1), addDays(from, 20), offDays()).slice(0, count);

    const demoActions: Record<string, (form: URLSearchParams) => Promise<string>> = {
        async hpc(form) {
            const s = requireStudent(form.get('studentId'));
            const type = pick(form.get('respondentType'), RESPONDENT_TYPES, 'respondent type');
            const sentiment = pick(form.get('sentiment'), HPC_SENTIMENTS, 'sentiment');
            const abilityRaw = form.get('ability');
            const ability = abilityRaw ? pick(abilityRaw, HPC_ABILITIES, 'ability') : null;
            const confidential = type === 'nurse' || type === 'counsellor';
            const noteRaw = (form.get('note') ?? '').trim().slice(0, 280);
            const at = now();
            state.counters.hpc += 1;
            const entry: HpcEntry = {
                id: `hpc_${pad(state.counters.hpc, 6)}`,
                studentId: s.id,
                academicYear: state.school.academicYear,
                term: istDate(at) >= '2026-10-01' ? 2 : 1,
                stage: stageForGrade(s.grade),
                grade: s.grade,
                unit: null,
                ability,
                rubric: null,
                respondent: { type, official: (OFFICIAL_RESPONDENTS as readonly string[]).includes(type) },
                sentiment,
                note: confidential || noteRaw === '' ? null : noteRaw,
                confidential,
                reasonCode: type === 'nurse' ? 'sick_bay_visit' : type === 'counsellor' ? 'counselling_session' : null,
                observedOn: istDate(at),
                createdAt: at.toISOString(),
                updatedAt: at.toISOString(),
            };
            const checked = HpcEntrySchema.safeParse(entry);
            if (!checked.success) throw new BadRequest(zodMessage(checked.error));
            state.hpcEntries.push(entry);
            await persist();
            hint('hpc.entry.created', 'hpc_entry', entry.id);
            return `Card observation ${entry.id} added for ${s.fullName}.`;
        },
        async absent(form) {
            const s = requireStudent(form.get('studentId'));
            const at = now();
            const date = istDate(at);
            const id = `att_${date.replace(/-/g, '')}_${s.id}`;
            const record: AttendanceRecord = {
                id,
                studentId: s.id,
                grade: s.grade,
                section: s.section,
                date,
                status: 'absent',
                leaveNote: false,
                markedAt: at.toISOString(),
                updatedAt: at.toISOString(),
            };
            const idx = state.attendance.findIndex((r) => r.id === id);
            if (idx >= 0) state.attendance[idx] = record;
            else state.attendance.push(record);
            await persist();
            hint('attendance.marked', 'attendance', id);
            return `${s.fullName} marked absent for ${date}.`;
        },
        async event(form) {
            const title = (form.get('title') ?? '').trim();
            if (!title) throw new BadRequest('give the event a title');
            const kind = pick(form.get('kind'), EVENT_KINDS.filter((k) => k !== 'closure'), 'event kind');
            const date = form.get('date') ?? '';
            if (!isValidDate(date)) throw new BadRequest('choose a date');
            const audienceRaw = form.get('audience') ?? 'school';
            const m = /^(\d{1,2})([A-Z])$/.exec(audienceRaw);
            const audience: SchoolEvent['audience'] =
                audienceRaw === 'school' ? { kind: 'school' } : m ? { kind: 'sections', sections: [{ grade: Number(m[1]), section: m[2] as string }] } : { kind: 'school' };
            const venueId = form.get('venueId') || null;
            const at = now().toISOString();
            state.counters.event += 1;
            const event: SchoolEvent = {
                id: `evt_${pad(state.counters.event, 4)}`,
                kind,
                title,
                audience,
                date,
                startTime: form.get('startTime') || null,
                endTime: form.get('endTime') || null,
                venueId,
                venueName: venueId ? (VENUES[venueId] ?? venueId) : null,
                closure: null,
                status: 'published',
                rsvpEnabled: form.get('rsvpEnabled') === 'on' || form.get('rsvpEnabled') === 'true',
                publishedAt: at,
                updatedAt: at,
            };
            const checked = SchoolEventSchema.safeParse(event);
            if (!checked.success) throw new BadRequest(zodMessage(checked.error));
            state.events.push(event);
            await persist();
            hint('event.published', 'event', event.id);
            return `Event ${event.id} published: ${title}.`;
        },
        async closure(form) {
            const today = istDate(now());
            const when = form.get('when') ?? 'today';
            const date = when === 'tomorrow' ? addDays(today, 1) : when === 'today' ? today : when;
            if (!isValidDate(date)) throw new BadRequest('choose today, tomorrow or a date');
            const reason = pick(form.get('reason'), CLOSURE_REASONS, 'reason');
            const at = now().toISOString();
            state.counters.event += 1;
            const label: Record<(typeof CLOSURE_REASONS)[number], string> = {
                heavy_rain: 'heavy rain',
                landslide: 'a landslide',
                bandh: 'a bandh',
                other: 'an emergency',
            };
            const event: SchoolEvent = {
                id: `evt_${pad(state.counters.event, 4)}`,
                kind: 'closure',
                title: `School closed on ${date} due to ${label[reason]}`,
                audience: { kind: 'school' },
                date,
                startTime: null,
                endTime: null,
                venueId: null,
                venueName: null,
                closure: { reason, emergency: true, declaredAt: at },
                status: 'published',
                rsvpEnabled: false,
                publishedAt: at,
                updatedAt: at,
            };
            state.events.push(event);
            await persist();
            hint('event.published', 'event', event.id);
            return `Emergency closure declared for ${date} (${event.id}).`;
        },
        async meeting(form) {
            const s = requireStudent(form.get('studentId'));
            const reasonCode = pick(form.get('reasonCode'), MEETING_REASON_CODES, 'reason');
            const requestedByRole = pick(form.get('requestedByRole'), ['class_teacher', 'coordinator', 'principal', 'counsellor', 'parent'] as const, 'role');
            const guardianId = (s.guardians.find((l) => l.isPrimary) ?? s.guardians[0])?.guardianId;
            if (!guardianId) throw new BadRequest('that student has no guardian on file');
            const at = now();
            state.counters.meeting += 1;
            const meeting: MeetingRequest = {
                id: `mtg_${pad(state.counters.meeting, 4)}`,
                studentId: s.id,
                guardianId,
                requestedByRole,
                reasonCode,
                status: 'requested',
                proposedSlots: nextSchoolDays(istDate(at), 2).map((d) => istInstant(d, 15, 0)),
                scheduledFor: null,
                createdAt: at.toISOString(),
                updatedAt: at.toISOString(),
            };
            const checked = MeetingRequestSchema.safeParse(meeting);
            if (!checked.success) throw new BadRequest(zodMessage(checked.error));
            state.meetings.push(meeting);
            await persist();
            hint('meeting.requested', 'meeting', meeting.id);
            return `Meeting request ${meeting.id} created for ${s.fullName}'s guardian.`;
        },
        async incident(form) {
            const s = requireStudent(form.get('studentId'));
            const reasonCode = pick(form.get('reasonCode'), INCIDENT_REASON_CODES, 'reason code');
            const severity = pick(form.get('severity'), ['low', 'medium', 'high'] as const, 'severity');
            const reportedByRole = pick(
                form.get('reportedByRole'),
                ['teacher', 'coordinator', 'principal', 'nurse', 'bus_attendant', 'coach', 'guard'] as const,
                'role',
            );
            const at = now().toISOString();
            state.counters.incident += 1;
            const incident: Incident = {
                id: `inc_${pad(state.counters.incident, 4)}`,
                studentId: s.id,
                occurredAt: at,
                reasonCode,
                severity,
                reportedByRole,
                status: 'open',
                createdAt: at,
                updatedAt: at,
            };
            const checked = IncidentSchema.safeParse(incident);
            if (!checked.success) throw new BadRequest(zodMessage(checked.error));
            state.incidents.push(incident);
            await persist();
            hint('incident.logged', 'incident', incident.id);
            return `Incident ${incident.id} logged (${reasonCode}).`;
        },
        async guardian(form) {
            const id = form.get('guardianId') ?? '';
            const guardian = guardianById(id);
            if (!guardian || guardian.deleted) throw new BadRequest('choose a guardian');
            const doNotContact = form.get('doNotContact') === 'true';
            guardian.doNotContact = doNotContact;
            guardian.updatedAt = now().toISOString();
            await persist();
            hint('guardian.updated', 'guardian', guardian.id);
            return `${guardian.fullName}: do-not-contact is now ${doNotContact ? 'ON' : 'OFF'}.`;
        },
    };

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const method = req.method ?? 'GET';
        const url = new URL(req.url ?? '/', 'http://localhost');
        const { pathname, searchParams } = url;
        try {
            if (pathname === '/healthz' && (method === 'GET' || method === 'HEAD')) {
                return sendJson(res, 200, { ok: true, school: state.school.id });
            }
            if (pathname === '/' && (method === 'GET' || method === 'HEAD')) {
                return sendText(
                    res,
                    200,
                    'text/html; charset=utf-8',
                    renderDemoPage({
                        state,
                        today: istDate(now()),
                        flash: searchParams.get('done'),
                        error: searchParams.get('error'),
                        webhookEnabled: webhook.enabled,
                        deliveries: webhook.recent(),
                        venues: VENUES,
                    }),
                );
            }
            const demo = /^\/demo\/([a-z]+)$/.exec(pathname);
            if (demo) {
                const action = demoActions[demo[1] ?? ''];
                if (!action) throw new HttpError(404, 'not found');
                if (method !== 'POST') throw new HttpError(405, 'use POST');
                const form = new URLSearchParams(await readBody(req));
                try {
                    const message = await action(form);
                    return redirect(res, `/?done=${encodeURIComponent(message)}`);
                } catch (err) {
                    if (err instanceof BadRequest) return redirect(res, `/?error=${encodeURIComponent(err.message)}`);
                    throw err;
                }
            }
            if (pathname === '/v1' || pathname.startsWith('/v1/')) {
                if (!authorised(req, apiKey)) {
                    res.setHeader('www-authenticate', 'Bearer');
                    return sendJson(res, 401, { error: 'unauthorized: send Authorization: Bearer <api key>' });
                }
                return await handleV1(method, pathname, searchParams, req, res);
            }
            if (pathname === '/mcp') {
                if (!authorised(req, apiKey)) {
                    res.setHeader('www-authenticate', 'Bearer');
                    return sendJson(res, 401, { error: 'unauthorized: send Authorization: Bearer <api key>' });
                }
                return await handleMcp(method, req, res);
            }
            throw new HttpError(404, 'not found');
        } catch (err) {
            if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
            if (err instanceof BadRequest) return sendJson(res, 400, { error: err.message });
            console.error('[mock-school-crm] unhandled error', err);
            return sendJson(res, 500, { error: 'internal error' });
        }
    }

    return {
        handle,
        state,
        webhook,
        async flushWebhooks() {
            await Promise.allSettled([...pending]);
        },
        async flushSaves() {
            await lastSave.catch(() => undefined);
        },
    };
}

export const VENUES: Record<string, string> = {
    school_hall: 'School Hall',
    school_ground: 'School Ground',
    library: 'Library',
    classroom: 'Classroom',
};

export function createCrmServer(options: AppOptions): { server: Server; app: CrmApp } {
    const app = createApp(options);
    const server = createServer((req, res) => {
        void app.handle(req, res);
    });
    return { server, app };
}
