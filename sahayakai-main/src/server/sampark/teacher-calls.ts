/**
 * Teacher calls for the school's Calls view (integration brief Step 1B).
 *
 * A principal needs to see every call the school made to a parent, whatever
 * started it. Sampark's own calls come from its repo (calls.ts); this module
 * adds the calls teachers placed from the attendance app ("Contact"), which
 * live in `parent_outreach` and carry no organisation id.
 *
 * Scoping (the same rule list_parent_contacts uses): the school's teachers are
 * the doc ids of `organizations/{orgId}/members`; their outreach records are
 * read with `teacherUid in [...]`, 30 ids per query (Firestore's `in` limit).
 * Only `deliveryMethod: 'twilio_call'` records count — a WhatsApp copy is not a call.
 *
 * Projection: this screen is seen by more staff than the teacher who wrote the
 * message, so each record is rebuilt field by field from an allow-list. The
 * full phone number, the generated message, the spoken script, the teacher's
 * note, transcripts and provider ids never leave this module. Malformed or
 * legacy records degrade to safe defaults instead of failing the screen.
 */

import { z } from 'zod';

import { getDb } from '@/lib/firebase-admin';
import type { TeacherCallEntry, TeacherCallOutcome, TeacherCallReason } from '@/types/sampark';

export const OUTREACH_COLLECTION = 'parent_outreach';
/** Firestore's limit on the values of one `in` filter. */
export const IN_QUERY_CHUNK = 30;

export const TeacherCallQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type TeacherCallQuery = z.infer<typeof TeacherCallQuerySchema>;

/** Minimal Firestore surface (keeps this testable with a fake). */
export interface TeacherCallsDb {
    collection(name: string): {
        doc(id: string): { collection(name: string): { get(): Promise<{ docs: { id: string }[] }> } };
        where(field: string, op: 'in', values: string[]): {
            orderBy(field: string, dir: 'desc'): {
                limit(n: number): { get(): Promise<{ docs: { id: string; data(): unknown }[] }> };
            };
        };
    };
}

export interface TeacherCallsDeps {
    getDb: () => Promise<TeacherCallsDb>;
}

const defaultDeps: TeacherCallsDeps = { getDb: async () => (await getDb()) as unknown as TeacherCallsDb };

const REASONS: readonly TeacherCallReason[] = ['consecutive_absences', 'poor_performance', 'behavioral_concern', 'positive_feedback'];
const OUTCOMES: readonly TeacherCallOutcome[] = ['initiated', 'completed', 'failed', 'no_answer', 'busy'];

const str = (v: unknown, max = 120): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : null);

/** Last four digits of a stored number; '' when there are not four digits to show. */
export function phoneLast4(raw: unknown): string {
    const digits = typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
    return digits.length >= 4 ? digits.slice(-4) : '';
}

/** The only shape a teacher call leaves the server in. */
export function toTeacherCallEntry(id: string, raw: unknown): TeacherCallEntry | null {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (r.deliveryMethod !== 'twilio_call') return null;
    const createdAt = str(r.createdAt, 40);
    if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;
    const reason = REASONS.includes(r.reason as TeacherCallReason) ? (r.reason as TeacherCallReason) : 'other';
    const outcome = OUTCOMES.includes(r.callStatus as TeacherCallOutcome) ? (r.callStatus as TeacherCallOutcome) : 'unknown';
    const duration = typeof r.callDurationSeconds === 'number' && Number.isFinite(r.callDurationSeconds) && r.callDurationSeconds >= 0
        ? Math.round(r.callDurationSeconds)
        : null;
    return {
        id,
        source: 'teacher',
        createdAt: new Date(createdAt).toISOString(),
        phoneLast4: phoneLast4(r.parentPhone),
        className: str(r.className),
        reason,
        outcome,
        durationSeconds: duration,
    };
}

async function schoolTeacherUids(db: TeacherCallsDb, orgId: string): Promise<string[]> {
    const members = await db.collection('organizations').doc(orgId).collection('members').get();
    return [...new Set(members.docs.map((d) => d.id).filter((id) => typeof id === 'string' && id !== ''))];
}

/** The school's teacher calls, newest first, at most `limit`. */
export async function listTeacherCalls(orgId: string, query: TeacherCallQuery, deps: TeacherCallsDeps = defaultDeps): Promise<TeacherCallEntry[]> {
    const db = await deps.getDb();
    const uids = await schoolTeacherUids(db, orgId);
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += IN_QUERY_CHUNK) chunks.push(uids.slice(i, i + IN_QUERY_CHUNK));

    const snaps = await Promise.all(
        chunks.map((chunk) =>
            db.collection(OUTREACH_COLLECTION).where('teacherUid', 'in', chunk).orderBy('createdAt', 'desc').limit(query.limit).get(),
        ),
    );
    const allowed = new Set(uids);
    const seen = new Set<string>();
    const out: TeacherCallEntry[] = [];
    for (const snap of snaps) {
        for (const doc of snap.docs) {
            if (seen.has(doc.id)) continue;
            const data = doc.data() as { teacherUid?: unknown } | undefined;
            // Belt and braces: never trust the query alone for tenant scoping.
            if (!data || typeof data.teacherUid !== 'string' || !allowed.has(data.teacherUid)) continue;
            const entry = toTeacherCallEntry(doc.id, data);
            if (!entry) continue;
            seen.add(doc.id);
            out.push(entry);
        }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, query.limit);
}
