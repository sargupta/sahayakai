import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { setAccessState } from './access-admin';
import { AccessHttpError, addDays, clampDays, toIso } from './route-helpers';
import { EVALUATION_TERMS_VERSION } from './terms';

/**
 * Access requests: a signed-in but not-yet-entitled account asks to be let
 * in, and a SahayakAI administrator approves or rejects after verifying the
 * school. One document per account, `access_requests/{uid}`.
 *
 * Design: docs/ACCESS_GATE_DESIGN.md
 */

export const ACCESS_REQUESTS_COLLECTION = 'access_requests';

export const ACCESS_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

/** Pilot length when the administrator does not specify one, and its ceiling. */
export const DEFAULT_PILOT_DAYS = 14;
export const MAX_PILOT_DAYS = 90;
/** Ceiling for an optional expiry on an `active` grant. */
export const MAX_ACTIVE_DAYS = 400;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
    z.preprocess(
        (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
        z.string().trim().max(max).optional(),
    );

/**
 * Phone numbers are stored as typed (digits, spaces, +, -, brackets). We only
 * bound the shape; the administrator calls the school's listed landline to
 * verify, not this number.
 */
const phone = z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^\+?[0-9][0-9\s()-]{5,18}[0-9]$/, 'Enter a valid phone number');

export const accessRequestInputSchema = z.object({
    schoolName: text(160),
    role: text(80),
    board: text(60),
    affiliationNumber: optionalText(40),
    city: text(80),
    state: text(80),
    phone,
    teacherCount: z.number().int().min(1).max(100_000).optional(),
    message: optionalText(1000),
    acceptTerms: z.literal(true),
});
export type AccessRequestInput = z.infer<typeof accessRequestInputSchema>;

/** The shape returned to the requester and to administrators. */
export interface AccessRequestView {
    uid: string;
    email: string | null;
    displayName: string | null;
    schoolName: string;
    role: string;
    board: string;
    affiliationNumber: string | null;
    city: string;
    state: string;
    phone: string;
    teacherCount: number | null;
    message: string | null;
    termsVersion: string;
    termsAcceptedAt: string | null;
    status: AccessRequestStatus;
    createdAt: string | null;
    updatedAt: string | null;
    decidedAt: string | null;
    decidedBy: string | null;
    decisionNote: string | null;
    grantedState: 'pilot' | 'active' | null;
    grantedExpiresAt: string | null;
}

function toView(uid: string, data: Record<string, unknown>): AccessRequestView {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
    const status = (ACCESS_REQUEST_STATUSES as readonly string[]).includes(str(data.status))
        ? (data.status as AccessRequestStatus)
        : 'pending';
    return {
        uid,
        email: strOrNull(data.email),
        displayName: strOrNull(data.displayName),
        schoolName: str(data.schoolName),
        role: str(data.role),
        board: str(data.board),
        affiliationNumber: strOrNull(data.affiliationNumber),
        city: str(data.city),
        state: str(data.state),
        phone: str(data.phone),
        teacherCount: typeof data.teacherCount === 'number' ? data.teacherCount : null,
        message: strOrNull(data.message),
        termsVersion: str(data.termsVersion),
        termsAcceptedAt: toIso(data.termsAcceptedAt),
        status,
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        decidedAt: toIso(data.decidedAt),
        decidedBy: strOrNull(data.decidedBy),
        decisionNote: strOrNull(data.decisionNote),
        grantedState: data.grantedState === 'pilot' || data.grantedState === 'active' ? data.grantedState : null,
        grantedExpiresAt: toIso(data.grantedExpiresAt),
    };
}

/** Parse and validate a request body. Throws a 400 with the first problem. */
export function parseAccessRequestInput(body: unknown): AccessRequestInput {
    const parsed = accessRequestInputSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue?.path.join('.') || 'body';
        const message =
            field === 'acceptTerms'
                ? 'You must accept the evaluation terms'
                : `Invalid ${field}: ${issue?.message ?? 'invalid value'}`;
        throw new AccessHttpError(400, message, 'VALIDATION_FAILED');
    }
    return parsed.data;
}

/**
 * Create or update the caller's request. Identity (email, name) comes from
 * the verified token headers, never from the body. Re-submission is allowed
 * while the request is still pending. Once decided it is immutable to the
 * requester (409), with one exception: an APPROVED request whose grant has
 * since lapsed (the account is back to `pending`) may be submitted again, so
 * a teacher whose pilot ended is not left with no way to ask.
 */
