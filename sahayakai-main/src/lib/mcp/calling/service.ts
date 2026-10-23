import 'server-only';
import type { CallingWindowVerdict } from '@/lib/calling-hours';
import { toRosterStudent } from '@/server/attendance';
import type { Student } from '@/types/attendance';
import { McpCapabilityError } from '../errors';
import type { McpPrincipal } from '../auth';
import type { InitiateParentCallInput, ListParentContactsInput, ParentCallResult, ParentContactsResult } from './schema';

/**
 * Adapter between the public Calling MCP and Sahayak's EXISTING attendance
 * "Contact" flow. It drives the three existing route handlers in the same
 * order as the app's ContactParentModal.handleCall:
 *
 *   POST /api/ai/parent-message   (message + spoken script; teacher plan quota)
 *   POST /api/attendance/outreach (ownership, plan, stored phone, 5-min dedup → parent_outreach)
 *   POST /api/attendance/call     (quiet hours, ownership, provider switch, test-override numbers)
 *
 * Identity: an MCP key belongs to an ORGANISATION, the existing routes act for
 * a TEACHER. The teacher is never taken from the client: it is the class's own
 * `teacherUid`, and only if that teacher is a member of the key's organisation
 * (`organizations/{orgId}/members/{teacherUid}`). Every existing per-teacher
 * check then runs unchanged, as that teacher.
 */

type Doc = { exists: boolean; id?: string; data(): Record<string, any> | undefined };
export interface CallingDb {
    collection(name: string): {
        doc(id: string): {
            get(): Promise<Doc>;
            collection(name: string): {
                doc(id: string): { get(): Promise<Doc> };
                get(): Promise<{ docs: Array<Doc & { id: string }> }>;
                orderBy?(field: string, dir: 'asc' | 'desc'): { get(): Promise<{ docs: Array<Doc & { id: string }> }> };
            };
        };
        where(field: string, op: 'in' | '==', value: unknown): { get(): Promise<{ docs: Array<Doc & { id: string }> }> };
    };
}

/** A Next.js route handler: (Request) → Response. */
export type RouteHandler = (request: Request) => Promise<Response>;

export interface CallingServiceDeps {
    getDb: () => Promise<CallingDb>;
    routes: { parentMessage: RouteHandler; outreach: RouteHandler; call: RouteHandler };
    /**
     * Public base URL of this Sahayak deployment, used by the call route to
     * build the provider's callback (TwiML / answer / status) URLs. From server
     * config only — never from the MCP request, or a spoofed Host header could
     * point the phone provider at an attacker's server.
     */
    callbackBaseUrl: string | null;
    checkCallingWindow: () => CallingWindowVerdict;
}

const NOT_FOUND = 'No such class or student for this API key.';

