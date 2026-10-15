/**
 * ElevenLabs Agents — the smallest server-side client Riya needs.
 *
 *   POST /v1/convai/sip-trunk/outbound-call   start an outbound call through the agent's SIP-trunk number
 *   GET  /v1/convai/conversations/{id}         reconcile a call whose webhook never arrived
 *
 * Server-only. The API key is read from ELEVENLABS_API_KEY at call time, sent only in
 * the `xi-api-key` header, and never logged, returned or stored. Nothing here is
 * importable from a client component (class gate: riya-gates.test.ts).
 *
 * Request fields are exactly the documented ones (API reference, 15 Oct 2026):
 * agent_id, agent_phone_number_id, to_number, conversation_initiation_client_data
 * { dynamic_variables, user_id }, telephony_call_config { ringing_timeout_secs }.
 * The agent does not allow prompt, first-message or voice overrides from the client
 * (platform_settings.overrides all false), and none are sent.
 *
 * Outcome classes — the same rule the Vobiz notice carrier follows:
 *   accepted              2xx with success !== false and a conversation id
 *   rejected (not placed) 4xx, or 2xx with success === false and no conversation id:
 *                         the provider answered and refused; nothing rang
 *   unknown               timeout, network error, 5xx, or a 2xx we cannot read: the request
 *                         may have reached ElevenLabs and the phone may be ringing, so the
 *                         call is NEVER retried automatically — a person looks at it.
 */

import { z } from 'zod';

export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';
export const OUTBOUND_TIMEOUT_MS = 10_000;
export const RINGING_TIMEOUT_SECS = 30;

const AGENT_ID = /^agent_[a-z0-9]{20,40}$/;
const PHONE_NUMBER_ID = /^phnum_[a-z0-9]{20,40}$/;
const BRANCH_ID = /^agtbrch_[a-z0-9]{20,40}$/;

export interface ElevenLabsConfig {
    apiKey: string;
    agentId: string;
    agentPhoneNumberId: string;
    /** Optional pinned branch (ELEVENLABS_AGENT_BRANCH_ID); null = the agent's main branch. */
    branchId: string | null;
    apiBase: string;
}

export type ElevenLabsConfigProblem =
    | 'ELEVENLABS_API_KEY_MISSING'
    | 'ELEVENLABS_AGENT_ID_MISSING'
    | 'ELEVENLABS_AGENT_ID_INVALID'
    | 'ELEVENLABS_AGENT_PHONE_NUMBER_ID_MISSING'
    | 'ELEVENLABS_AGENT_PHONE_NUMBER_ID_INVALID'
    | 'ELEVENLABS_AGENT_BRANCH_ID_INVALID'
    | 'ELEVENLABS_SOURCE_AGENT_ID_MISSING'
    | 'ELEVENLABS_AGENT_ID_IS_SOURCE_EXPORT';

/*
 * Source vs clone. A deployment must call the CONFIRMED clone, never Varunesh's source
 * agent. The source id is configuration (ELEVENLABS_SOURCE_AGENT_ID), not a literal in
 * the code, and is required so the check cannot be skipped by omission: configuring the
 * source as the agent is refused unless an operator says so explicitly
 * (ELEVENLABS_ALLOW_SOURCE_AGENT === 'true').
 */

