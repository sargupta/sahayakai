/**
 * Sampark Calling API v1: the one way another system asks Sampark to place a call.
 *
 * It adds NO calling logic. Every request runs the same service the Sampark console runs
 * (`previewRiyaCall` / `startRiyaCall` / `getRiyaCall` in conversation.ts), so the purpose
 * list, the gate (opt-outs, suppression, the frequency cap, calling hours), the approved
 * announcement, idempotency, the per-school lock, Test mode's caps and the audit log all
 * apply unchanged. What this module adds is the shell around it:
 *
 *   1. SAMPARK_ENABLED, SAMPARK_ELEVENLABS_ENABLED and SAMPARK_API_V1_ENABLED all 'true',
 *      else 404 (first, before auth: a deployment with the API off reveals nothing).
 *   2. An API key with the `sampark` scope (src/lib/mcp/auth.ts, wired in api-v1-runtime.ts): 401 / 403 / 503.
 *      The school comes ONLY from the key record. There is no orgId and no phone number
 *      anywhere in a request.
 *   3. A per-key rate limit (separate budgets for placing and reading): 429. If the limiter
 *      itself fails the request is refused (503); it never runs unmetered.
 *
 * The caller is recorded as `api-key:<keyId>` (the call's `createdBy` and the audit actor),
 * so an integration's calls are told apart from a person's.
 *
 * Responses are built field by field (`toApiCall`, `toApiPreview`): no phone-number field
 * beyond the last four digits, no agent or provider ids, no transcript, no variables. (The
 * synopsis and answers are text the model wrote from the call; they are not scrubbed here.)
 *
 * Docs: docs/sampark/API_V1.md
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import type { McpPrincipal } from '@/lib/mcp/auth';
import { McpCapabilityError } from '@/lib/mcp/errors';
import type { ConversationCallView } from '@/lib/sampark/conversation/types';
import { riyaEnabled, RiyaPreviewSchema, RiyaStartSchema, type RiyaPreview, type RiyaRefusal } from '@/server/sampark/conversation';
import { notFound, SamparkServiceError } from '@/server/sampark/errors';
import { invalidRequest } from '@/server/sampark/http';

type Env = Record<string, string | undefined>;

export const SAMPARK_API_SCOPE = 'sampark' as const;
export const API_ACTOR_PREFIX = 'api-key:';

export function apiV1Enabled(env: Env = process.env): boolean {
    return env.SAMPARK_ENABLED === 'true' && riyaEnabled(env) && env.SAMPARK_API_V1_ENABLED === 'true';
}

/** Who a call placed through the API is recorded as. Stable per key, so a retried request is the same caller. */
export function apiActor(principal: Pick<McpPrincipal, 'keyId'>): string {
    return `${API_ACTOR_PREFIX}${principal.keyId}`;
}

export interface ApiV1Deps {
    /**
     * Verify the request's API key and require the `sampark` scope (authenticateMcpRequest with
     * SAMPARK_API_SCOPE). Throws McpCapabilityError: authentication, authorization or not_configured.
     * This module never opens a database itself; the routes' real dependencies are in api-v1-runtime.ts.
     */
    authenticate: (headers: Headers) => Promise<McpPrincipal>;
    /**
     * Throws `Rate limit exceeded. Please wait N minutes.` when the key is over its limit for
     * this kind of request. Any other error means the limiter itself failed, and the request
     * is refused (503): it must NOT swallow its own failures.
     */
    rateLimit: (keyId: string, kind: ApiRequestKind) => Promise<void>;
    env?: Env;
}

/** `place` = preview or start (can lead to a phone ringing); `read` = polling a call's outcome. Separate budgets. */
export type ApiRequestKind = 'place' | 'read';

/** Requests per key per window. Reads are looser so polling an outcome never starves placing a call. */
export const API_RATE_LIMITS: Record<ApiRequestKind, { max: number; windowMs: number }> = {
    place: { max: 30, windowMs: 10 * 60_000 },
    read: { max: 120, windowMs: 10 * 60_000 },
};

/** Minimal store for the limiter: one document of recent request times per bucket, updated atomically. */
export interface RateLimitStore {
    /** Runs `update` on the bucket's timestamps in one transaction and stores what it returns. */
    transact(bucket: string, update: (recent: number[]) => number[]): Promise<void>;
}

