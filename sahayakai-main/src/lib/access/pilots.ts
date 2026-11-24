import 'server-only';
import { z } from 'zod';
import { getAuthInstance, getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import {
    accessGrantForOrganization,
    organizationStatus,
    returnMemberToBaseAccess,
    type Organization,
    type OrganizationVerification,
} from '@/lib/organization';
import { baseAccessState, mergeCustomClaims, setAccessState } from './access-admin';
import { AccessHttpError, addDays, clampDays, toDateOrNull } from './route-helpers';
import { DEFAULT_PILOT_DAYS, MAX_PILOT_DAYS } from './requests';

/**
 * Pilot organisations: a verified school gets a time-boxed, seat-capped
 * workspace without paying. A SahayakAI administrator provisions it after
 * checking the school's identity, and can later extend it, convert it to a
 * paying (active) organisation, or end it.
 *
 * Expiry is enforced twice: every member's `accessExp` claim ends the pilot
 * at the edge on its own, and the nightly job (expireDuePilotOrganizations)
 * tidies the stored state and returns members to their base access.
 *
 * Design: docs/ACCESS_GATE_DESIGN.md
 */

const MAX_PILOT_SEATS = 500;

const optionalText = (max: number) =>
    z.preprocess(
        (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
        z.string().trim().max(max).optional(),
    );

export const pilotOrgInputSchema = z.object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(['school', 'chain', 'government']),
    adminEmail: z.string().trim().toLowerCase().email().max(254),
    seats: z.number().int().min(1).max(MAX_PILOT_SEATS),
    pilotDays: z.number().optional(),
    plan: z.enum(['gold', 'premium']).optional(),
    verification: z
        .object({
            board: optionalText(60),
            affiliationNumber: optionalText(40),
            method: optionalText(200),
            note: optionalText(1000),
        })
        .refine((v) => Boolean(v.affiliationNumber || v.method || v.note), {
            message: 'record how the school was verified',
        }),
});
export type PilotOrgInput = z.infer<typeof pilotOrgInputSchema>;

export function parsePilotOrgInput(body: unknown): PilotOrgInput {
    const parsed = pilotOrgInputSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue?.path.join('.') || 'body';
        throw new AccessHttpError(400, `Invalid ${field}: ${issue?.message ?? 'invalid value'}`, 'VALIDATION_FAILED');
    }
    return parsed.data;
}

function isAuthUserNotFound(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'auth/user-not-found';
}

/**
 * Create a pilot organisation for a verified school and entitle its admin.
 *
 * The admin is looked up by email in Firebase Auth, so the person must have
 * signed in to SahayakAI once (404 otherwise, with a message the
 * administrator can act on). An account that already belongs to an
 * organisation is refused (409) rather than silently moved.
 */
