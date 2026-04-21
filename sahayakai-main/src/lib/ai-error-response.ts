import { NextResponse } from 'next/server';
import { logger } from './logger';

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
    if (isQuotaExhausted(error) || isSafetyViolation(error)) {
        logger.warn(ctx.message, context, { ...extra, reason: isSafetyViolation(error) ? 'safety' : 'quota' });
    } else {
        logger.error(ctx.message, error, context, extra);
    }
}

export function handleAIError(
    error: any,
    context: string,
    ctx: AIErrorContext,
): NextResponse {
    const extra = { userId: ctx.userId ?? null, ...ctx.extra };

    // 1. User input violated safety policy → 400, WARN (user can rephrase)
    if (isSafetyViolation(error)) {
        logger.warn(`${ctx.message} — safety violation`, context, extra);
        return NextResponse.json(
            { error: error?.message || 'Content violates safety policy. Please rephrase.' },
            { status: 400 },
        );
    }

    // 2. Upstream AI quota exhausted → 503 with Retry-After, WARN (our retry
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

    // 3. Real error → 500, ERROR (actually worth paging on)
    logger.error(ctx.message, error, context, extra);
    return NextResponse.json(
        { error: 'AI generation failed. Please try again.' },
        { status: 500 },
    );
}