/**
 * Sliding-window limiter for the API. Unlike the app's shared limiter (which fails open by
 * design, for teachers' AI tools), this one lets every failure of the store propagate, so the
 * shell refuses the request: an API that can ring phones does not run unmetered.
 */
export async function enforceApiRateLimit(store: RateLimitStore, keyId: string, kind: ApiRequestKind, nowMs: number): Promise<void> {
    const { max, windowMs } = API_RATE_LIMITS[kind];
    await store.transact(`sampark_api_${kind}_${keyId}`, (recent) => {
        const live = recent.filter((t) => typeof t === 'number' && t > nowMs - windowMs);
        if (live.length >= max) {
            const waitMin = Math.max(1, Math.ceil((windowMs - (nowMs - Math.min(...live))) / 60_000));
            throw new Error(`Rate limit exceeded. Please wait ${waitMin} minutes.`);
        }
        return [...live, nowMs];
    });
}

export type ApiV1Guard = { principal: McpPrincipal; actor: string } | { response: NextResponse };

const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
    NextResponse.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

const AUTH_STATUS: Partial<Record<McpCapabilityError['category'], number>> = {
    authentication: 401,
    authorization: 403,
    not_configured: 503,
};

/** Seconds to wait when the shared limiter refused the request; null when it failed for any other reason. */
export function rateLimitWaitSeconds(err: unknown): number | null {
    const wait = /^Rate limit exceeded\. Please wait (\d+) minutes?/i.exec(err instanceof Error ? err.message : '');
    return wait ? Number(wait[1]) * 60 : null;
}

/** Steps 1–3 for every /api/sampark-api/v1/* route. Never reads x-user-id. */
export async function guardApiV1(req: { headers: Headers }, deps: ApiV1Deps, kind: ApiRequestKind): Promise<ApiV1Guard> {
    if (!apiV1Enabled(deps.env ?? process.env)) return { response: json(404, { error: 'Not found' }) };

    let principal: McpPrincipal;
    try {
        principal = await deps.authenticate(req.headers);
    } catch (err) {
        if (err instanceof McpCapabilityError && AUTH_STATUS[err.category]) {
            const status = AUTH_STATUS[err.category] as number;
            // Own wording: the shared authenticator's messages speak of "this Sahayak MCP server".
            const body = status === 401
                ? { error: 'UNAUTHENTICATED', message: err.message }
                : status === 403
                    ? { error: 'SCOPE_REQUIRED', message: 'This API key is not enabled for the Sampark Calling API.' }
                    : { error: 'NOT_CONFIGURED', message: 'The Sampark API is not available right now.' };
            return { response: json(status, body, status === 401 ? { 'WWW-Authenticate': 'Bearer realm="sampark"' } : {}) };
        }
        logger.error('Sampark API authentication failed', err, 'SAMPARK_API_V1');
        return { response: json(503, { error: 'NOT_CONFIGURED', message: 'The Sampark API is not available right now.' }) };
    }

    try {
        await deps.rateLimit(principal.keyId, kind);
    } catch (err) {
        const seconds = rateLimitWaitSeconds(err);
        if (seconds === null) {
            // The limiter itself failed. Fail closed: an API that can ring phones does not run unmetered.
            logger.error('Sampark API rate limiter failed', err, 'SAMPARK_API_V1', { keyId: principal.keyId });
            return { response: json(503, { error: 'NOT_CONFIGURED', message: 'The Sampark API is not available right now.' }) };
        }
        return { response: json(429, { error: 'RATE_LIMITED', message: 'Too many requests for this API key.' }, { 'retry-after': String(seconds) }) };
    }
    return { principal, actor: apiActor(principal) };
}

/** Parse a JSON body with a schema; a body that is not JSON, or not the schema, is a 400. */
export async function parseApiBody<S extends z.ZodTypeAny>(req: { json(): Promise<unknown> }, schema: S): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
    const raw = await req.json().catch(() => undefined);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { response: invalidRequest(parsed.error) };
    return { data: parsed.data };
}

/** The console's preview request, unchanged. */
export const ApiPreviewSchema = RiyaPreviewSchema;
/** The console's start request without `scenario`: an integration cannot choose a Practice script. */
export const ApiStartSchema = RiyaStartSchema.omit({ scenario: true }).strict();