export async function provisionPilotOrganization(
    input: PilotOrgInput & { actor: string; now?: Date },
): Promise<{ orgId: string; adminUserId: string; pilotEndsAt: Date }> {
    const now = input.now ?? new Date();
    const auth = await getAuthInstance();

    let adminUserId: string;
    try {
        adminUserId = (await auth.getUserByEmail(input.adminEmail)).uid;
    } catch (err) {
        if (isAuthUserNotFound(err)) {
            throw new AccessHttpError(
                404,
                'No SahayakAI account exists for that email. Ask the school admin to sign in once, then retry.',
                'ADMIN_NOT_FOUND',
            );
        }
        throw err;
    }

    const db = await getDb();
    const userRef = db.collection('users').doc(adminUserId);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    if (typeof user.organizationId === 'string' && user.organizationId.length > 0) {
        throw new AccessHttpError(409, 'That account already belongs to an organization', 'OTHER_ORG');
    }
    if (user.accessState === 'blocked') {
        throw new AccessHttpError(409, 'That account is blocked', 'ACCOUNT_BLOCKED');
    }

    const plan = input.plan ?? 'gold';
    const pilotEndsAt = addDays(now, clampDays(input.pilotDays, DEFAULT_PILOT_DAYS, MAX_PILOT_DAYS));
    const verification: OrganizationVerification = {
        ...(input.verification.board ? { board: input.verification.board } : {}),
        ...(input.verification.affiliationNumber ? { affiliationNumber: input.verification.affiliationNumber } : {}),
        ...(input.verification.method ? { method: input.verification.method } : {}),
        ...(input.verification.note ? { note: input.verification.note } : {}),
        verifiedBy: input.actor,
        verifiedAt: now,
    };

    const orgRef = db.collection('organizations').doc();
    const batch = db.batch();
    batch.set(orgRef, {
        name: input.name,
        type: input.type,
        adminUserId,
        plan,
        totalSeats: input.seats,
        usedSeats: 1, // admin is the first seat
        status: 'pilot',
        pilotEndsAt,
        verification,
        createdBy: input.actor,
        createdAt: now,
        updatedAt: now,
    });
    batch.set(orgRef.collection('members').doc(adminUserId), {
        userId: adminUserId,
        role: 'admin',
        joinedAt: now,
        invitedBy: input.actor,
    });
    batch.set(
        userRef,
        { organizationId: orgRef.id, planType: plan, planSource: 'organization', updatedAt: now },
        { merge: true },
    );
    await batch.commit();

    await mergeCustomClaims(adminUserId, { planType: plan, orgId: orgRef.id, orgRole: 'admin' });
    await setAccessState(adminUserId, 'pilot', {
        expiresAt: pilotEndsAt,
        actor: input.actor,
        reason: `pilot organization ${orgRef.id} provisioned`,
        orgId: orgRef.id,
    });

    logger.info('Pilot organization provisioned', 'ACCESS', { orgId: orgRef.id, adminUserId, seats: input.seats });
    return { orgId: orgRef.id, adminUserId, pilotEndsAt };
}

interface MemberSweepResult {
    updated: number;
    skipped: number;
    failed: number;
}

/**
 * Apply `fn` to every member of an organisation. One member failing must not
 * strand the rest, so failures are counted and logged, not thrown. Blocked
 * accounts are skipped: only an explicit administrator action unblocks.
 */
async function forEachMember(
    orgId: string,
    fn: (uid: string, role: 'admin' | 'teacher') => Promise<void>,
): Promise<MemberSweepResult> {
    const db = await getDb();
    const members = await db.collection('organizations').doc(orgId).collection('members').get();
    const result: MemberSweepResult = { updated: 0, skipped: 0, failed: 0 };
    for (const doc of members.docs) {
        const uid = doc.id;
        const role = doc.data()?.role === 'admin' ? 'admin' : 'teacher';
        try {
            const userSnap = await db.collection('users').doc(uid).get();
            if (userSnap.exists && (userSnap.data() as Record<string, unknown>).accessState === 'blocked') {
                result.skipped++;
                continue;
            }
            await fn(uid, role);
            result.updated++;
        } catch (err) {
            result.failed++;
            logger.error('Organization member access update failed', err, 'ACCESS', { orgId, uid });
        }
    }
    return result;
}

/** Give every member the plan, org claims and access the organisation confers. */
async function grantMembers(
    orgId: string,
    org: Organization,
    actor: string,
    reason: string,
    now: Date,
): Promise<MemberSweepResult> {
    const grant = accessGrantForOrganization(org, now);
    if (!grant) throw new Error(`grantMembers: organization ${orgId} confers no access`);
    const db = await getDb();
    return forEachMember(orgId, async (uid, role) => {
        await db.collection('users').doc(uid).set(
            { organizationId: orgId, planType: org.plan, planSource: 'organization', updatedAt: now },
            { merge: true },
        );
        await mergeCustomClaims(uid, { planType: org.plan, orgId, orgRole: role });
        await setAccessState(uid, grant.state, { expiresAt: grant.expiresAt, actor, reason, orgId });
    });
}

/**
 * End an organisation's access. Members keep their membership (so the school
 * can be extended or converted later without re-inviting everyone) but drop
 * to the free plan and to their base access state.
 */
