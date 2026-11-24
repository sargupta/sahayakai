/** @jest-environment node */
/**
 * Plivo and Exotel as the third and fourth real Riya providers, through the SAME Sampark service
 * as ElevenLabs and Vobiz: provider options, dialing (no child data in any URL, the carrier's own
 * API and auth), the carrier legs (Plivo answer/status with token + V3 signature, Exotel status
 * with token), the shared bridge context/event legs, and the shared reducer. All mocked: no
 * request leaves the process.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { signBridgeBody, vobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import { exotelStreamUrl, readExotelRiyaConfig } from '@/lib/sampark/conversation/exotel-provider';
import { readPlivoRiyaConfig } from '@/lib/sampark/conversation/plivo-provider';
import { plivoRingFailure, plivoV3Signature, plivoV3SignedString, verifyPlivoSignatureV3 } from '@/lib/plivo/client';
import { exotelOutcome, readExotelConfig, toExotelNumber } from '@/lib/exotel/client';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { _resetVobizKeyCacheForTest, mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';
import { BRIDGE_RESULT_GRACE_MS, getRiyaCall, previewRiyaCall, providerOptions, riyaAvailability, startRiyaCall, type RiyaDeps } from '@/server/sampark/conversation';
import { handleExotelRiyaStatus } from '@/server/sampark/exotel-riya';
import { handlePlivoRiyaAnswer, handlePlivoRiyaStatus, type PlivoCallback } from '@/server/sampark/plivo-riya';
import { handleVobizRiyaContext, handleVobizRiyaEvent } from '@/server/sampark/vobiz-riya';
import type { SamparkSchool } from '@/types/sampark';

import { guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const ORG = 'hillview-demo';
const ADMIN = 'admin-uid';
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
// Test-only values (not real people, numbers or credentials).
const TEST_PHONE = '+919800000001';
const KEY = 'test-signing-key-not-real-0123456789';
const PLIVO_ID = 'MAXXXXXXXXXXXXXXXXXX';
const PLIVO_TOKEN = 'plivo_tok_test_only';
const PTM: RiyaFacts = { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } };

const baseEnv = {
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
    SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(','),
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: TEST_PHONE,
    SAMPARK_PUBLIC_BASE_URL: 'https://sampark.example.test',
    RIYA_BRIDGE_BASE_URL: 'https://bridge.example.test',
    SAHAYAKAI_REQUEST_SIGNING_KEY: KEY,
};

const plivoEnv = (over: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
    ...baseEnv,
    SAMPARK_PLIVO_RIYA_ENABLED: 'true',
    PLIVO_AUTH_ID: PLIVO_ID,
    PLIVO_AUTH_TOKEN: PLIVO_TOKEN,
    PLIVO_FROM_NUMBER: '+918000000000',
    ...over,
});

const exotelEnv = (over: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
    ...baseEnv,
    SAMPARK_EXOTEL_RIYA_ENABLED: 'true',
    EXOTEL_API_KEY: 'exo_key_test_only',
    EXOTEL_API_TOKEN: 'exo_tok_test_only',
    EXOTEL_ACCOUNT_SID: 'sargtest1',
    EXOTEL_SUBDOMAIN: 'api.in.exotel.com',
    EXOTEL_CALLER_ID: '08000000000',
    ...over,
});

const PLIVO_UUID = '11111111-2222-3333-4444-555555555555';
const EXOTEL_SID = 'c0ffee00c0ffee00c0ffee00c0ffee00';

function plivoAccepted() {
    return jest.fn(async () => new Response(JSON.stringify({ message: 'call fired', request_uuid: PLIVO_UUID, api_id: 'a1' }), { status: 201 }));
}
function exotelAccepted() {
    return jest.fn(async () => new Response(JSON.stringify({ Call: { Sid: EXOTEL_SID, Status: 'in-progress' } }), { status: 200 }));
}

async function setup(provider: 'plivo' | 'exotel', opts: { env?: Record<string, string | undefined>; fetchImpl?: jest.Mock } = {}) {
    setPhoneEnv();
    process.env.SAHAYAKAI_REQUEST_SIGNING_KEY = KEY;
    _resetVobizKeyCacheForTest();
    const env = opts.env ?? (provider === 'plivo' ? plivoEnv() : exotelEnv());
    process.env.SAMPARK_LIVE_DIAL_ENABLED = env.SAMPARK_LIVE_DIAL_ENABLED; // the dial gate reads it
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const callbacks = createMemoryCallbackRepo();
    const clock = testClock(WED_11_IST);
    await repo.upsertSchool(school({
        mode: 'test',
        testPhoneEnc: encryptPhone(TEST_PHONE), testPhoneHash: hashPhone(TEST_PHONE), testPhoneLast4: '0001',
        conversationProvider: provider,
    } as Partial<SamparkSchool>));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', { phoneEnc: encryptPhone('+919811111111'), phoneHash: hashPhone('+919811111111'), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    const fetchImpl = opts.fetchImpl ?? (provider === 'plivo' ? plivoAccepted() : exotelAccepted());
    const deps: RiyaDeps = { repo, calls, callbacks, clock, wallClock: clock, env, http: { fetchImpl: fetchImpl as unknown as typeof fetch } };
    return { deps, repo, calls, fetchImpl, env, clock };
}

async function start(deps: RiyaDeps) {
    const preview = await previewRiyaCall(deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM });
    return startRiyaCall(deps, ORG, ADMIN, {
        purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM,
        idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement ?? 'x',
    });
}

/** A Plivo callback exactly as Plivo would sign it (V3) for our PUBLIC url. */
function plivoCallback(pathAndQuery: string, form: Record<string, string>, token = PLIVO_TOKEN): PlivoCallback {
    const nonce = '12345678901234567890';
    return { pathAndQuery, form, nonce, signature: plivoV3Signature(token, `https://sampark.example.test${pathAndQuery}`, form, nonce) };
}

