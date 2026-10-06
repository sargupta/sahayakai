/**
 * Errors for Sahayak's public MCP servers.
 *
 * Every failure an external MCP client can see is one of these categories,
 * with a short message written for an AI agent to act on ("Invalid grade.
 * Expected an integer between 1 and 12."). Raw exceptions, stack traces,
 * provider names, URLs and secrets never leave the server: unknown errors
 * collapse to `internal` with a generic message.
 */

export type McpErrorCategory =
    | 'authentication'      // missing / malformed / invalid / revoked API key
    | 'authorization'       // valid key, but not allowed to use this capability
    | 'invalid_input'       // arguments failed validation
    | 'content_policy'      // topic refused by Sahayak's safety policy
    | 'rate_limited'        // too many requests for this API key
    | 'upstream_unavailable'// model / backend busy or temporarily down
    | 'timeout'             // generation took too long
    | 'generation_failed'   // the model could not produce a usable result (retry / simplify)
    | 'capability_disabled' // Sahayak has switched this capability off (kill switch)
    | 'not_configured'      // server-side MCP configuration missing
    | 'internal';           // anything else (details logged, never returned)

/** Whether the same call may succeed if the agent simply retries later. */
const RETRYABLE: Record<McpErrorCategory, boolean> = {
    authentication: false,
    authorization: false,
    invalid_input: false,
    content_policy: false,
    rate_limited: true,
    upstream_unavailable: true,
    timeout: true,
    generation_failed: true,
    capability_disabled: false,
    not_configured: false,
    internal: true,
};

export class McpCapabilityError extends Error {
    readonly category: McpErrorCategory;
    readonly retryAfterSeconds?: number;

    constructor(category: McpErrorCategory, message: string, retryAfterSeconds?: number) {
        super(message);
        this.name = 'McpCapabilityError';
        this.category = category;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    get retryable(): boolean {
        return RETRYABLE[this.category];
    }
}

const GENERIC_INTERNAL = 'Sahayak could not complete this request. Please try again later.';

/**
 * Map anything thrown by the existing Sahayak service layer to a safe,
 * agent-readable error. Only well-known, already-user-facing messages are
 * recognised; everything else becomes `internal` with a generic message.
 */
export function classifyError(err: unknown): McpCapabilityError {
    if (err instanceof McpCapabilityError) return err;
    const message = err instanceof Error ? err.message : String(err ?? '');
    const name = err instanceof Error ? err.name : '';

    if (/^Safety Violation/i.test(message)) {
        return new McpCapabilityError(
            'content_policy',
            'This request cannot be used under Sahayak\'s classroom safety policy. Choose a different, age-appropriate topic or chapter.',
        );
    }
    const wait = message.match(/Rate limit exceeded\. Please wait (\d+) minutes?/i);
    if (wait) {
        const minutes = Number(wait[1]);
        return new McpCapabilityError(
            'rate_limited',
            `Rate limit reached for this API key. Retry after about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            minutes * 60,
        );
    }
    if (name === 'AbortError' || /timed? ?out|deadline exceeded/i.test(message)) {
        return new McpCapabilityError('timeout', 'Generation took too long and was stopped. Retry, or simplify the topic.');
    }
    if (/\b(429|503)\b|quota|resource[_ ]exhausted|overloaded|unavailable|ECONNRESET|ECONNREFUSED/i.test(message)) {
        return new McpCapabilityError(
            'upstream_unavailable',
            'Sahayak\'s generation service is busy or temporarily unavailable. Retry in about a minute.',
            60,
        );
    }
    return new McpCapabilityError('internal', GENERIC_INTERNAL);
}

/** The MCP `CallToolResult` for a failed tool call (isError: true). */
export function toToolErrorResult(error: McpCapabilityError) {
    const payload = {
        error: {
            category: error.category,
            message: error.message,
            retryable: error.retryable,
            ...(error.retryAfterSeconds ? { retry_after_seconds: error.retryAfterSeconds } : {}),
        },
    };
    return {
        isError: true as const,
        content: [{ type: 'text' as const, text: `${error.message} (${error.category})` }],
        structuredContent: payload,
    };
}
