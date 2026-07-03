/**
 * Generator feature spine — shared types.
 *
 * Every generator tool (quiz, rubric, worksheet, instant-answer, exam-paper,
 * …) is the same state machine:
 *
 *   idle → validating → generating → (streaming) → done | error
 *
 * This module is the single source of truth for that machine's vocabulary.
 * See docs/design/proposals/05-frontend-arch.md §2a.
 */

/** Lifecycle states of one generation run. */
export type GeneratorStatus =
    | "idle"
    | "validating"
    | "generating"
    | "streaming"
    | "done"
    | "error";

/**
 * Error taxonomy — every failure a generator page previously hand-rolled,
 * named once. UI layers switch on `code`, never on message strings.
 */
export type GeneratorErrorCode =
    /** 401 from the API — auth modal has been opened. */
    | "AUTH_REQUIRED"
    /** 403 PLAN_UPGRADE_REQUIRED — feature needs a paid plan. */
    | "PREMIUM_REQUIRED"
    /** 429 USAGE_LIMIT_REACHED / DAILY_LIMIT_REACHED. */
    | "LIMIT_REACHED"
    /** 503 AI_SERVICE_BUSY — transient upstream quota exhaustion. */
    | "SERVICE_BUSY"
    /** 202 — the AI hit its timeout budget but is still working. */
    | "STILL_GENERATING"
    /** 200 with a garbage/incomplete body (the "undefined undefined" bug). */
    | "MALFORMED_RESPONSE"
    /** Pre-flight validation failed (e.g. exam-paper chapter requirement). */
    | "VALIDATION"
    /** Fetch aborted (user navigated away / re-submitted). */
    | "ABORTED"
    /** Everything else — network failure, 5xx, unparseable body. */
    | "REQUEST_FAILED";

export interface GeneratorError {
    code: GeneratorErrorCode;
    message: string;
}

/**
 * Thrown by a `parseResponse` implementation when a 200 body does not
 * contain a usable result. Mapped to `MALFORMED_RESPONSE`.
 */
export class MalformedResponseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MalformedResponseError";
    }
}
