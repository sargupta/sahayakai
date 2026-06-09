import { NextResponse } from 'next/server';
import { logger } from './logger';

// ZodError detection via name + shape rather than `instanceof ZodError`.
// Next.js can load zod from both CJS (`zod/v3/types.cjs`) and ESM entrypoints
// inside the same request, producing ZodError instances whose constructor
// isn't the same identity as the one we imported. `instanceof` silently
// returns false, and the check falls through to the 500 branch. This helper
// sidesteps the issue by looking at the error's duck-type.
function isZodError(err: unknown): err is { name: 'ZodError'; issues: Array<{ path: (string | number)[]; code: string; message: string }> } {
    return (
        !!err &&
        typeof err === 'object' &&
        (err as any).name === 'ZodError' &&
        Array.isArray((err as any).issues)
    );
}

/**
 * Shared catch-block helper for AI API routes.
 *
 * Classifies the error and:
 *   - Returns the correct NextResponse (400 for safety, 503 for quota, 500 for real bugs)
 *   - Logs at the right severity (WARN for transient/expected, ERROR for real failures)
 *
 * Why this exists: before this helper, every AI route logged every failure
 * at ERROR severity. Because our `error-alert` Cloud Monitoring policy emails
 * on `severity>=ERROR`, a single Gemini quota burst produced 10-20 emails
 * across different routes. Downgrading transient errors to WARN cuts email
 * noise by ~70% while preserving ERROR alerting for actual bugs.
 *
 * Usage:
 *   } catch (error) {
 *     return handleAIError(error, 'LESSON_PLAN', {
 *       message: `Lesson Plan API Failed for topic: "${topic}"`,
 *       userId: request.headers.get('x-user-id'),
 *     });
 *   }
 */

interface AIErrorContext {
    /** Top-level log message (usually feature name + context) */
    message: string;
    /** User ID for the log metadata (optional) */
    userId?: string | null;
    /** Any additional structured fields to attach to the log */
    extra?: Record<string, unknown>;
}

const TRANSIENT_STATUSES = new Set([429]);
const TRANSIENT_NAMES = new Set(['AIQuotaExhaustedError']);

/**
 * Extract an HTTP-style status code from a Gemini / generic error, even when
 * the SDK only embeds it in the message string.
 */
function errorStatus(error: any): number | null {
    if (typeof error?.status === 'number') return error.status;
    const msg = String(error?.message || '');
    // Map internal rate limiter (src/lib/server-safety.ts throws
    // "Rate limit exceeded. Please wait N minutes.") to 429 so the
    // user sees the proper "AI service overloaded" message + Retry-After
    // header instead of a generic 500 "AI generation failed".
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Resource exhausted') || msg.includes('Rate limit exceeded')) return 429;
    if (msg.includes('403') || msg.includes('denied access')) return 403;
    if (msg.includes('401')) return 401;
    if (msg.includes('400') || msg.includes('API key expired')) return 400;
    if (msg.includes('500') || msg.includes('Internal')) return 500;
    return null;
}

function isSafetyViolation(error: any): boolean {
    const msg = String(error?.message || '');
    return /safety violation|blocked by safety|harmful|policy/i.test(msg);
}

/**
 * Detects Gemini "bad input" errors that surface as `400 Bad Request` from
 * the model API itself (not from our Zod schema). The ones we see in prod:
 *   - "Unable to process input image" — image is corrupt, sub-minimum size,
 *     or an unsupported format (e.g. 1×1 placeholder PNG from QA bots,
 *     truncated uploads from flaky rural connections).
 *   - "Invalid argument" on a media part — malformed mime / broken base64.
 *
 * These are CLIENT errors, not server bugs. Retrying won't help, and they
 * shouldn't page on-call. Classify as 400 so the UI shows a clear
 * "re-upload" message instead of a generic "AI failed" toast.
 */
function isBadInputMedia(error: any): boolean {
    const msg = String(error?.message || '');
    return /Unable to process input image|invalid argument.*image|Request contains an invalid argument/i.test(msg);
}

function isQuotaExhausted(error: any): boolean {
    if (error?.name && TRANSIENT_NAMES.has(error.name)) return true;
    const s = errorStatus(error);
    return s !== null && TRANSIENT_STATUSES.has(s);
}

