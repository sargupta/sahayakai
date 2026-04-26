/**
 * Centralised auth + group-membership guards for server actions.
 *
 * Background: middleware injects `x-user-id` after verifying the Firebase ID
 * token. Every server action that touches user data must derive uid from this
 * header — never from a client-supplied parameter.
 *
 * Promotes the inline `getAuthUserId()` pattern previously duplicated across
 * connections.ts / groups.ts / messages.ts into one source of truth.
 */
import { headers } from 'next/headers';
import { getDb } from '@/lib/firebase-admin';

export class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

/**
 * Extract the authenticated user id from the middleware-injected header.
 * Throws UnauthorizedError if the header is missing.
 */
export async function requireAuth(): Promise<string> {
    const h = await headers();
    const uid = h.get('x-user-id');
    if (!uid) throw new UnauthorizedError();
    return uid;
}

/**
 * Boolean variant — does NOT throw. Returns null if unauthenticated.
 * Use when an action has both authed and anonymous read paths.
 */
export async function getAuthUserIdOrNull(): Promise<string | null> {
    const h = await headers();
    return h.get('x-user-id') ?? null;
}

/**
 * Check group membership without throwing. Reads the members subcollection.
 */
export async function isGroupMember(groupId: string, uid: string): Promise<boolean> {
    if (!groupId || !uid) return false;
    const db = await getDb();
    const memberSnap = await db
        .collection('groups')
        .doc(groupId)
        .collection('members')
        .doc(uid)
        .get();
    return memberSnap.exists;
}

/**
 * Assert membership and return the uid. Throws ForbiddenError if the caller
 * is authenticated but not a member, UnauthorizedError if unauthenticated.
 *
 * Pass `uid` to skip the requireAuth() lookup (useful when the caller already
 * has it in scope).
 */
export async function requireGroupMember(groupId: string, uid?: string): Promise<string> {
    const callerId = uid ?? (await requireAuth());
    const member = await isGroupMember(groupId, callerId);
    if (!member) throw new ForbiddenError('Not a member of this group');
    return callerId;
}