function bridgeEvent(ref: string, callUuid: string) {
    return JSON.stringify({
        ref, callUuid, eventTimestamp: Math.floor(WED_11_IST.getTime() / 1000),
        status: 'done', durationSeconds: 42, terminationReason: 'parent_ended', callSuccessful: 'success',
        dataCollection: { good_time_to_talk: 'yes', ptm_attendance: 'will_attend', recipient_confirmed: 'yes' },
        transcript: [{ role: 'agent', message: 'Hello' }, { role: 'user', message: 'Yes.' }],
    });
}

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
});

describe('four providers at the SamparkAI entry', () => {
    it('offers all four; each unconfigured one names its missing settings (never values)', () => {
        const opts = providerOptions({ ...baseEnv });
        expect(opts.map((o) => o.id)).toEqual(['elevenlabs', 'vobiz', 'plivo', 'exotel']);
        const plivo = opts.find((o) => o.id === 'plivo');
        expect(plivo?.available).toBe(false);
        expect(plivo?.problems).toEqual(expect.arrayContaining(['SAMPARK_PLIVO_RIYA_ENABLED', 'PLIVO_AUTH_ID', 'PLIVO_AUTH_TOKEN', 'PLIVO_FROM_NUMBER']));
        expect(opts.find((o) => o.id === 'exotel')?.problems).toEqual(expect.arrayContaining(['EXOTEL_API_KEY', 'EXOTEL_SUBDOMAIN', 'EXOTEL_CALLER_ID']));
    });

    it('configured Plivo and Exotel are available, alongside the others', () => {
        const opts = providerOptions({ ...plivoEnv(), ...exotelEnv() });
        expect(opts.find((o) => o.id === 'plivo')?.available).toBe(true);
        expect(opts.find((o) => o.id === 'exotel')?.available).toBe(true);
    });

    it('the bridge url falls back to VOBIZ_STREAM_BASE_URL (one bridge for every carrier)', () => {
        const r = readPlivoRiyaConfig(plivoEnv({ RIYA_BRIDGE_BASE_URL: undefined, VOBIZ_STREAM_BASE_URL: 'https://bridge.example.test' }));
        expect(r.ok && r.config.bridgeBaseUrl).toBe('https://bridge.example.test');
    });

    it('Exotel refuses an unknown region subdomain; India accounts use api.in.exotel.com', () => {
        expect(readExotelConfig(exotelEnv({ EXOTEL_SUBDOMAIN: 'api.exotel.in' })).ok).toBe(false);
        expect(readExotelConfig(exotelEnv({ EXOTEL_SUBDOMAIN: 'https://api.in.exotel.com/' })).ok).toBe(true);
        expect(readExotelConfig(exotelEnv({ EXOTEL_SUBDOMAIN: 'api.exotel.com' })).ok).toBe(true);
    });

    it('an unconfigured chosen provider is a named blocker, never a dial', async () => {
        const { repo } = await setup('plivo');
        const a = riyaAvailability((await repo.getSchool(ORG)) as SamparkSchool, plivoEnv({ PLIVO_AUTH_TOKEN: undefined }));
        expect(a.selectedProvider).toBe('plivo');
        expect(a.blocker).toBe('PLIVO_UNCONFIGURED');
        expect(a.configProblems).toEqual(['PLIVO_AUTH_TOKEN']);
        const e = riyaAvailability({ ...(await repo.getSchool(ORG)), conversationProvider: 'exotel' } as SamparkSchool, exotelEnv({ EXOTEL_CALLER_ID: undefined }));
        expect(e.blocker).toBe('EXOTEL_UNCONFIGURED');
    });
});