export async function expireOrganization(
    orgId: string,
    actor: string,
    reason: string,
    now: Date = new Date(),
): Promise<MemberSweepResult> {
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);
    const snap = await orgRef.get();
    if (!snap.exists) throw new AccessHttpError(404, 'Organization not found');

    await orgRef.update({ status: 'expired', expiredAt: now, updatedAt: now });
    const sweep = await forEachMember(orgId, async (uid) => {
        await db.collection('users').doc(uid).set({ planType: 'free', updatedAt: now }, { merge: true });
        await returnMemberToBaseAccess(uid, { actor, reason, orgId, keepOrgClaims: true });
    });
    logger.info('Organization expired', 'ACCESS', { orgId, actor, ...sweep });
    return sweep;
}

export type PilotOrgAction = 'extend' | 'convert' | 'expire';

/**
 * Administrator actions on a provisioned organisation.
 *  - extend   push the pilot end date out by `days` (default 14, cap 90) from
 *             the later of now and the current end; reopens an expired pilot.
 *  - convert  the school is now a customer: status active, no expiry.
 *  - expire   end access now.
 */
export async function applyPilotOrgAction(params: {
    orgId: string;
    action: PilotOrgAction;
    days?: unknown;
    actor: string;
    now?: Date;
}): Promise<{ status: 'pilot' | 'active' | 'expired'; pilotEndsAt: Date | null; members: MemberSweepResult }> {
    const now = params.now ?? new Date();
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(params.orgId);
    const snap = await orgRef.get();
    if (!snap.exists) throw new AccessHttpError(404, 'Organization not found');
    const org = snap.data() as Organization;
    const status = organizationStatus(org);

    if (params.action === 'expire') {
        const members = await expireOrganization(params.orgId, params.actor, 'pilot ended by administrator', now);
        return { status: 'expired', pilotEndsAt: toDateOrNull(org.pilotEndsAt), members };
    }

    if (params.action === 'convert') {
        await orgRef.update({ status: 'active', convertedAt: now, convertedBy: params.actor, updatedAt: now });
        const members = await grantMembers(
            params.orgId,
            { ...org, status: 'active' },
            params.actor,
            `organization ${params.orgId} converted to active`,
            now,
        );
        logger.info('Organization converted to active', 'ACCESS', { orgId: params.orgId, actor: params.actor });
        return { status: 'active', pilotEndsAt: toDateOrNull(org.pilotEndsAt), members };
    }

    // extend
    if (status === 'active') {
        throw new AccessHttpError(409, 'This organization is active and has no pilot to extend', 'NOT_A_PILOT');
    }
    const currentEnd = toDateOrNull(org.pilotEndsAt);
    const from = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
    const pilotEndsAt = addDays(from, clampDays(params.days, DEFAULT_PILOT_DAYS, MAX_PILOT_DAYS));
    await orgRef.update({ status: 'pilot', pilotEndsAt, extendedAt: now, extendedBy: params.actor, updatedAt: now });
    const members = await grantMembers(
        params.orgId,
        { ...org, status: 'pilot', pilotEndsAt },
        params.actor,
        `pilot of organization ${params.orgId} extended`,
        now,
    );
    logger.info('Pilot extended', 'ACCESS', { orgId: params.orgId, actor: params.actor });
    return { status: 'pilot', pilotEndsAt, members };
}

export interface AdminOrgSummary {
    id: string;
    name: string;
    type: string;
    status: 'pilot' | 'active' | 'expired';
    plan: string;
    totalSeats: number;
    usedSeats: number;
    pilotEndsAt: string | null;
    createdAt: string | null;
}

function isoOrNull(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return null;
}

/**
 * Organisations for the admin "Pilot schools" tab, newest first. A missing
 * `status` is reported as `active` (organisations created before the gate).
 * Single-field ordering only, so no composite index is needed.
 */
