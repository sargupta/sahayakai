import 'server-only';
import { getAuthInstance, getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import {
    ACCESS_CLAIM,
    ACCESS_EXP_CLAIM,
    evaluateAccess,
    isAccessState,
    parseLegacyCutoff,
    type AccessDecision,
    type AccessState,
} from './access-state';

/**
 * Access gate: server-side source of truth and mutation.
 *
 * Source of truth  users/{uid}.accessState (+ accessExpiresAt). These fields
 *                  are in firestore.rules `protectedUserFields()`, so only
 *                  Admin-SDK code can write them.
 * Cache            Firebase custom claims `access` / `accessExp`, read by the
 *                  middleware with zero I/O.
 * Audit            access_audit/{autoId}, append-only, one doc per change.
 *
 * Runbook: docs/ACCESS_GATE_RUNBOOK.md
 */

export const ACCESS_AUDIT_COLLECTION = 'access_audit';

/** The slice of the Admin Auth API that claim merging needs. */
export interface ClaimsAuth {
    getUser(uid: string): Promise<{ customClaims?: Record<string, unknown> | null }>;
    setCustomUserClaims(uid: string, claims: Record<string, unknown> | null): Promise<void>;
}

/** Firebase rejects custom-claim payloads above 1000 bytes. */
const CLAIMS_BYTE_LIMIT = 1000;

/**
 * Merge a patch into a user's custom claims.
 *
 * `setCustomUserClaims` REPLACES the whole claim set, so a bare
 * `setCustomUserClaims(uid, { planType })` silently drops `access`, `orgId`,
 * `onboardingCompleted`, and so on. Every claim write in this codebase must
 * go through this helper. A `null` or `undefined` value removes the key.
 *
 * Returns the claim set that was written.
 */
export async function mergeCustomClaims(
    uid: string,
    patch: Record<string, unknown>,
    /** Pass an already-resolved Admin Auth instance to reuse it. */
    authOverride?: ClaimsAuth,
): Promise<Record<string, unknown>> {
    if (!uid) throw new Error('mergeCustomClaims: uid is required');
    const auth: ClaimsAuth = authOverride ?? (await getAuthInstance());
    const existing = ((await auth.getUser(uid)).customClaims ?? {}) as Record<string, unknown>;

    const next: Record<string, unknown> = { ...existing };
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) {
            if (key in next) {
                delete next[key];
                changed = true;
            }
        } else if (next[key] !== value) {
            next[key] = value;
            changed = true;
        }
    }
    if (!changed) return existing;

    const size = Buffer.byteLength(JSON.stringify(next), 'utf8');
    if (size > CLAIMS_BYTE_LIMIT) {
        throw new Error(`mergeCustomClaims: claims for ${uid} would be ${size} bytes (limit ${CLAIMS_BYTE_LIMIT})`);
    }
    await auth.setCustomUserClaims(uid, next);
    return next;
}

/**
 * Accounts created before this instant are `legacy`. Set ACCESS_LEGACY_CUTOFF
 * to an ISO-8601 timestamp BEFORE switching the gate to enforce.
 *
 * Returns null when unset or unparseable; callers treat that as "no cutoff
 * configured" and resolve everyone to `legacy`, so a misconfiguration can
 * never lock the user base out. It is logged loudly instead.
 */
export function getLegacyCutoff(raw: string | undefined = process.env.ACCESS_LEGACY_CUTOFF): Date | null {
    return parseLegacyCutoff(raw);
}