export function readElevenLabsConfig(
    env: Record<string, string | undefined> = process.env,
): { ok: true; config: ElevenLabsConfig } | { ok: false; problems: ElevenLabsConfigProblem[] } {
    const problems: ElevenLabsConfigProblem[] = [];
    const apiKey = env.ELEVENLABS_API_KEY?.trim() ?? '';
    const agentId = env.ELEVENLABS_AGENT_ID?.trim() ?? '';
    const phoneId = env.ELEVENLABS_AGENT_PHONE_NUMBER_ID?.trim() ?? '';
    const branchId = env.ELEVENLABS_AGENT_BRANCH_ID?.trim() || null;
    const sourceAgentId = env.ELEVENLABS_SOURCE_AGENT_ID?.trim() ?? '';
    if (!apiKey) problems.push('ELEVENLABS_API_KEY_MISSING');
    if (!agentId) problems.push('ELEVENLABS_AGENT_ID_MISSING');
    else if (!AGENT_ID.test(agentId)) problems.push('ELEVENLABS_AGENT_ID_INVALID');
    if (!sourceAgentId) problems.push('ELEVENLABS_SOURCE_AGENT_ID_MISSING');
    else if (agentId && agentId === sourceAgentId && env.ELEVENLABS_ALLOW_SOURCE_AGENT !== 'true') problems.push('ELEVENLABS_AGENT_ID_IS_SOURCE_EXPORT');
    if (!phoneId) problems.push('ELEVENLABS_AGENT_PHONE_NUMBER_ID_MISSING');
    else if (!PHONE_NUMBER_ID.test(phoneId)) problems.push('ELEVENLABS_AGENT_PHONE_NUMBER_ID_INVALID');
    if (branchId && !BRANCH_ID.test(branchId)) problems.push('ELEVENLABS_AGENT_BRANCH_ID_INVALID');
    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, config: { apiKey, agentId, agentPhoneNumberId: phoneId, branchId, apiBase: ELEVENLABS_API_BASE } };
}

/** Last six characters, for logs and the console. Ids are not secrets, but there is no reason to spread them. */
export function maskId(id: string | null | undefined): string | null {
    if (!id) return null;
    return `…${id.slice(-6)}`;
}

// ── Outbound call ───────────────────────────────────────────────────────────

export interface OutboundCallRequest {
    toNumberE164: string;
    dynamicVariables: Record<string, string>;
    /** Our own opaque call id; lets a post-call payload be matched even before the conversation id is linked. */
    userId: string;
}

export type OutboundCallResult =
    | { kind: 'accepted'; conversationId: string; sipCallId: string | null }
    | { kind: 'rejected'; category: 'auth' | 'invalid_request' | 'rate_limited' | 'provider_rejected'; httpStatus: number | null }
    | { kind: 'unknown'; category: 'timeout' | 'network' | 'server_error' | 'unreadable_response'; httpStatus: number | null };

const OutboundResponseSchema = z
    .object({
        success: z.boolean().optional(),
        message: z.string().max(2000).optional().nullable(),
        conversation_id: z.string().min(1).max(200).nullable().optional(),
        sip_call_id: z.string().min(1).max(200).nullable().optional(),
    })
    .passthrough();

/** A body that is not JSON is `undefined`, however the Response implementation fails (sync throw or rejection). */
async function readJson(res: Response): Promise<unknown> {
    try {
        return await res.json();
    } catch {
        return undefined;
    }
}

export interface HttpDeps {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}

/**
 * Named startRiyaOutboundCall (never `place`), and called ONLY from
 * src/server/sampark/conversation.ts after the gate, the claim and the destination
 * resolution (riya-gates.test.ts).
 */