export async function listOrganizationsForAdmin(limit = 100): Promise<AdminOrgSummary[]> {
    const db = await getDb();
    const snap = await db.collection('organizations').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map((doc) => {
        const d = doc.data() as Record<string, unknown>;
        const status = d.status === 'pilot' || d.status === 'expired' ? d.status : 'active';
        return {
            id: doc.id,
            name: typeof d.name === 'string' ? d.name : '',
            type: typeof d.type === 'string' ? d.type : 'school',
            status,
            plan: typeof d.plan === 'string' ? d.plan : '',
            totalSeats: typeof d.totalSeats === 'number' ? d.totalSeats : 0,
            usedSeats: typeof d.usedSeats === 'number' ? d.usedSeats : 0,
            pilotEndsAt: isoOrNull(d.pilotEndsAt),
            createdAt: isoOrNull(d.createdAt),
        };
    });
}

const EXPIRY_ACTOR = 'system:expiry-job';

/**
 * Expire pilot organisations whose end date has passed. Idempotent: an
 * expired organisation no longer matches the query. Needs the
 * (status ASC, pilotEndsAt ASC) composite index on `organizations`.
 */
export async function expireDuePilotOrganizations(
    now: Date = new Date(),
    limit = 50,
): Promise<{ organizations: number; members: number; failed: number; more: boolean }> {
    const db = await getDb();
    const snap = await db
        .collection('organizations')
        .where('status', '==', 'pilot')
        .where('pilotEndsAt', '<=', now)
        .orderBy('pilotEndsAt', 'asc')
        .limit(limit)
        .get();

    let organizations = 0;
    let members = 0;
    let failed = 0;
    for (const doc of snap.docs) {
        try {
            const sweep = await expireOrganization(doc.id, EXPIRY_ACTOR, 'pilot period ended', now);
            organizations++;
            members += sweep.updated;
            failed += sweep.failed;
        } catch (err) {
            failed++;
            logger.error('Pilot organization expiry failed', err, 'ACCESS', { orgId: doc.id });
        }
    }
    return { organizations, members, failed, more: snap.size === limit };
}

/**
 * Tidy individual grants whose `accessExpiresAt` has passed (the claim has
 * already cut them off at the edge). A member of an organisation is
 * re-aligned with what that organisation confers; anyone else returns to
 * their base state. Idempotent: every outcome clears or advances the expiry.
 */
export async function expireDueUserGrants(
    now: Date = new Date(),
    limit = 200,
): Promise<{ expired: number; realigned: number; failed: number; more: boolean }> {
    const db = await getDb();
    const snap = await db
        .collection('users')
        .where('accessExpiresAt', '<=', now)
        .orderBy('accessExpiresAt', 'asc')
        .limit(limit)
        .get();

    let expired = 0;
    let realigned = 0;
    let failed = 0;
    for (const doc of snap.docs) {
        const uid = doc.id;
        const data = doc.data() as Record<string, unknown>;
        try {
            if (data.accessState !== 'pilot' && data.accessState !== 'active') {
                // Stale expiry on a non-entitled state: just clear it.
                await doc.ref.set({ accessExpiresAt: null }, { merge: true });
                continue;
            }
            const orgId = typeof data.organizationId === 'string' ? data.organizationId : null;
            if (orgId) {
                const orgSnap = await db.collection('organizations').doc(orgId).get();
                const grant = orgSnap.exists ? accessGrantForOrganization(orgSnap.data() as Organization, now) : null;
                if (grant) {
                    await setAccessState(uid, grant.state, {
                        expiresAt: grant.expiresAt,
                        actor: EXPIRY_ACTOR,
                        reason: `re-aligned with organization ${orgId}`,
                        orgId,
                    });
                    realigned++;
                    continue;
                }
                await doc.ref.set({ planType: 'free', updatedAt: now }, { merge: true });
                await returnMemberToBaseAccess(uid, {
                    actor: EXPIRY_ACTOR,
                    reason: 'access period ended',
                    orgId,
                    keepOrgClaims: true,
                });
                expired++;
                continue;
            }
            const base = await baseAccessState(uid);
            await setAccessState(uid, base.state, { actor: EXPIRY_ACTOR, reason: 'access period ended' });
            expired++;
        } catch (err) {
            failed++;
            logger.error('User access expiry failed', err, 'ACCESS', { uid });
        }
    }
    return { expired, realigned, failed, more: snap.size === limit };
}