export async function submitAccessRequest(params: {
    uid: string;
    email: string | null;
    displayName: string | null;
    input: AccessRequestInput;
    now?: Date;
}): Promise<{ status: 'pending' }> {
    const { uid, input } = params;
    const now = params.now ?? new Date();
    const db = await getDb();
    const ref = db.collection(ACCESS_REQUESTS_COLLECTION).doc(uid);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.exists ? (snap.data() as Record<string, unknown>) : null;
        let renewal = false;
        if (existing && existing.status !== 'pending') {
            const userSnap = await tx.get(db.collection('users').doc(uid));
            const accessState = userSnap.exists ? (userSnap.data() as Record<string, unknown>).accessState : undefined;
            renewal = existing.status === 'approved' && accessState === 'pending';
            if (!renewal) {
                throw new AccessHttpError(409, 'This request has already been decided', 'REQUEST_DECIDED');
            }
        }
        tx.set(
            ref,
            {
                uid,
                email: params.email,
                displayName: params.displayName,
                schoolName: input.schoolName,
                schoolNormalized: input.schoolName.toUpperCase(),
                role: input.role,
                board: input.board,
                affiliationNumber: input.affiliationNumber ?? null,
                city: input.city,
                state: input.state,
                phone: input.phone,
                teacherCount: input.teacherCount ?? null,
                message: input.message ?? null,
                termsVersion: EVALUATION_TERMS_VERSION,
                termsAcceptedAt: now,
                status: 'pending',
                // A renewal is a new request for the review queue; the earlier
                // decision stays on record in `previousDecision`.
                createdAt: renewal ? now : existing?.createdAt ?? now,
                updatedAt: now,
                ...(renewal
                    ? {
                          previousDecision: {
                              status: existing?.status ?? null,
                              decidedAt: existing?.decidedAt ?? null,
                              decidedBy: existing?.decidedBy ?? null,
                              grantedState: existing?.grantedState ?? null,
                              grantedExpiresAt: existing?.grantedExpiresAt ?? null,
                          },
                          decidedAt: null,
                          decidedBy: null,
                          decisionNote: null,
                          grantedState: null,
                          grantedExpiresAt: null,
                      }
                    : {}),
            },
            { merge: true },
        );
    });

    logger.info('Access request submitted', 'ACCESS', { uid });
    return { status: 'pending' };
}

export async function getAccessRequest(uid: string): Promise<AccessRequestView | null> {
    const db = await getDb();
    const snap = await db.collection(ACCESS_REQUESTS_COLLECTION).doc(uid).get();
    return snap.exists ? toView(uid, snap.data() as Record<string, unknown>) : null;
}

export function isAccessRequestStatus(value: unknown): value is AccessRequestStatus {
    return typeof value === 'string' && (ACCESS_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Newest first. Needs the (status ASC, createdAt DESC) composite index. */
export async function listAccessRequests(
    status: AccessRequestStatus,
    limit = 100,
): Promise<AccessRequestView[]> {
    const db = await getDb();
    const snap = await db
        .collection(ACCESS_REQUESTS_COLLECTION)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(Math.max(limit, 1), 200))
        .get();
    return snap.docs.map((d) => toView(d.id, d.data() as Record<string, unknown>));
}

export interface AccessDecisionInput {
    uid: string;
    decision: 'approve' | 'reject';
    /** Approve only. Defaults to `pilot`. */
    state?: 'pilot' | 'active';
    /** Approve only. Required semantics: pilot always expires (default 14, cap 90). */
    expiresInDays?: unknown;
    note?: string;
    /** uid of the deciding administrator. */
    actor: string;
    now?: Date;
}

/**
 * Record an administrator's decision. Approval changes the account's access
 * state; rejection leaves it where it was (pending) and only records the
 * decision. A request can be decided once; deciding again is a 409 so two
 * administrators cannot silently overwrite each other.
 */
export async function decideAccessRequest(
    input: AccessDecisionInput,
): Promise<{ status: AccessRequestStatus; grantedState: 'pilot' | 'active' | null; grantedExpiresAt: Date | null }> {
    const now = input.now ?? new Date();
    const db = await getDb();
    const ref = db.collection(ACCESS_REQUESTS_COLLECTION).doc(input.uid);
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) : '';

    const grantedState: 'pilot' | 'active' | null =
        input.decision === 'approve' ? (input.state === 'active' ? 'active' : 'pilot') : null;
    let grantedExpiresAt: Date | null = null;
    if (grantedState === 'pilot') {
        grantedExpiresAt = addDays(now, clampDays(input.expiresInDays, DEFAULT_PILOT_DAYS, MAX_PILOT_DAYS));
    } else if (grantedState === 'active' && input.expiresInDays !== undefined && input.expiresInDays !== null) {
        const days = clampDays(input.expiresInDays, 0, MAX_ACTIVE_DAYS);
        grantedExpiresAt = days > 0 ? addDays(now, days) : null;
    }
    const status: AccessRequestStatus = input.decision === 'approve' ? 'approved' : 'rejected';

    // Claim the decision first so a concurrent second decision loses cleanly.
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new AccessHttpError(404, 'Access request not found');
        if ((snap.data() as Record<string, unknown>).status !== 'pending') {
            throw new AccessHttpError(409, 'This request has already been decided', 'REQUEST_DECIDED');
        }
        tx.update(ref, {
            status,
            decidedAt: now,
            decidedBy: input.actor,
            decisionNote: note || null,
            grantedState,
            grantedExpiresAt,
            updatedAt: now,
        });
    });

    if (grantedState) {
        try {
            await setAccessState(input.uid, grantedState, {
                expiresAt: grantedExpiresAt,
                actor: input.actor,
                reason: `access request approved${note ? `: ${note.slice(0, 200)}` : ''}`,
            });
        } catch (err) {
            // The grant did not land. Reopen the request so the administrator
            // can retry instead of leaving an "approved" row with no access.
            await ref
                .update({ status: 'pending', decidedAt: null, decidedBy: null, grantedState: null, grantedExpiresAt: null, updatedAt: new Date() })
                .catch(() => undefined);
            logger.error('Access grant failed after approval; request reopened', err, 'ACCESS', { uid: input.uid });
            throw err;
        }
    }

    logger.info('Access request decided', 'ACCESS', { uid: input.uid, status, grantedState, actor: input.actor });
    return { status, grantedState, grantedExpiresAt };
}
