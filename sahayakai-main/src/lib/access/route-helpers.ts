import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-utils';
import { clientAddress } from '@/lib/client-address';
import { getDb } from '@/lib/firebase-admin';

/**
 * Shared plumbing for the access-gate API routes: caller identity,
 * authorisation, and small input helpers. Identity always comes from the
 * `x-user-*` headers, which only the middleware can set (it strips inbound
 * copies and re-derives them from the verified Firebase ID token).
 */

/** An error a route can turn into an HTTP response without leaking internals. */
export class AccessHttpError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'AccessHttpError';
    }
}

export function errorResponse(status: number, error: string, code?: string): NextResponse {
    return NextResponse.json(code ? { error, code } : { error }, { status });
}

/**
 * Map a thrown value to the contract error shape. Unknown errors become a
 * generic 500; their message is never sent to the client.
 */
export function toErrorResponse(err: unknown, logPrefix: string): NextResponse {
    if (err instanceof AccessHttpError) {
        return errorResponse(err.status, err.message, err.code);
    }
    console.error(`${logPrefix} unexpected error:`, err instanceof Error ? err.message : err);
    return errorResponse(500, 'Internal error');
}

export function callerUid(request: Request): string | null {
    const uid = request.headers.get('x-user-id');
    return uid && uid.length > 0 ? uid : null;
}

/** Resolve the caller and require SahayakAI administrator rights. */
export async function requireSahayakAdmin(request: Request): Promise<string> {
    const uid = callerUid(request);
    if (!uid) throw new AccessHttpError(401, 'Unauthorized');
    if (!(await isAdmin(uid))) throw new AccessHttpError(403, 'Forbidden');
    return uid;
}

/**
 * Resolve the caller and require that they administer `orgId`: either the
 * school's own admin (members/{uid}.role === 'admin') or a SahayakAI admin.
 */
export async function requireOrgAdmin(request: Request, orgId: string): Promise<string> {
    const uid = callerUid(request);
    if (!uid) throw new AccessHttpError(401, 'Unauthorized');
    if (!isSafeDocId(orgId)) throw new AccessHttpError(404, 'Organization not found');

    const db = await getDb();
    const member = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
    if (member.exists && member.data()?.role === 'admin') return uid;
    if (await isAdmin(uid)) return uid;
    throw new AccessHttpError(403, 'Forbidden');
}

/** Firestore document ids we accept from a URL or body (no slashes, bounded). */
export function isSafeDocId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Parse a positive whole number of days, falling back and clamping. */
export function clampDays(value: unknown, fallback: number, max: number): number {
    const n = typeof value === 'number' ? value : Number.NaN;
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(Math.floor(n), max);
}

export function addDays(from: Date, days: number): Date {
    return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Read a JSON object body; anything else is a 400. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AccessHttpError(400, 'Invalid JSON body');
    }
    return body as Record<string, unknown>;
}

/** Firestore Timestamp | Date | ISO string -> ISO string (or null). */
export function toIso(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
}

/** Firestore Timestamp | Date | ISO string -> Date (or null). */
export function toDateOrNull(value: unknown): Date | null {
    const iso = toIso(value);
    return iso ? new Date(iso) : null;
}

/**
 * The caller's address for rate limiting. Delegates to the one shared helper
 * (src/lib/client-address.ts), which ignores client-supplied X-Forwarded-For
 * entries and our own load balancer's addresses.
 */
export function clientIp(request: Request): string {
    return clientAddress(request);
}
