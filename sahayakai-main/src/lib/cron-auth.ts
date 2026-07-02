import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * Shared, timing-safe CRON_SECRET verification for scheduler / internal-job
 * endpoints. Fails closed: if CRON_SECRET is unset the request is rejected.
 *
 * Uses crypto.timingSafeEqual (constant-time) instead of `!==` string
 * comparison, which leaks secret length/prefix via response timing.
 */
export function verifyCronSecret(request: Request): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return false;

    const authHeader = request.headers.get('authorization') ?? '';
    const expected = `Bearer ${cronSecret}`;

    const a = Buffer.from(authHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false; // length is not secret
    return timingSafeEqual(a, b);
}

/**
 * Convenience guard for route handlers. Returns a NextResponse to short-circuit
 * with (503 if the secret is unconfigured, 401 if the bearer is wrong/missing),
 * or `null` when the caller is authorized and the handler may proceed.
 */
export function requireCronAuth(request: Request): NextResponse | null {
    if (!process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (!verifyCronSecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}
