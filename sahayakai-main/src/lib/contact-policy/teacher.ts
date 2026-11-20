/**
 * The teacher path's side of the shared contact check (Step 2 of the Sampark + MCP
 * integration brief): which school a teacher calls for, the check itself, and the
 * ledger entry a placed call leaves behind.
 *
 * School: `users/{uid}.organizationId`, accepted only when `organizations/{orgId}/members/{uid}`
 * exists. Both are server-managed (organizationId is a protected field in firestore.rules), so a
 * teacher cannot step outside their school's opt-out list by editing their profile. A teacher
 * with no verified school calls as a standalone teacher: no school opt-out list, but the hours
 * and the per-number cap still apply.
 */

import 'server-only';

import { getSamparkRepo } from '@/lib/sampark/repo/factory';
import {
    checkContact,
    clearanceFor,
    type ContactClearance,
    type ContactDecision,
    type ContactPolicyStore,
} from '@/lib/contact-policy';

export interface TeacherSchoolDb {
    collection(name: string): {
        doc(id: string): {
            get(): Promise<{ exists: boolean; data(): unknown }>;
            collection(name: string): { doc(id: string): { get(): Promise<{ exists: boolean }> } };
        };
    };
}

/** The teacher's verified school, or null for a teacher who belongs to none. */
export async function teacherSchool(db: TeacherSchoolDb, uid: string): Promise<string | null> {
    const profile = await db.collection('users').doc(uid).get();
    const orgId = profile.exists ? (profile.data() as { organizationId?: unknown } | undefined)?.organizationId : undefined;
    if (typeof orgId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(orgId)) return null;
    const member = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
    return member.exists ? orgId : null;
}

export type TeacherCallClearance =
    | { ok: true; clearance: ContactClearance }
    | { ok: false; decision: Extract<ContactDecision, { allowed: false }> };

/**
 * May this teacher's call to `parentPhone` be placed now? A teacher's call is always routine.
 * Fails closed: if the school or the store cannot be read, the answer is policy_unavailable.
 */
export async function clearTeacherCall(params: {
    db: TeacherSchoolDb;
    uid: string;
    parentPhone: string;
    at: Date;
    store?: ContactPolicyStore;
}): Promise<TeacherCallClearance & { orgId: string | null }> {
    let orgId: string | null = null;
    try {
        orgId = await teacherSchool(params.db, params.uid);
        const store = params.store ?? (await getSamparkRepo());
        const input = { orgId, phone: { e164: params.parentPhone }, kind: 'routine' as const, at: params.at };
        const decision = await checkContact(input, store);
        const clearance = clearanceFor(input, decision);
        if (clearance) return { ok: true, clearance, orgId };
        return { ok: false, decision: decision as Extract<ContactDecision, { allowed: false }>, orgId };
    } catch {
        return {
            ok: false,
            orgId,
            decision: {
                allowed: false,
                reason: 'policy_unavailable',
                message: 'The calling rules could not be checked just now, so this call was not placed.',
                nextAllowedAt: null,
                phoneHash: null,
            },
        };
    }
}

/**
 * Record the teacher's call in the shared ledger BEFORE the carrier is contacted, the way Sampark
 * claims its call record before dialling: a call whose record cannot be written is not placed.
 * Keyed by the outreach id, so the modal's "Try again" on the same outreach never counts twice.
 */
export async function recordTeacherContact(clearance: ContactClearance, outreachId: string, store?: ContactPolicyStore): Promise<void> {
    const s = store ?? (await getSamparkRepo());
    await s.recordContact({
        id: `teacher_${outreachId}`,
        orgId: clearance.orgId,
        phoneHash: clearance.phoneHash,
        kind: clearance.kind,
        source: 'teacher',
        at: clearance.at.toISOString(),
    });
}
