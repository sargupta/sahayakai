import 'server-only';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import {
    accessGrantForOrganization,
    organizationStatus,
    type Organization,
} from '@/lib/organization';
import { mergeCustomClaims, setAccessState } from './access-admin';
import { isAccessState, type AccessState } from './access-state';
import { AccessHttpError, addDays, clampDays, isSafeDocId, toDateOrNull, toIso } from './route-helpers';
import { EVALUATION_TERMS_VERSION } from './terms';

/**
 * School join links.
 *
 * Teachers sign in with personal Google accounts, so a school cannot be
 * verified by email domain and the older phone-number invites never matched
 * anything. Instead the school admin creates a link and shares it with staff.
 * A link is a bearer secret bounded three ways: it expires, it has a use cap
 * that can never exceed the school's free seats, and it can be revoked.
 *
 * Code format: `${orgId}.${token}` where token is 32 random bytes,
 * base64url. Only sha256(token) is stored, so reading Firestore (or a
 * backup) does not let anyone join.
 *
 * Design: docs/ACCESS_GATE_DESIGN.md
 */

export const DEFAULT_LINK_DAYS = 14;
export const MAX_LINK_DAYS = 60;

export interface JoinLinkView {
    id: string;
    createdAt: string | null;
    expiresAt: string | null;
    maxUses: number;
    uses: number;
    revoked: boolean;
}

