/**
 * Known Sampark service errors. Routes map these to HTTP; anything else is a
 * 500 with a generic message (never leak internals).
 *
 * Wire shape: `{ error: CODE, message: human-readable }`. `error` is a stable
 * code the console can switch on (e.g. 'LIVE_DIAL_DISABLED', which the
 * contract fixes); `message` is safe to show.
 */

export type SamparkErrorStatus = 400 | 403 | 404 | 409;

export class SamparkServiceError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly status: SamparkErrorStatus,
    ) {
        super(message);
        this.name = 'SamparkServiceError';
    }
}

export const badRequest = (code: string, message: string) => new SamparkServiceError(code, message, 400);
export const forbidden = (code: string, message: string) => new SamparkServiceError(code, message, 403);
export const notFound = (code: string, message: string) => new SamparkServiceError(code, message, 404);
export const conflict = (code: string, message: string) => new SamparkServiceError(code, message, 409);

export const schoolNotEnabled = () => notFound('SAMPARK_NOT_ENABLED', 'Sampark is not enabled for this school');
