/**
 * The unified SARGVISION agent has one post-call webhook for two products. Sampark receives it and
 * passes Athithi Vani's hotel-call events on, unchanged and still signed
 * (src/lib/sampark/conversation/forward.ts); Sampark's own events are handled exactly as before.
 */

import crypto from 'node:crypto';

import {
    forwardResponse,
    forwardWebhook,
    isAthithiEvent,
    productContextOf,
    readForwardConfig,
    type ForwardConfig,
} from '@/lib/sampark/conversation/forward';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { handleRiyaWebhook, UNLINKED_RETRY_WINDOW_SECONDS, type RiyaDeps } from '@/server/sampark/conversation';

import { testClock } from '../engine/_fixtures';

const AGENT = 'agent_0601unifiedunifiedunified0001';
const HOTEL_AGENT = 'agent_6801hotelonlyhotelonlyhotel0001';
const SECRET = 'whsec_shared_between_both_products';
const ATHITHI_URL = 'https://atithi-voice-bridge.example.run.app/elevenlabs/post-call';
const NOW = new Date('2026-11-15T05:30:00.000Z');
const TS = Math.floor(NOW.getTime() / 1000);

function env(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
        SAMPARK_ENABLED: 'true',
        SAMPARK_ELEVENLABS_ENABLED: 'true',
        ELEVENLABS_API_KEY: 'xi-test',
        ELEVENLABS_AGENT_ID: AGENT,
        ELEVENLABS_AGENT_PHONE_NUMBER_ID: 'phnum_5301numbernumbernumbernum0001',
        ELEVENLABS_SOURCE_AGENT_ID: 'agent_0000sourcesourcesourcesource00',
        ELEVENLABS_WEBHOOK_SECRET: SECRET,
        SAMPARK_ATHITHI_WEBHOOK_URL: ATHITHI_URL,
        ...over,
    };
}

function sign(body: string, t = TS): string {
    return `t=${t},v0=${crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}`;
}

function postCall(opts: { context?: string | null; agent?: string; conversationId?: string; userId?: string } = {}): string {
    const variables: Record<string, string> = { guest_name: 'Ananya', stay_id: 's1' };
    if (opts.context) variables.product_context = opts.context;
    return JSON.stringify({
        type: 'post_call_transcription',
        event_timestamp: TS,
        data: {
            agent_id: opts.agent ?? AGENT,
            conversation_id: opts.conversationId ?? 'conv_hotel_1',
            status: 'done',
            ...(opts.userId ? { user_id: opts.userId } : {}),
            transcript: [{ role: 'agent', message: 'Namaste' }, { role: 'user', message: 'The stay was lovely.' }],
            metadata: { call_duration_secs: 40 },
            conversation_initiation_client_data: { dynamic_variables: variables },
        },
    });
}

function failure(conversationId = 'conv_hotel_2', reason = 'no-answer', eventTs = TS): string {
    return JSON.stringify({
        type: 'call_initiation_failure',
        event_timestamp: eventTs,
        data: { agent_id: AGENT, conversation_id: conversationId, failure_reason: reason },
    });
}

function deps(fetchImpl: jest.Mock, over: Record<string, string | undefined> = {}): { deps: RiyaDeps; calls: ReturnType<typeof createMemoryConversationRepo> } {
    const calls = createMemoryConversationRepo();
    return {
        calls,
        deps: { repo: createMemorySamparkRepo(), calls, clock: testClock(NOW), env: env(over), http: { fetchImpl: fetchImpl as unknown as typeof fetch } },
    };
}

const replying = (status: number) => jest.fn(async () => new Response('{}', { status }));

