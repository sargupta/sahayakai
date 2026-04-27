/**
 * Promise.race-based timeout helper for sidecar dispatchers (Phase J.2 hot-fix).
 *
 * Forensic finding P0 #7: 14 dispatchers call the Genkit fallback with NO
 * timeout. Worst case: sidecar burns its 70s budget, then the Genkit
 * fallback hangs for the SDK's ~600s default — ~670s total zombie path.
 *
 * `withTimeout` wraps any Promise so it rejects with a typed
 * `WithTimeoutError` after `ms` milliseconds, regardless of whether the
 * underlying work completes. The label is preserved in the error so
 * outer catch blocks can attribute the timeout to a specific dispatcher
 * stage (e.g. "voice-to-text genkit fallback").
 *
 * Note: this does NOT cancel the underlying work — there is no AbortSignal
 * threading. The promise just becomes orphaned. That is acceptable here
 * because the Genkit flow's outer fetch already has its own AbortController
 * via the underlying SDK; what matters is that the dispatcher returns to
 * the caller within budget.
 */

export class WithTimeoutError extends Error {
    constructor(
        public readonly label: string,
        public readonly elapsedMs: number,
    ) {
        super(`${label} timed out after ${elapsedMs}ms`);
        this.name = 'WithTimeoutError';
    }
}

export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
): Promise<T> {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new WithTimeoutError(label, Date.now() - startedAt)),
            ms,
        );
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        // Clear the timer on resolution so we don't leak handles when
        // the underlying promise wins the race.
        if (timer !== undefined) clearTimeout(timer);
    });
}