describe('Plivo', () => {
    it('places ONE call on Plivo (HTTP Basic, digits, answer/hangup/ring URLs); no child data in any URL', async () => {
        const { deps, fetchImpl } = await setup('plivo');
        const r = await start(deps);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`https://api.plivo.com/v1/Account/${PLIVO_ID}/Call/`);
        expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from(`${PLIVO_ID}:${PLIVO_TOKEN}`).toString('base64')}`);
        const body = JSON.parse(String(init.body));
        expect(body.to).toBe('919800000001');
        expect(body.from).toBe('918000000000');
        expect(body.answer_url).toMatch(/^https:\/\/sampark\.example\.test\/api\/webhooks\/plivo-riya\/answer\?t=/);
        expect(body.hangup_url).toContain('/api/webhooks/plivo-riya/status?kind=hangup&t=');
        expect(body.ring_url).toContain('/api/webhooks/plivo-riya/status?kind=ring&t=');
        expect(body.time_limit).toBe(660);
        expect(JSON.stringify(body)).not.toMatch(/Asha|2026-10-10|ptm/i);
        expect(r.call.provider).toBe('plivo');
        expect(r.call.state).toBe('initiated');
        expect(r.call.providerConversationId).toBe(`plivo:${PLIVO_UUID}`);
    });

    it('refusals map like every provider: 4xx failed, 5xx/network unknown (never redialled)', async () => {
        const refused = await setup('plivo', { fetchImpl: jest.fn(async () => new Response('bad', { status: 400 })) });
        expect((await start(refused.deps)).call.state).toBe('failed');
        const broken = await setup('plivo', { fetchImpl: jest.fn(async () => new Response('x', { status: 503 })) });
        expect((await start(broken.deps)).call.state).toBe('unknown');
    });

    it('answer: token + valid V3 signature → bidirectional <Stream> to the bridge plivo socket', async () => {
        const { deps } = await setup('plivo');
        const { call } = await start(deps);
        const answerUrl = JSON.parse(String((deps.http?.fetchImpl as unknown as jest.Mock).mock.calls[0][1].body)).answer_url as string;
        const path = answerUrl.replace('https://sampark.example.test', '');
        const out = await handlePlivoRiyaAnswer(deps, plivoCallback(path, { CallUUID: PLIVO_UUID, From: '918000000000', To: '919800000001', Event: 'StartApp' }));
        expect(out.xml).toContain('<Stream bidirectional="true" audioTrack="inbound" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000" statusCallbackUrl="https://sampark.example.test/api/webhooks/plivo-riya/status?kind=stream&amp;t=');
        expect(out.xml).toContain('statusCallbackMethod="POST">');
        expect(out.xml).toContain('wss://bridge.example.test/telephony/plivo/stream?t=');
        expect(out.xml).toContain(`cuid=${PLIVO_UUID}`);
        expect(call.provider).toBe('plivo');
    });

    it('answer: a bad signature, a Vobiz token, or no token hangs up', async () => {
        const { deps } = await setup('plivo');
        await start(deps);
        const answerUrl = JSON.parse(String((deps.http?.fetchImpl as unknown as jest.Mock).mock.calls[0][1].body)).answer_url as string;
        const path = answerUrl.replace('https://sampark.example.test', '');
        const forged = { ...plivoCallback(path, { CallUUID: PLIVO_UUID }), signature: 'AAAA' };
        expect((await handlePlivoRiyaAnswer(deps, forged)).xml).toContain('<Hangup/>');
        const wrongKey = plivoCallback(path, { CallUUID: PLIVO_UUID }, 'some-other-token');
        expect((await handlePlivoRiyaAnswer(deps, wrongKey)).xml).toContain('<Hangup/>');
        const calls = await deps.calls.listCalls(ORG, 5);
        const vobizToken = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_ANSWER, vobizRiyaRef(ORG, calls[0].id))).token;
        const crossCarrier = `/api/webhooks/plivo-riya/answer?t=${encodeURIComponent(vobizToken)}`;
        expect((await handlePlivoRiyaAnswer(deps, plivoCallback(crossCarrier, { CallUUID: PLIVO_UUID }))).xml).toContain('<Hangup/>');
    });

    it('status: an unanswered hangup settles busy / no-answer; an answered one only frees the line', async () => {
        const busy = await setup('plivo');
        const c1 = (await start(busy.deps)).call;
        const hangupUrl = JSON.parse(String(busy.fetchImpl.mock.calls[0][1].body)).hangup_url as string;
        const path = hangupUrl.replace('https://sampark.example.test', '');
        await handlePlivoRiyaStatus(busy.deps, 'hangup', plivoCallback(path, { CallUUID: PLIVO_UUID, HangupCauseName: 'Busy Line', CallStatus: 'busy' }));
        expect((await busy.deps.calls.getCall(ORG, c1.id))?.state).toBe('busy');

        const answered = await setup('plivo');
        const c2 = (await start(answered.deps)).call;
        const hangup2 = (JSON.parse(String(answered.fetchImpl.mock.calls[0][1].body)).hangup_url as string).replace('https://sampark.example.test', '');
        await handlePlivoRiyaStatus(answered.deps, 'hangup', plivoCallback(hangup2, { CallUUID: PLIVO_UUID, AnswerTime: '2026-10-07 11:00:01', CallStatus: 'completed' }));
        const after = await answered.deps.calls.getCall(ORG, c2.id);
        expect(after?.state).toBe('initiated'); // the bridge reports the conversation
        expect(after?.providerStatus).toBe('carrier_ended');
    });

    it('signature: pinned signed-string shape; comma-separated multi-token headers verify', () => {
        expect(plivoV3SignedString('https://ex.test/a?z=1&b=2', { To: '91', From: '80', CallUUID: 'u' }, 'N')).toBe('https://ex.test/a?b=2&z=1.CallUUIDuFrom80To91.N');
        const sig = plivoV3Signature('tok', 'https://ex.test/a', { A: '1' }, 'N');
        expect(verifyPlivoSignatureV3('tok', 'https://ex.test/a', { A: '1' }, 'N', `zzz,${sig}`)).toEqual({ ok: true });
        expect(verifyPlivoSignatureV3('tok', 'https://ex.test/a', { A: '2' }, 'N', sig).ok).toBe(false);
        expect(verifyPlivoSignatureV3(undefined, 'https://ex.test/a', {}, 'N', sig)).toEqual({ ok: false, reason: 'no_secret' });
    });

    it('ring-failure names map conservatively', () => {
        expect(plivoRingFailure('Busy Line')).toBe('busy');
        expect(plivoRingFailure('No Answer')).toBe('no-answer');
        expect(plivoRingFailure('Ring Timeout Reached')).toBe('no-answer');
        expect(plivoRingFailure('Normal Hangup')).toBe('unknown');
    });
});

describe('Exotel', () => {
    it('places ONE Connect-Voice-AI call: bidirectional StreamUrl to the bridge, JSON status callback, no child data', async () => {
        const { deps, fetchImpl } = await setup('exotel');
        const r = await start(deps);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.in.exotel.com/v1/Accounts/sargtest1/Calls/connect.json');
        expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('exo_key_test_only:exo_tok_test_only').toString('base64')}`);
        const form = new URLSearchParams(String(init.body));
        expect(form.get('From')).toBe('09800000001');
        expect(form.get('CallerId')).toBe('08000000000');
        expect(form.get('StreamType')).toBe('bidirectional');
        const streamUrl = form.get('StreamUrl') ?? '';
        // `t` is an Exotel custom parameter: Exotel opens the bare path and echoes it in its first frames.
        expect(streamUrl).toMatch(/^wss:\/\/bridge\.example\.test\/telephony\/exotel\/stream\?t=sampark%7Ehillview-demo%7E[a-f0-9]{32}\.\d+\.[A-Za-z0-9_-]+$/);
        expect(streamUrl.length).toBeLessThanOrEqual(600);
        expect(form.get('StatusCallback')).toMatch(/^https:\/\/sampark\.example\.test\/api\/webhooks\/exotel-riya\/status\?t=/);
        expect(form.getAll('StatusCallbackEvents[]')).toEqual(['terminal', 'answered']);
        expect(form.get('StatusCallbackContentType')).toBe('application/json');
        expect(form.get('TimeLimit')).toBe('660');
        expect(String(init.body)).not.toMatch(/Asha|2026-10-10|ptm/i);
        expect(r.call.provider).toBe('exotel');
        expect(r.call.providerConversationId).toBe(`exotel:${EXOTEL_SID}`);
    });

    it('status: busy / no-answer settle the call; completed only frees the line; a bad token changes nothing', async () => {
        const { deps, fetchImpl } = await setup('exotel');
        const c = (await start(deps)).call;
        const statusUrl = new URL(new URLSearchParams(String(fetchImpl.mock.calls[0][1].body)).get('StatusCallback') ?? '');
        await handleExotelRiyaStatus(deps, 'forged.1.x', { CallSid: EXOTEL_SID, Status: 'busy' });
        expect((await deps.calls.getCall(ORG, c.id))?.state).toBe('initiated');
        await handleExotelRiyaStatus(deps, statusUrl.searchParams.get('t'), { CallSid: EXOTEL_SID, Status: 'completed', ConversationDuration: '30' });
        expect((await deps.calls.getCall(ORG, c.id))?.providerStatus).toBe('carrier_ended');

        const other = await setup('exotel');
        const c2 = (await start(other.deps)).call;
        const t2 = new URL(new URLSearchParams(String(other.fetchImpl.mock.calls[0][1].body)).get('StatusCallback') ?? '').searchParams.get('t');
        await handleExotelRiyaStatus(other.deps, t2, { CallSid: EXOTEL_SID, Status: 'no-answer' });
        expect((await other.deps.calls.getCall(ORG, c2.id))?.state).toBe('no_answer');
    });

    it('a call whose line ended with no bridge result settles as failed after the grace period (does not block the next call)', async () => {
        const { deps, fetchImpl, clock } = await setup('exotel');
        const c = (await start(deps)).call;
        const t = new URL(new URLSearchParams(String(fetchImpl.mock.calls[0][1].body)).get('StatusCallback') ?? '').searchParams.get('t');
        await handleExotelRiyaStatus(deps, t, { CallSid: EXOTEL_SID, Status: 'completed', ConversationDuration: '9' });
        expect((await getRiyaCall(deps, ORG, c.id)).call.state).toBe('initiated'); // still waiting for the bridge
        clock.advance(BRIDGE_RESULT_GRACE_MS + 1000);
        const after = (await getRiyaCall(deps, ORG, c.id)).call;
        expect(after.state).toBe('failed');
        expect(after.failureReason).toMatch(/^no_voice_stream/);
        // A late, authentic bridge result still wins.
        const body = bridgeEvent(vobizRiyaRef(ORG, c.id), EXOTEL_SID);
        await handleVobizRiyaEvent(deps, body, signBridgeBody(KEY, body, Math.floor(clock.now().getTime() / 1000)));
        expect((await deps.calls.getCall(ORG, c.id))?.state).toBe('completed');
    });

    it('stream URL respects Exotel limits; status mapping is conservative; numbers are Exotel-shaped', () => {
        expect(exotelStreamUrl('https://b.test', 'x'.repeat(300))).toBeNull(); // token over 256 chars
        expect(exotelStreamUrl('https://b.test', 'a/b?c')).toBeNull(); // never a path or query break-out
        expect(exotelStreamUrl('ftp://b.test', 'x')).toBeNull();
        expect(exotelOutcome('busy')).toBe('busy');
        expect(exotelOutcome('failed')).toBe('unknown');
        expect(exotelOutcome('in-progress')).toBe('open');
        expect(toExotelNumber('+919800000001')).toBe('09800000001');
        expect(readExotelRiyaConfig({}).ok).toBe(false);
    });
});

