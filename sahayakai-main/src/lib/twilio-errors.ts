/**
 * Classify a Twilio REST error into the HTTP semantics WE owe the caller.
 *
 * WHY THIS EXISTS
 *
 * On 2026-08-18 a teacher's parent call failed in production. Twilio returned
 * `20003 Authenticate` — our stored auth token had been rotated and Secret
 * Manager still held the old one. The call route collapsed that (and every
 * other Twilio failure) into a single `502 Failed to initiate call`.
 *
 * Two things went wrong because of that one status code:
 *
 *  1. 502 reads as "bad gateway, transient" — so the client retried. A 401
 *     from a rotated credential can never succeed on retry.
 *  2. The retry hit the outreach route's 5-minute per-student dedup window and
 *     came back 429. The teacher was then locked out of calling that parent for
 *     five minutes, by a failure that was entirely ours and never disturbed the
 *     parent at all.
 *
 * A misconfigured account and an unreachable parent number are different
 * events with different owners: one is an operator page, the other is
 * something the teacher can fix by correcting a phone number. Collapsing them
 * loses the distinction exactly when someone needs it.
 *
 * Codes are from https://www.twilio.com/docs/api/errors. Anything unrecognised
 * stays a 502 — the conservative default, because guessing a specific cause we
 * do not understand is worse than admitting an upstream failure.
 */

/** Who owns the failure, and therefore who can act on it. */
export type TwilioFailureCategory =
    /** Our account/credentials/number are wrong. Retrying cannot help. */
    | 'provider_unconfigured'
    /** The parent's number is bad or unreachable. The teacher can fix it. */
    | 'destination_unreachable'
    /** Twilio itself is throttling or degraded. Retrying later may help. */
    | 'provider_transient'
    /** We do not recognise this code. */
    | 'unknown';

export interface TwilioFailure {
    category: TwilioFailureCategory;
    /** The status OUR route returns. Never Twilio's own status. */
    status: number;
    /** Stable machine-readable code for clients. Never leaks Twilio detail. */
    code: string;
    /** Safe, human-readable message. Contains no account identifiers. */
    error: string;
    /** Whether the SAME request could plausibly succeed if repeated. */
    retryable: boolean;
}

/**
 * Our account, our credentials, our number. The teacher cannot fix any of
 * these and a retry burns their dedup window for nothing.
 */
const PROVIDER_UNCONFIGURED = new Set([
    20003, // Authenticate — bad/rotated auth token, or SID/token mismatch
    20005, // Account not active (closed or suspended)
    20404, // Resource not found for this account — usually a wrong SID
    21210, // 'From' number not verified for this account
    21215, // Geo permissions: this account may not dial that country
    21606, // 'From' is not a valid, voice-capable number on this account
    21659, // 'From' is not a Twilio number owned by this account
]);

/**
 * The destination number. Actionable by the teacher — correct the parent's
 * phone on the student record and try again.
 */
const DESTINATION_UNREACHABLE = new Set([
    13223, // Dial: invalid phone number format
    13224, // Dial: Twilio does not support calling this number
    21211, // Invalid 'To' phone number
    21214, // 'To' phone number cannot be reached
    21217, // Phone number does not appear to be valid
    21219, // 'To' number not verified (trial accounts)
]);

/** Twilio-side throttling or degradation. A later retry is reasonable. */
const PROVIDER_TRANSIENT = new Set([
    20429, // Too many requests
    20500, // Internal server error
    20503, // Service unavailable
]);

/**
 * @param code   Twilio's numeric `code`, if the body parsed.
 * @param status Twilio's HTTP status, used only when no code is present.
 */
export function classifyTwilioFailure(
    code: unknown,
    status?: number,
): TwilioFailure {
    const n = typeof code === 'number' ? code : Number.NaN;

    if (PROVIDER_UNCONFIGURED.has(n)) {
        return {
            category: 'provider_unconfigured',
            // 503, not 502: the upstream is reachable and answering correctly.
            // It is OUR configuration that is wrong, and this service cannot
            // place calls at all until an operator fixes it.
            status: 503,
            code: 'CALL_PROVIDER_UNCONFIGURED',
            error: 'Calling is temporarily unavailable. Our team has been notified.',
            retryable: false,
        };
    }

    if (DESTINATION_UNREACHABLE.has(n)) {
        return {
            category: 'destination_unreachable',
            status: 422,
            code: 'PARENT_NUMBER_UNREACHABLE',
            error: "This parent's phone number could not be reached. Please check the number on the student's record.",
            retryable: false,
        };
    }

    if (PROVIDER_TRANSIENT.has(n) || status === 429 || (status ?? 0) >= 500) {
        return {
            category: 'provider_transient',
            status: 502,
            code: 'CALL_PROVIDER_UNAVAILABLE',
            error: 'The calling service is busy. Please try again in a moment.',
            retryable: true,
        };
    }

    // A 401/403 with no recognised code is still, unambiguously, our auth.
    if (status === 401 || status === 403) {
        return {
            category: 'provider_unconfigured',
            status: 503,
            code: 'CALL_PROVIDER_UNCONFIGURED',
            error: 'Calling is temporarily unavailable. Our team has been notified.',
            retryable: false,
        };
    }

    return {
        category: 'unknown',
        status: 502,
        code: 'CALL_FAILED',
        error: 'Failed to initiate call',
        retryable: true,
    };
}

/**
 * True when the failure means no call was placed AND repeating the request is
 * pointless. The outreach record is then marked `failed`, which releases the
 * per-student dedup window — no parent was disturbed, so nothing is being
 * protected by keeping the teacher locked out.
 */
export function releasesDedupWindow(f: TwilioFailure): boolean {
    return !f.retryable;
}