export function hashJoinToken(token: string): string {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests. */
function digestsEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

/** Split a code into its parts, or null when it is not well formed. */
export function parseJoinCode(code: unknown): { orgId: string; token: string } | null {
    if (typeof code !== 'string' || code.length > 256) return null;
    const dot = code.indexOf('.');
    if (dot <= 0) return null;
    const orgId = code.slice(0, dot);
    const token = code.slice(dot + 1);
    if (!isSafeDocId(orgId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return { orgId, token };
}

/**
 * Create a join link. `maxUses` defaults to the school's remaining seats and
 * is clamped to them; with no seats left there is nothing to hand out (409).
 * The plaintext code is returned once and never stored.
 */
export async function createJoinLink(params: {
    orgId: string;
    createdBy: string;
    maxUses?: unknown;
    expiresInDays?: unknown;
    now?: Date;
}): Promise<{ id: string; code: string; expiresAt: Date; maxUses: number }> {
    const now = params.now ?? new Date();
    const db = await getDb();
    const orgRef = db.collection('organizations').doc(params.orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new AccessHttpError(404, 'Organization not found');
    const org = orgSnap.data() as Organization;

    if (!accessGrantForOrganization(org, now)) {
        throw new AccessHttpError(409, 'This school\'s access has ended. Contact SahayakAI to extend it.', 'ORG_EXPIRED');
    }
    const remaining = Math.max(0, (org.totalSeats ?? 0) - (org.usedSeats ?? 0));
    if (remaining < 1) {
        throw new AccessHttpError(409, 'All seats are in use. Increase your seat count to invite more teachers.', 'NO_SEATS');
    }
    const requested =
        typeof params.maxUses === 'number' && Number.isFinite(params.maxUses) && params.maxUses >= 1
            ? Math.floor(params.maxUses)
            : remaining;
    const maxUses = Math.min(requested, remaining);
    const expiresAt = addDays(now, clampDays(params.expiresInDays, DEFAULT_LINK_DAYS, MAX_LINK_DAYS));

    const token = crypto.randomBytes(32).toString('base64url');
    const linkRef = orgRef.collection('joinLinks').doc();
    await linkRef.set({
        tokenHash: hashJoinToken(token),
        createdBy: params.createdBy,
        createdAt: now,
        expiresAt,
        maxUses,
        uses: 0,
        revoked: false,
    });
    logger.info('Join link created', 'ACCESS', { orgId: params.orgId, linkId: linkRef.id, maxUses });
    return { id: linkRef.id, code: `${params.orgId}.${token}`, expiresAt, maxUses };
}

/** Newest first. The token hash is never returned. */
export async function listJoinLinks(orgId: string): Promise<JoinLinkView[]> {
    const db = await getDb();
    const snap = await db
        .collection('organizations')
        .doc(orgId)
        .collection('joinLinks')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
    return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
            id: d.id,
            createdAt: toIso(data.createdAt),
            expiresAt: toIso(data.expiresAt),
            maxUses: typeof data.maxUses === 'number' ? data.maxUses : 0,
            uses: typeof data.uses === 'number' ? data.uses : 0,
            revoked: data.revoked === true,
        };
    });
}

export async function revokeJoinLink(orgId: string, linkId: string, actor: string): Promise<void> {
    if (!isSafeDocId(linkId)) throw new AccessHttpError(404, 'Join link not found');
    const db = await getDb();
    const ref = db.collection('organizations').doc(orgId).collection('joinLinks').doc(linkId);
    const snap = await ref.get();
    if (!snap.exists) throw new AccessHttpError(404, 'Join link not found');
    await ref.update({ revoked: true, revokedAt: new Date(), revokedBy: actor });
    logger.info('Join link revoked', 'ACCESS', { orgId, linkId });
}

export interface RedeemResult {
    orgId: string;
    orgName: string;
    state: AccessState;
    expiresAt: Date | null;
    /** False when the caller was already a member (idempotent replay). */
    joined: boolean;
}

const INVALID_LINK = () => new AccessHttpError(404, 'This join link is not valid', 'LINK_INVALID');

/**
 * Redeem a join code for the signed-in user.
 *
 * Everything that decides membership happens in ONE transaction: the link is
 * valid, unrevoked, unexpired and under its use cap; the school is not
 * expired and has a free seat; the user is not blocked and not a member of
 * another school. The member document, seat count, link use count and user
 * profile are written in that same transaction, so two teachers racing for
 * the last seat cannot both win.
 *
 * Claims and the access state are applied after the commit. They are
 * idempotent, and an already-member replay re-applies them, so a failure
 * between commit and claim write heals on the teacher's next attempt.
 *
 * Errors follow the API contract: 404 invalid or revoked, 410 expired,
 * 409 no seats or member of another school.
 */
export async function redeemJoinLink(params: {
    code: unknown;
    uid: string;
    acceptTerms: unknown;
    now?: Date;
}): Promise<RedeemResult> {
    if (params.acceptTerms !== true) {
        throw new AccessHttpError(400, 'You must accept the evaluation terms', 'VALIDATION_FAILED');
    }
    const parsed = parseJoinCode(params.code);
    if (!parsed) throw INVALID_LINK();
    const { orgId, token } = parsed;
    const { uid } = params;
    const now = params.now ?? new Date();
    const tokenHash = hashJoinToken(token);

    const db = await getDb();
    const orgRef = db.collection('organizations').doc(orgId);
    const userRef = db.collection('users').doc(uid);
    const memberRef = orgRef.collection('members').doc(uid);
    const linkQuery = orgRef.collection('joinLinks').where('tokenHash', '==', tokenHash).limit(1);

    const outcome = await db.runTransaction(async (tx) => {
        const [orgSnap, userSnap, memberSnap, linkSnap] = await Promise.all([
            tx.get(orgRef),
            tx.get(userRef),
            tx.get(memberRef),
            tx.get(linkQuery),
        ]);

        if (!orgSnap.exists || linkSnap.empty) throw INVALID_LINK();
        const linkDoc = linkSnap.docs[0];
        const link = linkDoc.data() as Record<string, unknown>;
        if (typeof link.tokenHash !== 'string' || !digestsEqual(link.tokenHash, tokenHash)) throw INVALID_LINK();
        if (link.revoked === true) throw INVALID_LINK();

        const org = orgSnap.data() as Organization;
        const grant = accessGrantForOrganization(org, now);
        if (!grant) {
            throw new AccessHttpError(
                410,
                organizationStatus(org) === 'pilot'
                    ? 'This school\'s evaluation period has ended'
                    : 'This school\'s access has ended',
                'ORG_EXPIRED',
            );
        }

        const user = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
        if (user.accessState === 'blocked') {
            throw new AccessHttpError(403, 'This account cannot join a school', 'ACCOUNT_BLOCKED');
        }
        const currentOrg = typeof user.organizationId === 'string' ? user.organizationId : null;
        if (currentOrg && currentOrg !== orgId) {
            throw new AccessHttpError(409, 'This account already belongs to another school', 'OTHER_ORG');
        }

        // Idempotent replay: already a member of THIS school. Consume nothing.
        if (memberSnap.exists) {
            return { org, grant, joined: false };
        }

        const linkExpiry = toDateOrNull(link.expiresAt);
        if (!linkExpiry || linkExpiry.getTime() <= now.getTime()) {
            throw new AccessHttpError(410, 'This join link has expired', 'LINK_EXPIRED');
        }
        const uses = typeof link.uses === 'number' ? link.uses : 0;
        const maxUses = typeof link.maxUses === 'number' ? link.maxUses : 0;
        if (uses >= maxUses) {
            throw new AccessHttpError(409, 'This join link has been fully used', 'LINK_EXHAUSTED');
        }
        if ((org.usedSeats ?? 0) >= (org.totalSeats ?? 0)) {
            throw new AccessHttpError(409, 'This school has no seats left', 'NO_SEATS');
        }

        tx.set(memberRef, {
            userId: uid,
            role: 'teacher',
            joinedAt: now,
            invitedBy: typeof link.createdBy === 'string' ? link.createdBy : 'join-link',
            joinLinkId: linkDoc.id,
            termsVersion: EVALUATION_TERMS_VERSION,
            termsAcceptedAt: now,
        });
        tx.update(orgRef, { usedSeats: FieldValue.increment(1), updatedAt: now });
        tx.update(linkDoc.ref, { uses: FieldValue.increment(1), lastUsedAt: now });
        tx.set(
            userRef,
            { organizationId: orgId, planType: org.plan, planSource: 'organization', updatedAt: now },
            { merge: true },
        );
        return { org, grant, joined: true };
    });

    // Post-commit, idempotent: claims (merged) then access state. On a
    // replay keep whatever role the member already holds (a school admin
    // opening their own link must not be demoted to teacher).
    let orgRole: 'admin' | 'teacher' = 'teacher';
    if (!outcome.joined) {
        const member = await memberRef.get();
        if (member.data()?.role === 'admin') orgRole = 'admin';
    }
    await mergeCustomClaims(uid, { planType: outcome.org.plan, orgId, orgRole });

    // On a replay, re-apply the school's grant only when the current state
    // was set by the system. If an administrator changed this member's access
    // by hand (for example back to `pending`), an old join link must not be a
    // way to undo that decision.
    if (!outcome.joined) {
        const userNow = (await userRef.get()).data() as Record<string, unknown> | undefined;
        const updatedBy = typeof userNow?.accessUpdatedBy === 'string' ? userNow.accessUpdatedBy : '';
        const adminDecided = updatedBy !== '' && !updatedBy.startsWith('system:');
        if (adminDecided && isAccessState(userNow?.accessState)) {
            return {
                joined: false,
                orgId,
                orgName: outcome.org.name,
                state: userNow.accessState,
                expiresAt: toDateOrNull(userNow.accessExpiresAt),
            };
        }
    }
    await setAccessState(uid, outcome.grant.state, {
        expiresAt: outcome.grant.expiresAt,
        actor: 'system:join-link',
        reason: outcome.joined ? `joined organization ${orgId} by link` : `re-synced membership of organization ${orgId}`,
        orgId,
    });

    if (outcome.joined) logger.info('Teacher joined organization by link', 'ACCESS', { uid, orgId });
    return {
        orgId,
        orgName: outcome.org.name,
        state: outcome.grant.state,
        expiresAt: outcome.grant.expiresAt,
        joined: outcome.joined,
    };
}