export async function startRiyaOutboundCall(config: ElevenLabsConfig, req: OutboundCallRequest, deps: HttpDeps = {}): Promise<OutboundCallResult> {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? OUTBOUND_TIMEOUT_MS);
    const body = {
        agent_id: config.agentId,
        agent_phone_number_id: config.agentPhoneNumberId,
        to_number: req.toNumberE164,
        conversation_initiation_client_data: {
            dynamic_variables: req.dynamicVariables,
            user_id: req.userId,
            ...(config.branchId ? { branch_id: config.branchId } : {}),
        },
        telephony_call_config: { ringing_timeout_secs: RINGING_TIMEOUT_SECS },
    };
    let res: Response;
    try {
        res = await fetchImpl(`${config.apiBase}/v1/convai/sip-trunk/outbound-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': config.apiKey },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (err) {
        const aborted = (err as { name?: string })?.name === 'AbortError';
        return { kind: 'unknown', category: aborted ? 'timeout' : 'network', httpStatus: null };
    } finally {
        clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) return { kind: 'rejected', category: 'auth', httpStatus: res.status };
    if (res.status === 429) return { kind: 'rejected', category: 'rate_limited', httpStatus: res.status };
    if (res.status === 400 || res.status === 404 || res.status === 422) return { kind: 'rejected', category: 'invalid_request', httpStatus: res.status };
    if (res.status >= 500) return { kind: 'unknown', category: 'server_error', httpStatus: res.status };
    if (res.status < 200 || res.status >= 300) return { kind: 'rejected', category: 'provider_rejected', httpStatus: res.status };

    const parsed = OutboundResponseSchema.safeParse(await readJson(res));
    if (!parsed.success) return { kind: 'unknown', category: 'unreadable_response', httpStatus: res.status };
    const conversationId = parsed.data.conversation_id ?? null;
    if (parsed.data.success === false && !conversationId) return { kind: 'rejected', category: 'provider_rejected', httpStatus: res.status };
    if (!conversationId) return { kind: 'unknown', category: 'unreadable_response', httpStatus: res.status };
    return { kind: 'accepted', conversationId, sipCallId: parsed.data.sip_call_id ?? null };
}

// ── Reconciliation ──────────────────────────────────────────────────────────

const ConversationSchema = z
    .object({
        agent_id: z.string().max(200).optional(),
        conversation_id: z.string().max(200),
        status: z.string().max(40),
        metadata: z
            .object({
                call_duration_secs: z.number().nonnegative().max(86_400).nullable().optional(),
                termination_reason: z.string().max(300).nullable().optional(),
            })
            .passthrough()
            .optional(),
        analysis: z
            .object({
                call_successful: z.string().max(20).nullable().optional(),
                data_collection_results: z.record(z.unknown()).nullable().optional(),
            })
            .passthrough()
            .nullable()
            .optional(),
    })
    .passthrough();

export interface ConversationSnapshot {
    agentId: string | null;
    conversationId: string;
    /** ElevenLabs: initiated | in-progress | processing | done | failed */
    status: string;
    durationSeconds: number | null;
    terminationReason: string | null;
    callSuccessful: string | null;
    dataCollectionResults: Record<string, unknown> | null;
}

export type ConversationFetchResult =
    | { kind: 'ok'; snapshot: ConversationSnapshot }
    | { kind: 'not_found' }
    | { kind: 'error'; category: 'auth' | 'rate_limited' | 'timeout' | 'network' | 'server_error' | 'unreadable_response'; httpStatus: number | null };

const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,200}$/;

export async function fetchConversation(config: ElevenLabsConfig, conversationId: string, deps: HttpDeps = {}): Promise<ConversationFetchResult> {
    if (!CONVERSATION_ID.test(conversationId)) return { kind: 'not_found' };
    const fetchImpl = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? OUTBOUND_TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetchImpl(`${config.apiBase}/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
            method: 'GET',
            headers: { 'xi-api-key': config.apiKey },
            signal: controller.signal,
        });
    } catch (err) {
        const aborted = (err as { name?: string })?.name === 'AbortError';
        return { kind: 'error', category: aborted ? 'timeout' : 'network', httpStatus: null };
    } finally {
        clearTimeout(timer);
    }
    if (res.status === 404) return { kind: 'not_found' };
    if (res.status === 401 || res.status === 403) return { kind: 'error', category: 'auth', httpStatus: res.status };
    if (res.status === 429) return { kind: 'error', category: 'rate_limited', httpStatus: res.status };
    if (!res.ok) return { kind: 'error', category: 'server_error', httpStatus: res.status };
    const parsed = ConversationSchema.safeParse(await readJson(res));
    if (!parsed.success) return { kind: 'error', category: 'unreadable_response', httpStatus: res.status };
    const d = parsed.data;
    return {
        kind: 'ok',
        snapshot: {
            agentId: d.agent_id ?? null,
            conversationId: d.conversation_id,
            status: d.status,
            durationSeconds: d.metadata?.call_duration_secs ?? null,
            terminationReason: d.metadata?.termination_reason ?? null,
            callSuccessful: d.analysis?.call_successful ?? null,
            dataCollectionResults: (d.analysis?.data_collection_results as Record<string, unknown> | null | undefined) ?? null,
        },
    };
}
