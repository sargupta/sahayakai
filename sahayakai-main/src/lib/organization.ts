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

/** Create a new organization. Returns the org ID. */
export async function createOrganization(params: {
    name: string;
    type: Organization['type'];
    adminUserId: string;
    plan: Organization['plan'];
    totalSeats: number;
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

    // Update user profile with org ID
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

    await db.runTransaction(async (tx) => {
        const memberRef = orgRef.collection('members').doc(userId);
        const member = await tx.get(memberRef);
        if (!member.exists) throw new Error('Member not found');
        if (member.data()?.role === 'admin') throw new Error('Cannot remove admin');

        tx.delete(memberRef);
        tx.update(orgRef, { usedSeats: FieldValue.increment(-1), updatedAt: new Date() });
    });

    // Downgrade user to free
    await db.collection('users').doc(userId).update({
        organizationId: FieldValue.delete(),
        planType: 'free',
        planSource: 'self',
        updatedAt: new Date(),
    });

    const { getAuth } = await import('firebase-admin/auth');
    await getAuth().setCustomUserClaims(userId, { planType: 'free' });
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
