/**
 * Shared error → HTTP response mapping for the API-route boundary
 * (tranche 5 — docs/API_MIGRATION_PATTERN.md).
 *
 * Service modules in src/server/* keep throwing the exact same Error
 * messages the server actions threw (the forensic tests assert on those
 * strings). Routes funnel caught errors through here so:
 *   - authz failures  → 403 (route-level missing-header is 401, handled
 *     before the service is ever called)
 *   - not-found       → 404
 *   - known client-input validation messages → 400
 *   - anything else   → 500 with a generic message (never leak internals)
 */
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Client-safe validation messages thrown by the service layer. These are the
// exact prefixes of the deliberate `throw new Error('…')` input checks that
// migrated verbatim out of src/app/actions/*.
const CLIENT_SAFE_400 = [
    /^Cannot /,          // 'Cannot message yourself', 'Cannot connect with yourself'
    /^Invalid /,         // 'Invalid audio URL', 'Invalid resource …'
    /^Audio /,           // 'Audio URL …', 'Audio duration …'
    /^Message /,         // 'Message cannot be empty', 'Message too long …'
    /^Group /,           // 'Group needs at least 2 members', …
];

export function errorResponse(err: unknown, context = 'API'): NextResponse {
    if (err instanceof Error) {
        const msg = err.message;
        // Authz: caller is authenticated (middleware set x-user-id) but not
        // allowed to act on this resource. Keep the original message strings —
        // client code and tests match on them.
        if (msg.startsWith('Unauthorized') || msg.startsWith('Forbidden') || msg === 'Not a participant') {
            return NextResponse.json({ error: msg }, { status: 403 });
        }
        if (/not found$/i.test(msg)) {
            return NextResponse.json({ error: msg }, { status: 404 });
        }
        if (CLIENT_SAFE_400.some((re) => re.test(msg))) {
            return NextResponse.json({ error: msg }, { status: 400 });
        }
    }
    logger.error('Unhandled API route error', err, context);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** 401 for requests that reached the handler without the middleware-verified header. */
export function unauthorizedResponse(): NextResponse {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
