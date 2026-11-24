import { NextResponse } from 'next/server';
import { getAuthInstance, getDb } from '@/lib/firebase-admin';
import { setAccessState } from '@/lib/access/access-admin';
import { isAccessState } from '@/lib/access/access-state';
import { DEFAULT_PILOT_DAYS, MAX_ACTIVE_DAYS, MAX_PILOT_DAYS } from '@/lib/access/requests';
import {
    addDays,
    clampDays,
    errorResponse,
    isSafeDocId,
    readJsonObject,
    requireSahayakAdmin,
    toErrorResponse,
    toIso,
} from '@/lib/access/route-helpers';

export const dynamic = 'force-dynamic';

interface AdminUserView {
    uid: string;
    email: string | null;
    displayName: string | null;
    accessState: string | null;
    accessExpiresAt: string | null;
    organizationId: string | null;
    createdAt: string | null;
}

function isAuthUserNotFound(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'auth/user-not-found';
}

/**
 * /api/admin/access/users — look up an account and set its access state by
 * hand. SahayakAI administrators only.
 *
 * GET  ?q=<email or uid> -> { users: [...] }   (exact match; zero or one result)
 * POST { uid, state, expiresInDays?, reason } -> { ok: true }
 *
 * Every change is written to access_audit with the administrator's uid and
 * the reason given, so `reason` is mandatory.
 */
export async function GET(request: Request) {
    try {
        await requireSahayakAdmin(request);
        const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
        if (q.length === 0 || q.length > 254) return errorResponse(400, 'Provide an email or uid in q');

        const auth = await getAuthInstance();
        let record;
        try {
            record = q.includes('@') ? await auth.getUserByEmail(q.toLowerCase()) : await auth.getUser(q);
        } catch (err) {
            if (isAuthUserNotFound(err) || !isSafeDocId(q)) return NextResponse.json({ users: [] });
            throw err;
        }

        const db = await getDb();
        const snap = await db.collection('users').doc(record.uid).get();
        const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
        const user: AdminUserView = {
            uid: record.uid,
            email: record.email ?? null,
            displayName: record.displayName ?? (typeof data.displayName === 'string' ? data.displayName : null),
            accessState: typeof data.accessState === 'string' ? data.accessState : null,
            accessExpiresAt: toIso(data.accessExpiresAt),
            organizationId: typeof data.organizationId === 'string' ? data.organizationId : null,
            createdAt: toIso(record.metadata.creationTime),
        };
        return NextResponse.json({ users: [user] });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/users GET]');
    }
}

export async function POST(request: Request) {
    try {
        const actor = await requireSahayakAdmin(request);
        const body = await readJsonObject(request);

        if (!isSafeDocId(body.uid)) return errorResponse(400, 'Invalid uid');
        if (!isAccessState(body.state)) return errorResponse(400, 'Invalid state');
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
        if (reason.length === 0) return errorResponse(400, 'A reason is required');
        // An administrator locking themselves out cannot undo it from the UI.
        if (body.uid === actor && (body.state === 'blocked' || body.state === 'pending')) {
            return errorResponse(400, 'You cannot remove your own access');
        }

        // Confirm the account exists before writing a users document for it.
        const auth = await getAuthInstance();
        try {
            await auth.getUser(body.uid);
        } catch (err) {
            if (isAuthUserNotFound(err)) return errorResponse(404, 'User not found');
            throw err;
        }

        const now = new Date();
        let expiresAt: Date | null = null;
        if (body.state === 'pilot') {
            expiresAt = addDays(now, clampDays(body.expiresInDays, DEFAULT_PILOT_DAYS, MAX_PILOT_DAYS));
        } else if (body.state === 'active' && body.expiresInDays !== undefined && body.expiresInDays !== null) {
            const days = clampDays(body.expiresInDays, 0, MAX_ACTIVE_DAYS);
            expiresAt = days > 0 ? addDays(now, days) : null;
        }

        await setAccessState(body.uid, body.state, { expiresAt, actor, reason: `admin: ${reason}` });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return toErrorResponse(err, '[admin/access/users POST]');
    }
}