/**
 * Detects a dispatcher-level timeout. These surface as `WithTimeoutError`
 * (src/lib/sidecar/with-timeout.ts) or a sidecar client `*TimeoutError`,
 * both with a "timed out after Nms" message.
 *
 * Why this exists (observed 2026-06-09 daily scan): every lesson-plan / quiz /
 * rubric / teacher-training / instant-answer 500 that day was NOT a raw 429 —
 * it was `WithTimeoutError: "<stage> genkit fallback timed out after 60001ms"`.
 * Root cause: with a single-key pool the 429 backoff in runResiliently
 * (20s → 40s) overruns the 60s `FALLBACK_TIMEOUT_MS`, so a quota-driven retry
 * is killed by the timeout wrapper and rethrown as a plain timeout. Because
 * `errorStatus()` can't read a status off that message, it fell through to the
 * generic 500 branch and paged on-call instead of returning a friendly 503.
 *
 * A timeout is transient (a retry may succeed), so the user should get a
 * 503 + Retry-After, not a 500 "AI generation failed". NOTE: we still log it
 * at ERROR (see handleAIError) — per the zero-tolerance daily scan a timeout
 * storm must stay visible until the Gemini quota / key-pool root cause is
 * fixed. Once the pool has headroom these stop occurring and the scan goes
 * clean on its own.
 */
function isTransientTimeout(error: any): boolean {
    const name = String(error?.name || '');
    if (name === 'WithTimeoutError' || /TimeoutError$/.test(name)) return true;
    const msg = String(error?.message || '');
    return /timed out after \d+\s*ms/i.test(msg);
}

/**
 * Log-only helper — classifies the error and writes at WARN or ERROR level.
 * Use this when the route has custom response logic that you don't want to
 * replace wholesale. The return path in the route is unchanged; only the
 * severity of the log is tuned.
 *
 * Pattern:
 *   } catch (error) {
 *     logAIError(error, 'LESSON_PLAN', { message: 'Lesson Plan Failed for...' });
 *     // ... route's existing response handling ...
 *   }
 */
export function logAIError(
    error: any,
    context: string,
    ctx: AIErrorContext,
): void {
    const extra = { userId: ctx.userId ?? null, ...ctx.extra };
    if (isZodError(error)) {
        // Client bug, not a server bug — don't page on-call.
        logger.warn(ctx.message, context, { ...extra, reason: 'invalid_request', zodIssues: error.issues });
        return;
    }
    if (isQuotaExhausted(error) || isSafetyViolation(error) || isBadInputMedia(error)) {
        const reason = isSafetyViolation(error)
            ? 'safety'
            : isBadInputMedia(error)
                ? 'invalid_media'
                : 'quota';
        logger.warn(ctx.message, context, { ...extra, reason });
    } else {
        logger.error(ctx.message, error, context, extra);
    }
}

/**
 * Stream-safe error classification.
 *
 * Streaming routes can't change HTTP status mid-response (headers are already
 * flushed on the first `send()`), so they need a way to emit a richer `error`
 * SSE event with a code the client can branch on. Use this in every SSE AI
 * route catch block.
 */
export interface ClassifiedAIError {
    /** Stable machine-readable code for the client to branch on */
    code:
        | 'AI_SERVICE_BUSY'
        | 'AI_SERVICE_UNAVAILABLE'
        | 'SAFETY_VIOLATION'
        | 'AI_GENERATION_FAILED';
    /** Human-friendly message safe to show the user */
    message: string;
    /** Whether the failure is transient (client should retry) or permanent */
    transient: boolean;
}

export function classifyAIError(err: unknown): ClassifiedAIError {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSafetyViolation(err)) {
        return { code: 'SAFETY_VIOLATION', message: msg, transient: false };
    }
    if (isQuotaExhausted(err)) {
        return {
            code: 'AI_SERVICE_BUSY',
            message:
                'AI service is temporarily overloaded. Please try again in a minute.',
            transient: true,
        };
    }
    if (isTransientTimeout(err)) {
        return {
            code: 'AI_SERVICE_BUSY',
            message:
                'AI service is taking longer than usual. Please try again in a minute.',
            transient: true,
        };
    }
    if (msg.includes('403') || msg.includes('denied access')) {
        return {
            code: 'AI_SERVICE_UNAVAILABLE',
            message:
                'AI service is temporarily unavailable. Our team has been notified.',
            transient: false,
        };
    }
    return {
        code: 'AI_GENERATION_FAILED',
        message: 'AI generation failed. Please try again.',
        transient: true,
    };
}