describe('shared bridge legs serve every carrier', () => {
    it.each(['plivo', 'exotel'] as const)('%s: the bridge gets the context and its signed result completes the call', async (provider) => {
        const { deps } = await setup(provider);
        const call = (await start(deps)).call;
        const ref = vobizRiyaRef(ORG, call.id);
        const ctxToken = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_CONTEXT, ref)).token;
        const ctx = await handleVobizRiyaContext(deps, ctxToken);
        expect(ctx.status).toBe(200);
        const uuid = provider === 'plivo' ? PLIVO_UUID : EXOTEL_SID;
        const body = bridgeEvent(ref, uuid);
        const sig = signBridgeBody(KEY, body, Math.floor(WED_11_IST.getTime() / 1000));
        const out = await handleVobizRiyaEvent(deps, body, sig);
        expect(out.status).toBe(200);
        const done = await deps.calls.getCall(ORG, call.id);
        expect(done?.state).toBe('completed');
        expect(done?.agentId).toBe(`sahayakai-${provider}-riya`);
        expect(done?.durationSeconds).toBe(42);
    });

    it('a carrier switched off no longer gets context or results', async () => {
        const { deps } = await setup('plivo');
        const call = (await start(deps)).call;
        const off = { ...deps, env: plivoEnv({ SAMPARK_PLIVO_RIYA_ENABLED: 'false' }) };
        const ctxToken = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_CONTEXT, vobizRiyaRef(ORG, call.id))).token;
        expect((await handleVobizRiyaContext(off, ctxToken)).status).toBe(404);
    });
});
