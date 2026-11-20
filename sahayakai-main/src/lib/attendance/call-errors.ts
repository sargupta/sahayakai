/**
 * Reading an error from the attendance call routes on the client.
 *
 * The routes answer every failure with JSON `{ error, code? }`, but a crash outside a route's
 * own handling (or a proxy in between) can still produce a body that is not JSON. The modal
 * used to `await res.json()` on any non-OK response, so such a body threw a parse error and the
 * teacher saw "Unexpected end of JSON input" instead of a message. This never throws: a body it
 * cannot read becomes the caller's fallback message.
 */

export class CallRequestError extends Error {
    constructor(
        message: string,
        /** The route's machine-readable code, e.g. OUTSIDE_CALLING_HOURS, when it sent one. */
        readonly code?: string,
    ) {
        super(message);
        this.name = 'CallRequestError';
    }
}

export async function callErrorFromResponse(res: Response, fallback: string): Promise<CallRequestError> {
    // `.then` so a synchronous throw from json() is caught as well as a rejection.
    const body = (await Promise.resolve()
        .then(() => res.json())
        .catch(() => null)) as { error?: unknown; code?: unknown } | null;
    const message = typeof body?.error === 'string' && body.error ? body.error : fallback;
    const code = typeof body?.code === 'string' && body.code ? body.code : undefined;
    return new CallRequestError(message, code);
}
