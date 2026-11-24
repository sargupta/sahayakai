import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { baseAccessState, mergeCustomClaims, resolveAccess, setAccessState } from '@/lib/access/access-admin';
import type { AccessState } from '@/lib/access/access-state';

/**
 * Organization management for B2B school billing.
 *
 * Schema:
 *   organizations/{orgId}
 *     - name, type, adminUserId, plan, subscriptionId, totalSeats, usedSeats
 *     - status: 'pilot' | 'active' | 'expired' (absent = 'active'), pilotEndsAt
 *     - verification: how the school's identity was checked before provisioning
 *   organizations/{orgId}/members/{userId}
 *     - role: 'admin' | 'teacher', joinedAt, invitedBy, termsVersion, termsAcceptedAt
 *   organizations/{orgId}/invites/{inviteId}
 *     - phone, role, status, createdAt, expiresAt
 *   organizations/{orgId}/joinLinks/{linkId}
 *     - tokenHash, createdBy, createdAt, expiresAt, maxUses, uses, revoked
 *       (see src/lib/access/join-links.ts)
 *
 * Access gate: membership of an organisation is what entitles a teacher to
 * use the product (docs/ACCESS_GATE_DESIGN.md). Every claim write here goes
 * through `mergeCustomClaims`; a bare `setCustomUserClaims` replaces the whole
 * claim set and would drop the `access` claim.
 */

export type OrganizationStatus = 'pilot' | 'active' | 'expired';

/** How SahayakAI verified that the organisation is a real school. */
export interface OrganizationVerification {
    board?: string;
    affiliationNumber?: string;
    /** e.g. "CBSE affiliation list + call to listed landline". */
    method?: string;
    note?: string;
    verifiedBy: string;
    verifiedAt: Date;
}