export function handleAIError(
    error: any,
    context: string,
    ctx: AIErrorContext,
): NextResponse {
    const extra = { userId: ctx.userId ?? null, ...ctx.extra };

    // 1. Client sent a malformed body (Zod schema mismatch) → 400, WARN.
    //    Previously every AI route caught ZodError alongside real errors and
    //    returned a generic 500 "Internal Server Error", making it impossible
    //    for the client to tell a bad request apart from a provider outage.
    //    Return 400 with the structured Zod issues so form validators can
    //    map each issue back to the correct field.
    if (isZodError(error)) {
        logger.warn(`${ctx.message} — invalid request body`, context, {
            ...extra,
            zodIssues: error.issues,
        });
        // Response shape convention (this app): `error` is the human-readable
        // string the client will show in a toast (consumer at
        // features/lesson-planner/hooks/use-lesson-plan.ts:421 reads
        // `errorData.error` directly). `code` is the machine-readable
        // classifier; `issues` is the per-field breakdown for form clients.
        return NextResponse.json(
            {
                error: 'Request body failed schema validation.',
                code: 'INVALID_ARGUMENT',
                issues: error.issues.map((i) => ({
                    path: i.path.join('.'),
                    code: i.code,
                    message: i.message,
                })),
            },
            { status: 400 },
        );
    }

    // 2a. Gemini rejected the uploaded image/media → 400, WARN. User can
    //     re-upload a clearer photo; this isn't a server bug. Without this
    //     branch, every QA bot stub-image hit pages on-call (see G4:
    //     15 spurious 500s from 1×1 PNG fixtures over 4 hours).
    if (isBadInputMedia(error)) {
        logger.warn(`${ctx.message} — bad input media (Gemini rejected image)`, context, {
            ...extra,
            reason: 'invalid_media',
            geminiMessage: String(error?.message || '').slice(0, 240),
        });
        return NextResponse.json(
            {
                error: 'The uploaded image could not be processed. Please re-upload a clearer photo.',
                code: 'INVALID_MEDIA',
            },
            { status: 400 },
        );
    }

    // 2. User input violated safety policy → 400, WARN (user can rephrase)
    if (isSafetyViolation(error)) {
        logger.warn(`${ctx.message} — safety violation`, context, extra);
        return NextResponse.json(
            { error: error?.message || 'Content violates safety policy. Please rephrase.' },
            { status: 400 },
        );
    }

    // 3. Upstream AI quota exhausted → 503 with Retry-After, WARN (our retry
    //    layer already tried; surface a friendly message to the user).
    if (isQuotaExhausted(error)) {
        const retryAfter = typeof error?.retryAfterSeconds === 'number' ? error.retryAfterSeconds : 60;
        logger.warn(`${ctx.message} — AI quota exhausted (transient)`, context, {
            ...extra,
            retryAfterSeconds: retryAfter,
        });
        return NextResponse.json(
            {
                error: 'AI service is temporarily overloaded. Please try again in a minute.',
                code: 'AI_SERVICE_BUSY',
                retryAfterSeconds: retryAfter,
            },
            {
                status: 503,
                headers: { 'Retry-After': String(retryAfter) },
            },
        );
    }

    // 3c. Dispatcher/upstream timeout → 503 with Retry-After. Transient
    //     (a retry may succeed) and almost always driven by Gemini slowness
    //     or single-key 429 backoff overrunning the 60s withTimeout budget,
    //     so the user gets "try again", not "generation failed".
    //     Deliberately logged at ERROR (not WARN like quota): per the
    //     zero-tolerance daily scan a timeout storm must stay visible until
    //     the Gemini quota / key-pool root cause is resolved.
    if (isTransientTimeout(error)) {
        logger.error(`${ctx.message} — upstream timeout (transient, served as 503)`, error, context, {
            ...extra,
            reason: 'upstream_timeout',
        });
        return NextResponse.json(
            {
                error: 'AI service is taking longer than usual. Please try again in a minute.',
                code: 'AI_SERVICE_BUSY',
                retryAfterSeconds: 60,
            },
            {
                status: 503,
                headers: { 'Retry-After': '60' },
            },
        );
    }

    // 4. Real error → 500, ERROR (actually worth paging on)
    logger.error(ctx.message, error, context, extra);
    return NextResponse.json(
        { error: 'AI generation failed. Please try again.' },
        { status: 500 },
    );
}
