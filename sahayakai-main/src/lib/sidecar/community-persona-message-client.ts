/**
 * HTTP client for the sahayakai-agents community-persona-message
 * ADK agent.
 *
 * Same auth + signing pattern as the other ADK agent clients
 * (parent-message / quiz / lesson-plan):
 *   1. Google ID token scoped to `SAHAYAKAI_AGENTS_AUDIENCE`.
 *   2. HMAC-SHA256 body digest + `X-Request-Timestamp` replay
 *      protection.
 *   3. 8s client-side timeout via `AbortController` (single short
 *      Gemini call; 8s leaves plenty of tail-latency headroom).
 *
 * Wire types are kept inline here for now — when the next codegen
 * pass runs (`sahayakai-agents/scripts/codegen_ts.py`) they should
 * be moved to `types.generated.ts` alongside the other agents.
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getServerAppCheckTokenOrNull } from '@/lib/sidecar/app-check-mint';

import { newRequestId, signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class CommunityPersonaMessageSidecarConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommunityPersonaMessageSidecarConfigError';
    }
}

export class CommunityPersonaMessageSidecarTimeoutError extends Error {
    readonly elapsedMs: number;
    constructor(elapsedMs: number) {
        super(
            `Community-persona-message sidecar request timed out after ${elapsedMs}ms`,
        );
        this.name = 'CommunityPersonaMessageSidecarTimeoutError';
        this.elapsedMs = elapsedMs;
    }
}

export class CommunityPersonaMessageSidecarHttpError extends Error {
    readonly status: number;
    readonly bodyExcerpt: string;
    constructor(status: number, bodyExcerpt: string) {
        super(
            `Community-persona-message sidecar returned HTTP ${status}: ${bodyExcerpt}`,
        );
        this.name = 'CommunityPersonaMessageSidecarHttpError';
        this.status = status;
        this.bodyExcerpt = bodyExcerpt;
    }
}

export class CommunityPersonaMessageSidecarBehaviouralError extends Error {
    readonly axisHint: string;
    constructor(axisHint: string, details: string) {
        super(
            `Community-persona-message sidecar behavioural guard failed (${axisHint}): ${details}`,
        );
        this.name = 'CommunityPersonaMessageSidecarBehaviouralError';
        this.axisHint = axisHint;
    }
}

// ─── Wire schemas (inline; move to types.generated on next codegen) ────────

export interface SidecarCommunityPersonaMessageRecentMessage {
    authorName: string;
    text: string;
}

export type CommunityPersonaMode = 'reply' | 'fresh' | 'auto';

export interface SidecarCommunityPersonaMessageRequest {
    personaName: string;
    personaState: string;
    personaSubject: string;
    personaGradeLevel: string;
    personaVoiceTone: string;
    preferredLanguage: string;
    yearsExperience: number;
    recentMessages: SidecarCommunityPersonaMessageRecentMessage[];
    mode: CommunityPersonaMode;
    userId: string;
}

export interface SidecarCommunityPersonaMessageResponse {
    message: string;
    sidecarVersion: string;
    latencyMs: number;
    modelUsed: string;
}

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

const tokenClientByAudience = new Map<string, Promise<IdTokenClient>>();

async function getTokenClient(audience: string): Promise<IdTokenClient> {
    let cached = tokenClientByAudience.get(audience);
    if (!cached) {
        const auth = new GoogleAuth();
        const p = auth.getIdTokenClient(audience);
        p.catch(() => tokenClientByAudience.delete(audience));
        tokenClientByAudience.set(audience, p);
        cached = p;
    }
    return cached;
}

export function _resetCommunityPersonaMessageTokenCacheForTest(): void {
    tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarCommunityPersonaMessageOptions {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    requestId?: string;
    appCheckToken?: string | null;
}

export async function callSidecarCommunityPersonaMessage(
    request: SidecarCommunityPersonaMessageRequest,
    options: CallSidecarCommunityPersonaMessageOptions = {},
): Promise<SidecarCommunityPersonaMessageResponse> {
    const baseUrl = process.env[BASE_URL_ENV];
    const audience = process.env[AUDIENCE_ENV];
    if (!baseUrl) {
        throw new CommunityPersonaMessageSidecarConfigError(
            `${BASE_URL_ENV} is not set`,
        );
    }
    if (!audience) {
        throw new CommunityPersonaMessageSidecarConfigError(
            `${AUDIENCE_ENV} is not set`,
        );
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/v1/community-persona-message/generate`;
    const rawBody = JSON.stringify(request);
    const { timestamp, digest } = await signRequest(rawBody);

    const tokenClient = await getTokenClient(audience);
    const authHeaders = await tokenClient.getRequestHeaders();

    const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
    const fetchImpl = options.fetchImpl ?? fetch;
    const requestId = options.requestId ?? newRequestId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    const appCheckToken =
        options.appCheckToken === undefined
            ? await getServerAppCheckTokenOrNull()
            : options.appCheckToken;
    const headers: Record<string, string> = {
        ...authHeaders,
        'Content-Type': 'application/json',
        'X-Content-Digest': digest,
        'X-Request-Timestamp': timestamp,
        'X-Request-ID': requestId,
    };
    if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    let res: Response;
    try {
        res = await fetchImpl(url, {
            method: 'POST',
            headers,
            body: rawBody,
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new CommunityPersonaMessageSidecarTimeoutError(
                Date.now() - startedAt,
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const excerpt = text.slice(0, 500);
        if (res.status === 502 && /behavioural\s+guard/i.test(text)) {
            const axisMatch = text.match(/\(([a-z_]+)\)/i);
            throw new CommunityPersonaMessageSidecarBehaviouralError(
                axisMatch?.[1] ?? 'unknown',
                excerpt,
            );
        }
        throw new CommunityPersonaMessageSidecarHttpError(res.status, excerpt);
    }

    return (await res.json()) as SidecarCommunityPersonaMessageResponse;
}