export interface Organization {
    id: string;
    name: string;
    type: 'school' | 'chain' | 'government';
    adminUserId: string;
    plan: 'gold' | 'premium';
    subscriptionId?: string;
    totalSeats: number;
    usedSeats: number;
    /** Absent on organisations created before the access gate; treat as 'active'. */
    status?: OrganizationStatus;
    /** End of the evaluation window. Set while (and after) status is 'pilot'. */
    pilotEndsAt?: Date;
    verification?: OrganizationVerification;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrgMember {
    userId: string;
    role: 'admin' | 'teacher';
    joinedAt: Date;
    invitedBy: string;
    termsVersion?: string;
    termsAcceptedAt?: Date;
}

export interface OrgInvite {
    id: string;
    phone: string;
    role: 'admin' | 'teacher';
    status: 'pending' | 'accepted' | 'expired';
    createdAt: Date;
    expiresAt: Date;
}

async function getDb() {
    const { getDb: _getDb } = await import('./firebase-admin');
    return _getDb();
}

function asDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate();
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/** Effective status of an organisation document (absent status = 'active'). */
export function organizationStatus(org: { status?: unknown }): OrganizationStatus {
    return org.status === 'pilot' || org.status === 'expired' ? org.status : 'active';
}

/**
 * The access state membership of this organisation confers right now, or
 * null when it confers none (expired, or a pilot whose window has closed).
 */
export function accessGrantForOrganization(
    org: { status?: unknown; pilotEndsAt?: unknown },
    now: Date = new Date(),
): { state: Extract<AccessState, 'pilot' | 'active'>; expiresAt: Date | null } | null {
    const status = organizationStatus(org);
    if (status === 'active') return { state: 'active', expiresAt: null };
    if (status === 'pilot') {
        const end = asDate(org.pilotEndsAt);
        if (end && end.getTime() > now.getTime()) return { state: 'pilot', expiresAt: end };
    }
    return null;
}

/**
 * Return an account to what it is entitled to without any organisation:
 * free plan, no org claims, and the base access state (`legacy` if the
 * account predates the gate, otherwise `pending`). Used when a member is
 * removed and when a pilot ends.
 *
 * `keepOrgClaims` leaves orgId/orgRole in place (pilot expiry keeps the
 * membership so the school can be extended or converted later).
 */
export async function returnMemberToBaseAccess(
    userId: string,
    options: { actor: string; reason: string; orgId?: string; keepOrgClaims?: boolean },
): Promise<AccessState> {
    await mergeCustomClaims(
        userId,
        options.keepOrgClaims
            ? { planType: 'free' }
            : { planType: 'free', orgId: null, orgRole: null },
    );
    // An administrator's block outlives membership changes: a school admin
    // removing a blocked teacher must not hand them back legacy access.
    const current = await resolveAccess(userId);
    if (current.state === 'blocked') return 'blocked';

    const base = await baseAccessState(userId);
    await setAccessState(userId, base.state, {
        actor: options.actor,
        reason: options.reason,
        orgId: options.orgId,
    });
    return base.state;
}

/**
 * Create a new organization. Returns the org ID.
 *
 * SECURITY: By default this does NOT grant the admin the org plan in their
 * user profile / custom claim — that flip belongs in the Razorpay webhook
 * after HMAC-verified payment. Pass `grantPlanToAdmin: true` only when the
 * caller has independently verified payment (e.g. admin replaying a captured
 * Razorpay payment ID). See F7-001.
 *
 * The org doc itself + admin membership are always written so seat/invite
 * tooling has something to operate on.
 */
export async function createOrganization(params: {
    name: string;
    type: Organization['type'];
    adminUserId: string;
    plan: Organization['plan'];
    totalSeats: number;
    /**
     * When true, the caller is REQUESTING that the admin's plan be granted
     * immediately. This is only honoured if `razorpayPaymentId` resolves to a
     * genuinely captured Razorpay payment (verified server-side below). If the
     * flag is set but verification fails or no payment id is supplied, we fall
     * back to the webhook path (link org, do NOT flip plan). Defaults to false.
     */
    grantPlanToAdmin?: boolean;
    /**
     * Razorpay payment id backing the immediate grant. Verified against the
     * Razorpay API (must be `captured` with amount > 0) before any plan flip.
     */
    razorpayPaymentId?: string;
}): Promise<string> {
    const db = await getDb();
    const orgRef = db.collection('organizations').doc();

    const org: Omit<Organization, 'id'> = {
        name: params.name,
        type: params.type,
        adminUserId: params.adminUserId,
        plan: params.plan,
        totalSeats: params.totalSeats,
        usedSeats: 1, // admin is the first seat
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await orgRef.set(org);

    // Add admin as first member
    await orgRef.collection('members').doc(params.adminUserId).set({
        userId: params.adminUserId,
        role: 'admin',
        joinedAt: new Date(),
        invitedBy: params.adminUserId,
    });

    // The plan flip is only honoured after a real Razorpay payment is verified
    // server-side (F7-001 / H21). grantPlanToAdmin alone is not enough — the
    // caller derives it from the mere *presence* of a payment id, which is not
    // proof of payment. Fail closed to the webhook path on any doubt.
    let paymentVerified = false;
    let capturedAmountPaise = 0;
    let capturedCurrency = '';
    if (params.grantPlanToAdmin && params.razorpayPaymentId) {
        try {
            const { getRazorpay } = await import('./razorpay');
            const payment = await getRazorpay().payments.fetch(params.razorpayPaymentId);
            const amount = typeof payment?.amount === 'string'
                ? parseInt(payment.amount, 10)
                : (payment?.amount ?? 0);
            capturedAmountPaise = amount;
            capturedCurrency = String(payment?.currency ?? '');
            paymentVerified = payment?.status === 'captured' && amount > 0;
            if (!paymentVerified) {
                console.warn(
                    `[Org] Refusing immediate plan grant for ${params.adminUserId}: payment ${params.razorpayPaymentId} status=${payment?.status} amount=${amount}`
                );
            }
        } catch (err) {
            // Fail closed — webhook will grant the plan once Razorpay confirms.
            console.error(
                `[Org] Razorpay payment verification failed for ${params.razorpayPaymentId}; deferring plan grant to webhook:`,
                err
            );
            paymentVerified = false;
        }
    }

    // H21: bind the captured amount to the plan being granted, and apply the
    // payment exactly once via the payments_ledger transaction. A replayed
    // payment id, or a captured-but-wrong-amount payment, must NOT grant.
    let planGranted = false;
    if (paymentVerified && params.razorpayPaymentId) {
        const {
            validateOrgPaymentAmount,
            applyPaymentOnce,
            recordRejectedPayment,
        } = await import('@/server/payments');

        const check = validateOrgPaymentAmount({
            plan: params.plan,
            totalSeats: params.totalSeats,
            amountPaise: capturedAmountPaise,
            currency: capturedCurrency,
        });

        const ledgerEntry = {
            uid: params.adminUserId,
            orgId: orgRef.id,
            amountPaise: capturedAmountPaise,
            currency: capturedCurrency,
            planType: params.plan,
            source: 'org-creation' as const,
            amountVerified: check.verified,
            expectedPaise: check.expectedPaise,
        };

        if (!check.ok) {
            // Amount/currency mismatch — log + NO grant (fail closed to webhook).
            console.error(
                `[Org] AMOUNT MISMATCH — refusing plan grant for ${params.adminUserId}: payment ${params.razorpayPaymentId} paid ${capturedAmountPaise} ${capturedCurrency}, expected ${check.expectedPaise ?? 'n/a'} paise for ${params.plan}×${params.totalSeats} seats (${check.reason})`
            );
            await recordRejectedPayment(params.razorpayPaymentId, ledgerEntry, check.reason ?? 'AMOUNT_MISMATCH');
        } else {
            try {
                const result = await applyPaymentOnce({
                    paymentId: params.razorpayPaymentId,
                    entry: ledgerEntry,
                    grant: (tx) => {
                        // Plan grant written in the SAME transaction as the ledger doc.
                        tx.update(db.collection('users').doc(params.adminUserId), {
                            organizationId: orgRef.id,
                            planType: params.plan,
                            planSource: 'organization',
                            updatedAt: new Date(),
                        });
                    },
                });
                planGranted = result === 'applied';
                // result === 'replay' → applyPaymentOnce already audit-logged;
                // fall through to the link-only path with no plan flip.
            } catch (err) {
                console.error(
                    `[Org] Ledger transaction failed for payment ${params.razorpayPaymentId}; deferring plan grant to webhook:`,
                    err
                );
                planGranted = false;
            }
        }
    }

    if (planGranted) {
        // Set custom claims (profile already updated inside the ledger
        // transaction). Merged, so `access` and other claims survive.
        await mergeCustomClaims(params.adminUserId, {
            planType: params.plan,
            orgId: orgRef.id,
            orgRole: 'admin',
        });
        // A verified payment makes the school a paying customer: entitle the admin.
        await setAccessState(params.adminUserId, 'active', {
            actor: 'system:org-payment',
            reason: `organization ${orgRef.id} created with verified payment`,
            orgId: orgRef.id,
        });
    } else {
        // Link the user to the org without flipping plan — the webhook will
        // grant the plan once Razorpay confirms payment.
        await db.collection('users').doc(params.adminUserId).update({
            organizationId: orgRef.id,
            planSource: 'organization',
            updatedAt: new Date(),
        });
    }

    return orgRef.id;
}

/** Invite a teacher to the organization. */
export async function inviteTeacher(orgId: string, phone: string, invitedBy: string): Promise<string> {
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);
    const org = await orgRef.get();

    if (!org.exists) throw new Error('Organization not found');
    const data = org.data() as Organization;

    if (data.usedSeats >= data.totalSeats) {
        throw new Error('All seats are in use. Increase your seat count to invite more teachers.');
    }

    const inviteRef = orgRef.collection('invites').doc();
    await inviteRef.set({
        phone,
        role: 'teacher' as const,
        status: 'pending' as const,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        invitedBy,
    });

    return inviteRef.id;
}

/** Accept an invite — called when teacher signs up/logs in with matching phone. */
export async function acceptInvite(orgId: string, inviteId: string, userId: string): Promise<void> {
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);

