/**
 * Which live-eval failures are transient (worth one retry) and how long to wait first.
 *
 * The eval runner (scripts/eval/run-evals.mts) used to recognise transient failures by the
 * provider's raw message (RESOURCE_EXHAUSTED, 429, UNAVAILABLE...). The app wraps a quota error
 * into AIQuotaExhaustedError with a friendly message ("AI service is temporarily overloaded"),
 * so two cases on the first authenticated run failed red on a per-minute Vertex limit instead of
 * being retried, and an instant retry would not have helped anyway. Language and expectation
 * assertions are never transient: a masked regression is worse than a red check.
 */

/** Longest the runner waits before its one retry. */
export const MAX_EVAL_RETRY_WAIT_MS = 60_000;

const RAW_TRANSIENT = /timeout after|INVALID_ARGUMENT|RESOURCE_EXHAUSTED|429|5\d\d|UNAVAILABLE|fetch failed|temporarily overloaded/i;

/** Milliseconds to wait before retrying `err`, or null when it must not be retried. */
export function evalRetryDelayMs(err: unknown): number | null {
    const e = err as { name?: unknown; message?: unknown; retryAfterSeconds?: unknown } | null;
    const message = typeof e?.message === 'string' ? e.message : String(err);
    if (/language regression|^expect /.test(message)) return null;
    if (e?.name === 'AIQuotaExhaustedError') {
        const seconds = typeof e.retryAfterSeconds === 'number' && e.retryAfterSeconds > 0 ? e.retryAfterSeconds : 60;
        return Math.min(seconds * 1000, MAX_EVAL_RETRY_WAIT_MS);
    }
    return RAW_TRANSIENT.test(message) ? 2_000 : null;
}