describe('Athithi Vani webhook forwarding', () => {
    it('forwards a hotel call byte for byte with its signature, and answers 200', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl);
        const body = postCall({ context: 'athithi' });
        const signature = sign(body);

        expect(await handleRiyaWebhook(d, body, signature)).toEqual({ status: 200, body: { ok: true, forwarded: true } });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(ATHITHI_URL);
        expect(init.method).toBe('POST');
        expect(init.body).toBe(body);
        expect((init.headers as Record<string, string>)['ElevenLabs-Signature']).toBe(signature);
    });

    it('never forwards an event that failed our own signature check', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl);
        const body = postCall({ context: 'athithi' });
        expect((await handleRiyaWebhook(d, body, sign(body + 'x'))).status).toBe(401);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('a Sampark call is handled here, not forwarded', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl);
        const body = postCall({ context: 'sampark', conversationId: 'conv_school_1' });
        const outcome = await handleRiyaWebhook(d, body, sign(body));
        expect(fetchImpl).not.toHaveBeenCalled();
        // Unlinked and young: the existing "not yet linked" answer, unchanged.
        expect(outcome.status).toBe(503);
    });

    it('a failure without client data stays with Sampark, exactly as before forwarding', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl);

        // Fresh and unlinked: may be Sampark's own failure racing its start request. The existing
        // "not yet linked" 503, so ElevenLabs retries.
        const fresh = failure('conv_unknown_2');
        expect(await handleRiyaWebhook(d, fresh, sign(fresh))).toEqual({ status: 503, body: { ok: false, error: 'not yet linked' } });

        // Old and still unlinked: acknowledged and ignored, as before.
        const old = failure('conv_unknown_2', 'no-answer', TS - UNLINKED_RETRY_WINDOW_SECONDS - 1);
        expect(await handleRiyaWebhook(d, old, sign(old))).toEqual({ status: 200, body: { ok: true } });

        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("Sampark's own failure that beats its start request is not lost to Athithi (regression)", async () => {
        const fetchImpl = replying(200);
        const { deps: d, calls } = deps(fetchImpl);
        const body = failure('conv_school_3', 'busy');

        // First delivery arrives before the start request returned: 503, retried.
        expect((await handleRiyaWebhook(d, body, sign(body))).status).toBe(503);
        // The start request returns and links the conversation; the retry is now Sampark's.
        await calls.linkConversation('conv_school_3', { orgId: 'org-1', callId: 'd'.repeat(32), createdAt: NOW.toISOString() });
        const retried = await handleRiyaWebhook(d, body, sign(body));
        expect(retried.body).not.toHaveProperty('forwarded');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('a failure that does carry product_context=athithi is forwarded at once', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl);
        const body = JSON.stringify({
            type: 'call_initiation_failure',
            event_timestamp: TS,
            data: {
                agent_id: AGENT,
                conversation_id: 'conv_hotel_4',
                failure_reason: 'busy',
                conversation_initiation_client_data: { dynamic_variables: { product_context: 'athithi' } },
            },
        });
        expect((await handleRiyaWebhook(d, body, sign(body))).body).toMatchObject({ forwarded: true });
    });

    it('a post-call with a Sampark user id is never forwarded', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl);
        const body = postCall({ context: null, userId: `org-1~${'b'.repeat(32)}` });
        await handleRiyaWebhook(d, body, sign(body));
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('a hotel-only agent on the same webhook is forwarded only when listed', async () => {
        const fetchImpl = replying(200);
        const body = postCall({ context: null, agent: HOTEL_AGENT });

        const off = deps(fetchImpl);
        expect(await handleRiyaWebhook(off.deps, body, sign(body))).toEqual({ status: 200, body: { ok: true } });
        expect(fetchImpl).not.toHaveBeenCalled();

        const on = deps(fetchImpl, { SAMPARK_ATHITHI_AGENT_IDS: HOTEL_AGENT });
        expect((await handleRiyaWebhook(on.deps, body, sign(body))).body).toMatchObject({ forwarded: true });
    });

    it('Athithi down: 503 so ElevenLabs retries; Athithi refusing: 200 so the shared webhook is not disabled', async () => {
        const body = postCall({ context: 'athithi' });
        expect((await handleRiyaWebhook(deps(replying(502)).deps, body, sign(body))).status).toBe(503);
        const network = jest.fn(async () => {
            throw new TypeError('fetch failed');
        });
        expect((await handleRiyaWebhook(deps(network).deps, body, sign(body))).status).toBe(503);
        expect(await handleRiyaWebhook(deps(replying(401)).deps, body, sign(body))).toEqual({ status: 200, body: { ok: true, forwarded: false } });
    });

    it('with forwarding off, behaviour is exactly as before', async () => {
        const fetchImpl = replying(200);
        const { deps: d } = deps(fetchImpl, { SAMPARK_ATHITHI_WEBHOOK_URL: undefined });
        const body = postCall({ context: 'athithi' });
        expect((await handleRiyaWebhook(d, body, sign(body))).status).toBe(503);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('forward helpers', () => {
    const config: ForwardConfig = { url: ATHITHI_URL, agentIds: new Set([HOTEL_AGENT]) };

    it('accepts only https (or http on localhost)', () => {
        expect(readForwardConfig({ SAMPARK_ATHITHI_WEBHOOK_URL: ATHITHI_URL })?.url).toBe(ATHITHI_URL);
        expect(readForwardConfig({ SAMPARK_ATHITHI_WEBHOOK_URL: 'http://evil.example/x' })).toBeNull();
        expect(readForwardConfig({ SAMPARK_ATHITHI_WEBHOOK_URL: 'http://localhost:8080/elevenlabs/post-call' })).not.toBeNull();
        expect(readForwardConfig({ SAMPARK_ATHITHI_WEBHOOK_URL: 'not a url' })).toBeNull();
        expect(readForwardConfig({})).toBeNull();
    });

    it('reads product_context, case-insensitively, and tolerates junk', () => {
        expect(productContextOf(postCall({ context: 'Athithi' }))).toBe('athithi');
        expect(productContextOf(postCall({ context: null }))).toBeNull();
        expect(productContextOf('{')).toBeNull();
    });

    it('classifies events', () => {
        const base = { agentId: 'agent_x', ourAgentId: 'agent_x' };
        expect(isAthithiEvent({ ...base, productContext: 'athithi' }, config)).toBe(true);
        expect(isAthithiEvent({ ...base, productContext: 'sampark' }, config)).toBe(false);
        expect(isAthithiEvent({ ...base, productContext: null }, config)).toBe(false);
        expect(isAthithiEvent({ ...base, productContext: null, agentId: 'agent_other' }, config)).toBe(false);
        expect(isAthithiEvent({ ...base, productContext: null, agentId: HOTEL_AGENT }, config)).toBe(true);
        expect(isAthithiEvent({ ...base, productContext: 'athithi', agentId: 'agent_other' }, config)).toBe(true);
    });

    it('maps a timeout to a retry', async () => {
        const hang = jest.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
                }),
        );
        const outcome = await forwardWebhook(config, '{}', 'sig', { fetchImpl: hang as unknown as typeof fetch, timeoutMs: 5 });
        expect(outcome).toMatchObject({ delivered: false, permanent: false, reason: 'timeout' });
        expect(forwardResponse(outcome).status).toBe(503);
    });
});
