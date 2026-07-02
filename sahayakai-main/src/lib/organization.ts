import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Organization management for B2B school billing.
 *
 * Schema:
 *   organizations/{orgId}
 *     - name, type, adminUserId, plan, subscriptionId, totalSeats, usedSeats
 *   organizations/{orgId}/members/{userId}
 *     - role: 'admin' | 'teacher', joinedAt, invitedBy
 *   organizations/{orgId}/invites/{inviteId}
 *     - phone, role, status, createdAt, expiresAt
 */

export interface Organization {
    id: string;
    name: string;
    type: 'school' | 'chain' | 'government';
    adminUserId: string;
    plan: 'gold' | 'premium';
    subscriptionId?: string;
    totalSeats: number;
    usedSeats: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrgMember {
    userId: string;
    role: 'admin' | 'teacher';
    joinedAt: Date;
    invitedBy: string;
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
    if (params.grantPlanToAdmin && params.razorpayPaymentId) {
        try {
            const { getRazorpay } = await import('./razorpay');
            const payment = await getRazorpay().payments.fetch(params.razorpayPaymentId);
            const amount = typeof payment?.amount === 'string'
                ? parseInt(payment.amount, 10)
                : (payment?.amount ?? 0);
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

    if (paymentVerified) {
        // Update user profile with org ID and grant the plan
        await db.collection('users').doc(params.adminUserId).update({
            organizationId: orgRef.id,
            planType: params.plan,
            planSource: 'organization',
            updatedAt: new Date(),
        });

        // Set custom claim
        const { getAuth } = await import('firebase-admin/auth');
        await getAuth().setCustomUserClaims(params.adminUserId, {
            planType: params.plan,
            orgId: orgRef.id,
            orgRole: 'admin',
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

    const { getAuth } = await import('firebase-admin/auth');
    await getAuth().setCustomUserClaims(userId, {
        planType: org.plan,
        orgId,
        orgRole: 'teacher',
    });
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

    // Reset custom claims only when we actually downgraded this user's profile.
    if (removed) {
        const { getAuth } = await import('firebase-admin/auth');
        await getAuth().setCustomUserClaims(userId, { planType: 'free' });
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
