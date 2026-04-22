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
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Resource exhausted')) return 429;
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

function isQuotaExhausted(error: any): boolean {
    if (error?.name && TRANSIENT_NAMES.has(error.name)) return true;
    const s = errorStatus(error);
    return s !== null && TRANSIENT_STATUSES.has(s);
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
    if (isQuotaExhausted(error) || isSafetyViolation(error)) {
        logger.warn(ctx.message, context, { ...extra, reason: isSafetyViolation(error) ? 'safety' : 'quota' });
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
        return NextResponse.json(
            {
                error: 'INVALID_ARGUMENT',
                message: 'Request body failed schema validation.',
                issues: error.issues.map((i) => ({
                    path: i.path.join('.'),
                    code: i.code,
                    message: i.message,
                })),
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
                error: 'AI_SERVICE_BUSY',
                message: error?.message || 'AI service is temporarily overloaded. Please try again in a minute.',
                retryAfterSeconds: retryAfter,
            },
            {
                status: 503,
                headers: { 'Retry-After': String(retryAfter) },
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