async function authorizeClass(db: CallingDb, orgId: string, classId: string) {
    const cls = await db.collection('classes').doc(classId).get();
    const data = cls.exists ? cls.data() : undefined;
    const teacherUid = typeof data?.teacherUid === 'string' ? data.teacherUid : '';
    if (!data || !teacherUid) throw new McpCapabilityError('not_found', NOT_FOUND);
    const member = await db.collection('organizations').doc(orgId).collection('members').doc(teacherUid).get();
    // Same message as "missing" so a key cannot probe other schools' class ids.
    if (!member.exists) throw new McpCapabilityError('not_found', NOT_FOUND);
    return { teacherUid, cls: data };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

// ── list_parent_contacts ────────────────────────────────────────────────────

const MAX_CLASSES = 50;

export async function listParentContacts(
    input: ListParentContactsInput,
    principal: McpPrincipal,
    deps: Pick<CallingServiceDeps, 'getDb'>,
): Promise<ParentContactsResult> {
    const db = await deps.getDb();
    let classDocs: Array<{ id: string; data: Record<string, any> }>;
    if (input.class_id) {
        const { cls } = await authorizeClass(db, principal.orgId, input.class_id);
        classDocs = [{ id: input.class_id, data: cls }];
    } else {
        const members = await db.collection('organizations').doc(principal.orgId).collection('members').get();
        const teacherUids = members.docs.map((d) => d.id).filter(Boolean);
        classDocs = [];
        for (let i = 0; i < teacherUids.length && classDocs.length < MAX_CLASSES; i += 30) {
            const snap = await db.collection('classes').where('teacherUid', 'in', teacherUids.slice(i, i + 30)).get();
            classDocs.push(...snap.docs.map((d) => ({ id: d.id, data: d.data() ?? {} })));
        }
        classDocs = classDocs.slice(0, MAX_CLASSES);
    }

    const classes = await Promise.all(classDocs.map(async ({ id, data }) => {
        const studentsRef = db.collection('classes').doc(id).collection('students');
        const snap = studentsRef.orderBy ? await studentsRef.orderBy('rollNumber', 'asc').get() : await studentsRef.get();
        // Masked projection shared with the app's roster endpoint: the full phone never leaves this process.
        const students = snap.docs.map((d) => toRosterStudent({ id: d.id, ...(d.data() ?? {}) } as Student)).map((s) => ({
            student_id: s.id,
            name: s.name,
            roll_number: typeof s.rollNumber === 'number' ? s.rollNumber : null,
            parent_language: s.parentLanguage ?? null,
            parent_reachable: s.hasParentPhone,
            parent_phone_last4: s.parentPhoneLast4,
        }));
        return { class_id: id, name: str(data.name) ?? 'Class', subject: str(data.subject), grade: str(data.gradeLevel), students };
    }));
    return { classes };
}

// ── initiate_parent_call ────────────────────────────────────────────────────

function internalRequest(base: string, path: string, teacherUid: string, plan: string, body: unknown): Request {
    const url = new URL(path, base);
    return new Request(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            host: url.host,
            'x-user-id': teacherUid,
            'x-user-plan': plan,
        },
        body: JSON.stringify(body),
    });
}

async function readJson(res: Response): Promise<Record<string, any>> {
    return res.json().catch(() => ({}));
}

/** Map an existing route's error response to a safe MCP error (fixed messages; upstream text is never forwarded verbatim). */
function routeError(step: 'message' | 'outreach' | 'call', status: number, body: Record<string, any>): McpCapabilityError {
    if (status === 409 && body.code === 'OUTSIDE_CALLING_HOURS') {
        const next = body.nextAllowedAt ? Date.parse(body.nextAllowedAt) : NaN;
        const wait = Number.isFinite(next) ? Math.max(60, Math.round((next - Date.now()) / 1000)) : undefined;
        return new McpCapabilityError('outside_allowed_hours', 'Parents can only be called between 09:00 and 21:00 IST.', wait);
    }
    if (status === 429) {
        const wait = Number(body.retryAfterSeconds) || undefined;
        return new McpCapabilityError('rate_limited', step === 'outreach'
            ? 'This parent was contacted in the last 5 minutes. Wait before calling again.'
            : 'The teacher\'s parent-message limit is reached for now.', wait);
    }
    if (status === 403) {
        return body.error === 'PREMIUM_REQUIRED' || body.upgradeRequired || body.currentPlan
            ? new McpCapabilityError('authorization', 'The class teacher\'s Sahayak plan does not include parent calling.')
            : new McpCapabilityError('not_found', NOT_FOUND);
    }
    if (status === 404) return new McpCapabilityError('not_found', NOT_FOUND);
    if (status === 422 && body.code === 'PARENT_NUMBER_UNREACHABLE') {
        return new McpCapabilityError('invalid_input', 'The parent\'s phone number could not be reached. Check the number on the student record.');
    }
    if (status === 422) {
        return new McpCapabilityError('invalid_input', step === 'call' && /not supported/i.test(String(body.error ?? ''))
            ? 'Automatic calls are not available in this parent\'s language.'
            : 'There is no valid parent phone number on record for this student.');
    }
    if (status === 503) return new McpCapabilityError('not_configured', 'Parent calling is not configured on this Sahayak server.');
    if (status === 502 || status === 504) return new McpCapabilityError('upstream_unavailable', 'The phone provider could not place the call. Retry in a minute.', 60);
    return new McpCapabilityError('internal', 'Sahayak could not complete this request. Please try again later.');
}