    await db.runTransaction(async (tx) => {
        const orgDoc = await tx.get(orgRef);
        if (!orgDoc.exists) throw new Error('Organization not found');
        const org = orgDoc.data() as Organization;

        if (org.usedSeats >= org.totalSeats) {
            throw new Error('No seats available');
        }

        const inviteRef = orgRef.collection('invites').doc(inviteId);
        const invite = await tx.get(inviteRef);
        if (!invite.exists || invite.data()?.status !== 'pending') {
            throw new Error('Invite not found or already used');
        }

        // Update invite
        tx.update(inviteRef, { status: 'accepted', acceptedAt: new Date() });

        // Add member
        tx.set(orgRef.collection('members').doc(userId), {
            userId,
            role: 'teacher',
            joinedAt: new Date(),
            invitedBy: invite.data()?.invitedBy,
        });

        // Increment seat count
        tx.update(orgRef, { usedSeats: FieldValue.increment(1), updatedAt: new Date() });
    });

    // Update user profile (outside transaction — non-critical)
    const org = (await orgRef.get()).data() as Organization;
    await db.collection('users').doc(userId).update({
        organizationId: orgId,
        planType: org.plan,
        planSource: 'organization',
        updatedAt: new Date(),
    });

    await mergeCustomClaims(userId, {
        planType: org.plan,
        orgId,
        orgRole: 'teacher',
    });

