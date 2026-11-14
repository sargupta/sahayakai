/**
 * Sampark authority — the ONE org-admin rule every Sampark route uses
 * (plan §9 "Tenancy and authority").
 *
 * A user administers a school iff, on SERVER-MANAGED data only:
 *   organizations/{orgId}.adminUserId === uid, OR
 *   organizations/{orgId}/members/{uid}.role === 'admin'.
 *
 * This is the rule the analytics route already applies
 * (src/app/api/organizations/[orgId]/analytics/route.ts), extracted and tested
 * here. The dashboard page recognises only adminUserId; the members-admin
 * branch is the analytics route's (broader) reading. The self-editable
 * profile fields `administrativeRole: 'principal'` and `organizationId` are
 * NEVER an authority — at most a hint that is re-verified below.
 */

import { getDb } from '@/lib/firebase-admin';

export async function requireOrgAdmin(orgId: string, uid: string): Promise<boolean> {
    if (!orgId || !uid) return false;
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return false;
    if ((orgSnap.data() as { adminUserId?: string }).adminUserId === uid) return true;
    const memberSnap = await orgRef.collection('members').doc(uid).get();
    return memberSnap.exists && (memberSnap.data() as { role?: string }).role === 'admin';
}

/** The member record's class list key for a class: `${grade}-${section}` (e.g. "7-A"). */
export function memberClassKey(grade: number, section: string): string {
    return `${grade}-${section}`;
}

/**
 * Class authority for class-wide outreach: an org admin manages every class; a teacher manages
 * the classes the school assigned to them on their SERVER-MANAGED member record
 * (organizations/{orgId}/members/{uid} with role 'teacher' and `samparkClasses: ["7-A", …]`;
 * firestore.rules make members write-only through the Admin SDK). Nothing self-editable (the
 * user profile, a request body) can widen it.
 */
export async function canManageClass(orgId: string, uid: string, grade: number, section: string): Promise<boolean> {
    if (!orgId || !uid) return false;
    if (await requireOrgAdmin(orgId, uid)) return true;
    const db = await getDb();
    const member = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
    if (!member.exists) return false;
    const data = member.data() as { role?: string; samparkClasses?: unknown };
    return data.role === 'teacher' && Array.isArray(data.samparkClasses) && data.samparkClasses.includes(memberClassKey(grade, section));
}

/** Org admin, or a teacher member with at least one assigned class (route shell for class-wide outreach). */
export async function isSchoolStaffForOutreach(orgId: string, uid: string): Promise<boolean> {
    if (!orgId || !uid) return false;
    if (await requireOrgAdmin(orgId, uid)) return true;
    const db = await getDb();
    const member = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
    const data = member.exists ? (member.data() as { role?: string; samparkClasses?: unknown }) : null;
    return data?.role === 'teacher' && Array.isArray(data.samparkClasses) && data.samparkClasses.length > 0;
}

export interface AdministeredOrg {
    orgId: string;
    name: string;
}

/**
 * Organisations the user administers, for GET /api/sampark/me.
 *
 * Query choice (documented because the obvious one does not work):
 *   1. `organizations where adminUserId == uid` — a single-field equality
 *      query served by Firestore's automatic index.
 *   2. Admin memberships (members/{uid}.role === 'admin') cannot be listed
 *      without a collection-group query on `members`, which needs a
 *      COLLECTION_GROUP index this repo does not declare (and `members` is
 *      not a Sampark collection to add one for). Instead the user's own
 *      `users/{uid}.organizationId` is used as a CANDIDATE and re-verified
 *      through requireOrgAdmin — the profile field only nominates, the
 *      server-managed members doc decides. A member-admin of an org that is
 *      not their profile org can still open it directly by id; it is just
 *      not listed here.
 */
export async function listAdministeredOrgs(uid: string): Promise<AdministeredOrg[]> {
    if (!uid) return [];
    const db = await getDb();
    const owned = await db.collection('organizations').where('adminUserId', '==', uid).limit(50).get();
    const out = new Map<string, AdministeredOrg>();
    for (const doc of owned.docs) {
        out.set(doc.id, { orgId: doc.id, name: String((doc.data() as { name?: string }).name ?? doc.id) });
    }

    const profile = await db.collection('users').doc(uid).get();
    const hinted = profile.exists ? (profile.data() as { organizationId?: unknown }).organizationId : undefined;
    if (typeof hinted === 'string' && hinted !== '' && !out.has(hinted) && (await requireOrgAdmin(hinted, uid))) {
        const org = await db.collection('organizations').doc(hinted).get();
        out.set(hinted, { orgId: hinted, name: String((org.data() as { name?: string } | undefined)?.name ?? hinted) });
    }
    return [...out.values()];
}

/** Name and demo flag of an organisation (the org doc's `isDemoData`), for enabling Sampark. */
export async function getOrganizationFacts(orgId: string): Promise<{ name: string; isDemo: boolean } | null> {
    const db = await getDb();
    const snap = await db.collection('organizations').doc(orgId).get();
    if (!snap.exists) return null;
    const data = snap.data() as { name?: string; isDemoData?: boolean };
    return { name: String(data.name ?? orgId), isDemo: data.isDemoData === true };
}