function toDate(value: unknown): Date | null {
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

export interface ResolvedAccess {
    state: AccessState;
    expiresAt: Date | null;
    /** Where the answer came from. `default-*` means nothing was stored yet. */
    source: 'stored' | 'default-legacy' | 'default-pending' | 'default-no-cutoff';
}

/**
 * The state an account falls back to when nothing grants it more: `legacy`
 * if the Firebase Auth account predates the cutoff, otherwise `pending`.
 * Uses the Auth record's creation time, which the client cannot influence.
 */
export async function baseAccessState(uid: string): Promise<Pick<ResolvedAccess, 'state' | 'source'>> {
    const cutoff = getLegacyCutoff();
    if (!cutoff) {
        logger.error(
            'ACCESS_LEGACY_CUTOFF is not set; resolving every account to legacy',
            undefined,
            'ACCESS',
            { uid },
        );
        return { state: 'legacy', source: 'default-no-cutoff' };
    }
    const auth = await getAuthInstance();
    const record = await auth.getUser(uid);
    const created = new Date(record.metadata.creationTime);
    if (!Number.isNaN(created.getTime()) && created.getTime() < cutoff.getTime()) {
        return { state: 'legacy', source: 'default-legacy' };
    }
    return { state: 'pending', source: 'default-pending' };
}

/** Read the authoritative state for a user, deriving the default when unset. */
export async function resolveAccess(uid: string): Promise<ResolvedAccess> {
    const db = await getDb();
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
    const stored = data?.accessState;
    if (isAccessState(stored)) {
        return { state: stored, expiresAt: toDate(data?.accessExpiresAt), source: 'stored' };
    }
    const base = await baseAccessState(uid);
    return { ...base, expiresAt: null };
}

function claimPatchFor(state: AccessState, expiresAt: Date | null): Record<string, unknown> {
    return {
        [ACCESS_CLAIM]: state,
        [ACCESS_EXP_CLAIM]: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : null,
    };
}

export interface SetAccessOptions {
    /** Required for `pilot`; optional for `active`; ignored otherwise. */
    expiresAt?: Date | null;
    /** uid of the administrator, or a system actor such as `system:expiry-job`. */
    actor: string;
    reason: string;
    /** Organisation this grant derives from, when applicable. */
    orgId?: string;
}

/**
 * Set a user's access state: Firestore first (source of truth), then the
 * claim, then an audit record. If the claim write fails the error propagates;
 * the next /api/access/sync repairs the claim from Firestore.
 */
export async function setAccessState(
    uid: string,
    state: AccessState,
    options: SetAccessOptions,
): Promise<{ state: AccessState; expiresAt: Date | null }> {
    if (!uid) throw new Error('setAccessState: uid is required');
    if (!isAccessState(state)) throw new Error(`setAccessState: invalid state "${String(state)}"`);
    if (!options?.actor || !options?.reason) throw new Error('setAccessState: actor and reason are required');

    const carriesExpiry = state === 'pilot' || state === 'active';
    const expiresAt = carriesExpiry ? options.expiresAt ?? null : null;
    if (state === 'pilot' && !expiresAt) {
        throw new Error('setAccessState: a pilot requires expiresAt');
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        throw new Error('setAccessState: expiresAt is not a valid date');
    }

    const db = await getDb();
    const userRef = db.collection('users').doc(uid);
    const before = await userRef.get();
    const previous = before.exists ? (before.data() as Record<string, unknown>).accessState ?? null : null;

    await userRef.set(
        {
            accessState: state,
            accessExpiresAt: expiresAt,
            accessUpdatedAt: new Date(),
            accessUpdatedBy: options.actor,
        },
        { merge: true },
    );

    await mergeCustomClaims(uid, claimPatchFor(state, expiresAt));

    try {
        await db.collection(ACCESS_AUDIT_COLLECTION).add({
            uid,
            from: previous,
            to: state,
            expiresAt,
            actor: options.actor,
            reason: options.reason,
            orgId: options.orgId ?? null,
            at: new Date(),
        });
    } catch (err) {
        // The change itself succeeded; never fail the caller on the audit write.
        logger.error('Failed to write access audit record', err, 'ACCESS', { uid, to: state });
    }
    logger.info('Access state changed', 'ACCESS', {
        uid, from: previous, to: state, actor: options.actor, reason: options.reason,
    });
    return { state, expiresAt };
}

/** `accessUpdatedBy` marker for access that exists only because of a paid plan. */
export const PAYMENT_ACTOR = 'system:payment';

/**
 * A verified payment entitles the payer. Called from the Razorpay webhook and
 * billing reconciliation after a plan is granted, so an account created after
 * the cutoff that pays through self-serve checkout is never left paying and
 * locked out.
 *
 * Never overrides a decision: `blocked` stays blocked, and an account that is
 * already entitled (legacy, active, or an unexpired pilot) is left as it is.
 */
export async function grantPaidAccess(uid: string, reason: string): Promise<AccessState> {
    const current = await resolveAccess(uid);
    if (current.state === 'blocked') {
        logger.warn('Paid plan granted to a blocked account; access left blocked', 'ACCESS', { uid });
        return current.state;
    }
    const decision = evaluateAccess(claimPatchFor(current.state, current.expiresAt));
    if (decision.entitled && current.state !== 'pilot') {
        // Make sure the claim exists even if nothing changes in Firestore.
        if (current.source !== 'default-no-cutoff') {
            await mergeCustomClaims(uid, claimPatchFor(current.state, current.expiresAt));
        }
        return current.state;
    }
    await setAccessState(uid, 'active', { actor: PAYMENT_ACTOR, reason });
    return 'active';
}

/**
 * The paid plan ended. Access that was granted BECAUSE of the payment falls
 * back to the account's base state; access granted any other way (legacy,
 * an administrator, a school seat) is untouched.
 */
export async function revokePaidAccess(uid: string, reason: string): Promise<AccessState> {
    const db = await getDb();
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
    if (data?.accessState !== 'active' || data?.accessUpdatedBy !== PAYMENT_ACTOR) {
        return (await resolveAccess(uid)).state;
    }
    const base = await baseAccessState(uid);
    await setAccessState(uid, base.state, { actor: PAYMENT_ACTOR, reason });
    return base.state;
}

export interface SyncResult extends ResolvedAccess {
    decision: AccessDecision;
    /** True when the claim on the Auth record was rewritten. */
    claimChanged: boolean;
}

/**
 * Bring the custom claim in line with the source of truth. Idempotent and
 * safe to call on every sign-in. When nothing is stored yet, the derived
 * default is PERSISTED so later reads are a single document get and the
 * admin review screen can see the account.
 */
export async function syncAccessClaim(uid: string): Promise<SyncResult> {
    const resolved = await resolveAccess(uid);

    if (resolved.source === 'default-no-cutoff') {
        // Gate not configured. Report the answer but stamp nothing: a
        // `legacy` claim written now would outlive the moment the cutoff is
        // finally set and entitle an account that should be pending.
        return {
            ...resolved,
            decision: evaluateAccess({ [ACCESS_CLAIM]: resolved.state }),
            claimChanged: false,
        };
    }

    if (resolved.source !== 'stored') {
        const db = await getDb();
        await db.collection('users').doc(uid).set(
            {
                accessState: resolved.state,
                accessExpiresAt: null,
                accessUpdatedAt: new Date(),
                accessUpdatedBy: 'system:sync',
            },
            { merge: true },
        );
    }

    const auth = await getAuthInstance();
    const claims = ((await auth.getUser(uid)).customClaims ?? {}) as Record<string, unknown>;
    const wanted = claimPatchFor(resolved.state, resolved.expiresAt);
    const claimChanged =
        claims[ACCESS_CLAIM] !== wanted[ACCESS_CLAIM] ||
        (claims[ACCESS_EXP_CLAIM] ?? null) !== (wanted[ACCESS_EXP_CLAIM] ?? null);
    if (claimChanged) {
        await mergeCustomClaims(uid, wanted);
    }
    const decision = evaluateAccess(wanted);
    return { ...resolved, decision, claimChanged };
}