    const grant = accessGrantForOrganization(org);
    if (grant) {
        await setAccessState(userId, grant.state, {
            expiresAt: grant.expiresAt,
            actor: 'system:org-invite',
            reason: `accepted invite ${inviteId} to organization ${orgId}`,
            orgId,
        });
    }
}

/** Remove a teacher from the organization. */
export async function removeTeacher(orgId: string, userId: string): Promise<void> {
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);

    // Only touch the target user's profile/claims/seat count if they were
    // genuinely a member of THIS org (H3). The transaction confirms the member
    // doc exists and decrements seats atomically; a non-member removal is a
    // no-op rather than a cross-tenant force-downgrade of an arbitrary uid.
    const userRef = db.collection('users').doc(userId);

    const removed = await db.runTransaction(async (tx) => {
        const memberRef = orgRef.collection('members').doc(userId);
        // Read the user profile inside the transaction so the org-match check
        // is consistent with the seat decrement.
        const [member, userDoc] = await Promise.all([
            tx.get(memberRef),
            tx.get(userRef),
        ]);

        if (!member.exists) {
            // Not a member of this org — do NOT mutate their profile/claims.
            return false;
        }
        if (member.data()?.role === 'admin') throw new Error('Cannot remove admin');

        tx.delete(memberRef);
        tx.update(orgRef, { usedSeats: FieldValue.increment(-1), updatedAt: new Date() });

        // Only downgrade the profile if it actually points at this org.
        const belongsToOrg = userDoc.exists && userDoc.data()?.organizationId === orgId;
        if (belongsToOrg) {
            tx.update(userRef, {
                organizationId: FieldValue.delete(),
                planType: 'free',
                planSource: 'self',
                updatedAt: new Date(),
            });
        }
        return belongsToOrg;
    });

    // Reset claims and access only when we actually downgraded this user's
    // profile. The org claims are removed explicitly (merge semantics), and
    // access falls back to the account's base state: `legacy` if it predates
    // the gate, otherwise `pending`.
    if (removed) {
        await returnMemberToBaseAccess(userId, {
            actor: 'system:org-remove',
            reason: `removed from organization ${orgId}`,
            orgId,
        });
    }
}

/** Get org details with member list. */
export async function getOrganizationWithMembers(orgId: string) {
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);

    const [orgDoc, membersSnap] = await Promise.all([
        orgRef.get(),
        orgRef.collection('members').get(),
    ]);

    if (!orgDoc.exists) return null;

    const members = membersSnap.docs.map(doc => ({
        ...(doc.data() as OrgMember),
        userId: doc.id,
    }));

    return {
        ...(orgDoc.data() as Organization),
        id: orgDoc.id,
        members,
    };
}