export async function initiateParentCall(
    input: InitiateParentCallInput,
    principal: McpPrincipal,
    deps: CallingServiceDeps,
): Promise<ParentCallResult> {
    if (!deps.callbackBaseUrl) {
        throw new McpCapabilityError('not_configured', 'Parent calling is not configured on this Sahayak server.');
    }
    const db = await deps.getDb();
    const { teacherUid, cls } = await authorizeClass(db, principal.orgId, input.class_id);
    const studentSnap = await db.collection('classes').doc(input.class_id).collection('students').doc(input.student_id).get();
    const student = studentSnap.exists ? studentSnap.data() : undefined;
    if (!student) throw new McpCapabilityError('not_found', NOT_FOUND);
    const studentName = str(student.name) ?? 'Student';
    const parentLanguage = str(student.parentLanguage) ?? 'English';
    const digits = String(student.parentPhone ?? '').replace(/\D/g, '');
    if (!digits) throw new McpCapabilityError('invalid_input', 'There is no valid parent phone number on record for this student.');

    // Quiet hours are enforced by the call route; checking first as well means an
    // out-of-hours request writes no outreach record and spends no model call.
    const window = deps.checkCallingWindow();
    if (!window.allowed) throw routeError('call', 409, { code: 'OUTSIDE_CALLING_HOURS', nextAllowedAt: window.nextAllowedAt?.toISOString() });

    const teacher = await db.collection('users').doc(teacherUid).get();
    const plan = str(teacher.data()?.planType) ?? 'free';
    const className = str(cls.name) ?? 'Class';
    const subject = input.subject ?? str(cls.subject) ?? 'General';

    // 1. Message (same request the modal's generateMessage() sends).
    const msgRes = await deps.routes.parentMessage(internalRequest(deps.callbackBaseUrl, '/api/ai/parent-message', teacherUid, plan, {
        studentName, className, subject, reason: input.reason,
        ...(input.teacher_note ? { teacherNote: input.teacher_note } : {}),
        parentLanguage,
    }));
    const msg = await readJson(msgRes);
    if (!msgRes.ok || typeof msg.message !== 'string' || !msg.message.trim()) {
        throw msgRes.ok ? new McpCapabilityError('generation_failed', 'Sahayak could not write the parent message. Retry.') : routeError('message', msgRes.status, msg);
    }
    const spokenScript = typeof msg.spokenScript === 'string' && msg.spokenScript.trim() ? msg.spokenScript.trim() : null;

    // 2. Outreach record (same body as the modal's saveOutreach('twilio_call')).
    const outRes = await deps.routes.outreach(internalRequest(deps.callbackBaseUrl, '/api/attendance/outreach', teacherUid, plan, {
        classId: input.class_id, className, studentId: input.student_id, studentName, parentLanguage,
        reason: input.reason, ...(input.teacher_note ? { teacherNote: input.teacher_note } : {}),
        generatedMessage: msg.message, ...(spokenScript ? { spokenScript } : {}),
        deliveryMethod: 'twilio_call', subject,
    }));
    const out = await readJson(outRes);
    if (!outRes.ok || typeof out.outreachId !== 'string') throw routeError('outreach', outRes.status, out);

    // 3. Dial (same request as handleCall()). The number comes from the stored record.
    const callRes = await deps.routes.call(internalRequest(deps.callbackBaseUrl, '/api/attendance/call', teacherUid, plan, {
        outreachId: out.outreachId, parentLanguage,
    }));
    const call = await readJson(callRes);
    if (!callRes.ok) throw routeError('call', callRes.status, call);

    return {
        status: 'call_initiated',
        student_name: studentName,
        class_name: className,
        reason: input.reason,
        parent_language: parentLanguage,
        parent_phone_last4: digits.slice(-4),
        message: msg.message.trim(),
        spoken_script: spokenScript,
    };
}

export function renderParentCallText(r: ParentCallResult): string {
    return `Call started to the parent of ${r.student_name} (${r.class_name}), phone ending ${r.parent_phone_last4}, in ${r.parent_language}.\n\n${r.message}`;
}

export function renderContactsText(r: ParentContactsResult): string {
    return r.classes.map((c) => `${c.name} [${c.class_id}]: ${c.students.length} students, ${c.students.filter((s) => s.parent_reachable).length} reachable`).join('\n') || 'No classes found.';
}
