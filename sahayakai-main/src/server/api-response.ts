/**
 * Shared error → HTTP response mapping for the community/groups API routes
 * (tranche 5, docs/API_MIGRATION_PATTERN.md step 5).
 *
 * The domain services throw:
 *   - ForbiddenError (auth-helpers) for authorization failures,
 *   - plain Errors with deliberate, user-facing messages for validation /
 *     domain failures ('Cannot like your own post', 'Group not found', …).
 *
 * Client components historically surfaced `err.message` from the server
 * action in toasts, so those curated messages must survive the migration —
 * they are matched by pattern below and echoed back with an appropriate
 * status. Anything unrecognized is an internal error: return an opaque 500
 * and let the service-level logger keep the details server-side.
 */
import { NextResponse } from 'next/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth-helpers';

/** Curated domain-error messages that are safe to echo to the client. */
const BAD_REQUEST_PATTERNS: RegExp[] = [
    /^content /i,
    /^invalid /i,
    /^imageurl /i,
    /^message /i,
    /^post content /i,
    /^too many attachments$/i,
    /cannot be empty/i,
    /too long/i,
    /^no content found to share/i,
    /already shared/i,
];

const FORBIDDEN_PATTERNS: RegExp[] = [
    /^not a member of this group$/i,
    /^cannot follow yourself$/i,
    /^cannot like your own/i,
    /^forbidden/i,
];

const NOT_FOUND_PATTERNS: RegExp[] = [
    /not found/i,
];

const RATE_LIMIT_PATTERNS: RegExp[] = [
    /^rate limit exceeded/i,
    /^daily image limit reached/i,
];

export function errorResponse(err: unknown): NextResponse {
    if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: err.message || 'Forbidden' }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : '';
    if (message) {
        if (RATE_LIMIT_PATTERNS.some((p) => p.test(message))) {
            return NextResponse.json({ error: message }, { status: 429 });
        }
        if (FORBIDDEN_PATTERNS.some((p) => p.test(message))) {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        if (NOT_FOUND_PATTERNS.some((p) => p.test(message))) {
            return NextResponse.json({ error: message }, { status: 404 });
        }
        if (BAD_REQUEST_PATTERNS.some((p) => p.test(message))) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
    }
    // Unrecognized → internal. Never leak raw driver/Firestore errors.
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