/** A call as the API returns it. Every field is named here; nothing rides along from the stored record. */
export interface SamparkApiCall {
    id: string;
    state: ConversationCallView['state'];
    purpose: ConversationCallView['riyaPurpose'];
    guardianId: string;
    studentId: string;
    language: ConversationCallView['language'];
    /** The school's mode when the call was placed. In Test mode only the school's test phone rings. */
    mode: ConversationCallView['mode'];
    destination: ConversationCallView['destination'];
    phoneLast4: string;
    createdAt: string;
    updatedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    failureReason: string | null;
    callSuccessful: ConversationCallView['callSuccessful'];
    /** What the listener answered, by the agent's fixed data-collection keys. */
    answers: ConversationCallView['dataCollection'];
    /** The listener asked not to be called; the school office confirms it. */
    stopRequested: boolean;
    /** Factual bullets written after the call. Never the transcript. */
    synopsis: { bullets: string[]; callbackRequest: string | null; status: 'provisional' | 'final' } | null;
    /** An 'unknown' call a person has since looked at. */
    reviewed: boolean;
}

export function toApiCall(c: ConversationCallView): SamparkApiCall {
    return {
        id: c.id,
        state: c.state,
        purpose: c.riyaPurpose,
        guardianId: c.guardianId,
        studentId: c.studentId,
        language: c.language,
        mode: c.mode,
        destination: c.destination,
        phoneLast4: c.phoneLast4,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        endedAt: c.endedAt,
        durationSeconds: c.durationSeconds,
        failureReason: c.failureReason,
        callSuccessful: c.callSuccessful,
        answers: { ...c.dataCollection },
        stopRequested: c.stopRequested,
        synopsis: c.synopsis
            ? {
                bullets: [...c.synopsis.bullets],
                callbackRequest: c.synopsis.callbackRequest,
                status: c.synopsis.status ?? (c.synopsis.source === 'ai' ? 'final' : 'provisional'),
            }
            : null,
        reviewed: c.reviewedAt !== null && c.reviewedAt !== undefined,
    };
}

export interface SamparkApiPreview {
    ok: boolean;
    refusals: RiyaRefusal[];
    purpose: RiyaPreview['purpose'];
    destination: RiyaPreview['destination'];
    destinationLast4: string | null;
    recipient: { guardianDisplayName: string; studentDisplayName: string; grade: number; section: string } | null;
    /** What Riya says once the listener confirms who they are. Send it back as `confirmedAnnouncement`. */
    announcement: string | null;
    opening: string | null;
}

export function toApiPreview(p: RiyaPreview): SamparkApiPreview {
    return {
        ok: p.ok,
        refusals: p.refusals,
        purpose: p.purpose,
        destination: p.destination,
        destinationLast4: p.destinationLast4,
        recipient: p.recipient
            ? {
                guardianDisplayName: p.recipient.guardianDisplayName,
                studentDisplayName: p.recipient.studentDisplayName,
                grade: p.recipient.grade,
                section: p.recipient.section,
            }
            : null,
        announcement: p.announcement,
        opening: p.opening,
    };
}

/**
 * A key reads only calls an integration placed. Calls staff placed from the console are not
 * the integration's to read, and are reported exactly like a call that does not exist. The
 * check runs on the stored record BEFORE the service is asked for the call, so a request for
 * someone else's call has no effect at all (not even routine maintenance of that record).
 */
export async function getApiCall(
    deps: { calls: { getCall(orgId: string, callId: string): Promise<{ createdBy: string } | null> } },
    orgId: string,
    callId: string,
    load: () => Promise<{ call: ConversationCallView }>,
): Promise<SamparkApiCall> {
    const stored = await deps.calls.getCall(orgId, callId);
    if (!stored || !stored.createdBy.startsWith(API_ACTOR_PREFIX)) throw notFound('CALL_NOT_FOUND', 'Call not found');
    return toApiCall((await load()).call);
}

/** Map a thrown error to a response. Known service errors keep their code and status. */
export function apiErrorResponse(err: unknown, context: string): NextResponse {
    if (err instanceof SamparkServiceError) return json(err.status, { error: err.code, message: err.message });
    if (err instanceof z.ZodError) return invalidRequest(err);
    logger.error('Sampark API route failed', err, context);
    return json(500, { error: 'INTERNAL', message: 'Internal server error' });
}

export const apiJson = json;
