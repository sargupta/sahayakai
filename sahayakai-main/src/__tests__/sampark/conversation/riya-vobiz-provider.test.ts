/** @jest-environment node */
/**
 * Vobiz as the second real Riya provider, through the SAME Sampark service: provider choice
 * (setting, availability, blockers), dialing (no child data in any URL), the four public legs
 * (answer, status, context, event), the shared reducer (completion, callbacks, stop, duplicates),
 * one daily cap across providers, and that ElevenLabs schools are untouched.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';

import { createMemoryCallbackRepo } from '@/lib/sampark/callbacks/repo';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import type { RiyaFacts } from '@/lib/sampark/conversation/facts';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import {
    parseVobizRiyaRef,
    readVobizRiyaConfig,
    signBridgeBody,
    verifyBridgeSignature,
    vobizRiyaRef,
    vobizRingFailure,
} from '@/lib/sampark/conversation/vobiz-provider';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { AuditEntry } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { _resetVobizKeyCacheForTest, mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';
import { previewRiyaCall, riyaAvailability, startRiyaCall, type RiyaDeps } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';
import { setConversationProvider } from '@/server/sampark/school';
import { handleVobizRiyaAnswer, handleVobizRiyaContext, handleVobizRiyaEvent, handleVobizRiyaStatus } from '@/server/sampark/vobiz-riya';
import type { SamparkSchool } from '@/types/sampark';

import { guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from '../server/_helpers';

const ORG = 'hillview-demo';
const ADMIN = 'admin-uid';
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
// Test-only values (not real people, numbers or credentials).
const TEST_PHONE = '+919800000001';
const KEY = 'test-signing-key-not-real-0123456789';
const PTM: RiyaFacts = { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } };

const vobizEnv = (over: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
    SAMPARK_ENABLED: 'true',
    SAMPARK_ELEVENLABS_ENABLED: 'true',
    SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(','),
    SAMPARK_LIVE_DIAL_ENABLED: 'true',
    SAMPARK_FIRESTORE_DATABASE: 'sampark-nonprod',
    SAMPARK_RIYA_TEST_ALLOWED_NUMBERS: TEST_PHONE,
    SAMPARK_VOBIZ_RIYA_ENABLED: 'true',
    VOBIZ_AUTH_ID: 'MA_TEST_ONLY',
    VOBIZ_AUTH_TOKEN: 'tok_test_only',
    VOBIZ_FROM_NUMBER: '+918000000000',
    SAMPARK_PUBLIC_BASE_URL: 'https://sampark.example.test',
    VOBIZ_STREAM_BASE_URL: 'https://bridge.example.test',
    SAHAYAKAI_REQUEST_SIGNING_KEY: KEY,
    ...over,
});

function vobizAccepted(uuid = '11111111-2222-3333-4444-555555555555') {
    return jest.fn(async () => new Response(JSON.stringify({ request_uuid: uuid, message: 'call queued' }), { status: 201 }));
}

async function setup(opts: { provider?: 'elevenlabs' | 'vobiz'; env?: Record<string, string | undefined>; fetchImpl?: jest.Mock } = {}) {
    setPhoneEnv();
    process.env.SAHAYAKAI_REQUEST_SIGNING_KEY = KEY;
    _resetVobizKeyCacheForTest();
    const env = opts.env ?? vobizEnv();
    process.env.SAMPARK_LIVE_DIAL_ENABLED = env.SAMPARK_LIVE_DIAL_ENABLED;
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const callbacks = createMemoryCallbackRepo();
    const clock = testClock(WED_11_IST);
    const s: Partial<SamparkSchool> = {
        mode: 'test',
        testPhoneEnc: encryptPhone(TEST_PHONE), testPhoneHash: hashPhone(TEST_PHONE), testPhoneLast4: '0001',
        conversationProvider: opts.provider ?? 'vobiz',
    };
    await repo.upsertSchool(school(s));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', { phoneEnc: encryptPhone('+919811111111'), phoneHash: hashPhone('+919811111111'), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    const audits: AuditEntry[] = [];
    const original = repo.appendAudit.bind(repo);
    repo.appendAudit = async (orgId, entry) => { audits.push(entry); await original(orgId, entry); };
    const fetchImpl = opts.fetchImpl ?? vobizAccepted();
    const deps: RiyaDeps = { repo, calls, callbacks, clock, wallClock: clock, env, http: { fetchImpl: fetchImpl as unknown as typeof fetch } };
    return { deps, repo, calls, callbacks, clock, fetchImpl, audits, env };
}

async function start(deps: RiyaDeps) {
    const preview = await previewRiyaCall(deps, ORG, { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM });
    return startRiyaCall(deps, ORG, ADMIN, {
        purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM,
        idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement ?? 'x',
    });
}

function eventBody(ref: string, over: Record<string, unknown> = {}) {
    return JSON.stringify({
        ref, callUuid: '11111111-2222-3333-4444-555555555555', eventTimestamp: Math.floor(WED_11_IST.getTime() / 1000),
        status: 'done', durationSeconds: 61, terminationReason: 'parent_ended', callSuccessful: 'success',
        dataCollection: { good_time_to_talk: 'yes', ptm_attendance: 'cannot_attend', ptm_preferred_time: 'Saturday morning', recipient_confirmed: 'yes' },
        transcript: [{ role: 'agent', message: 'Hello' }, { role: 'user', message: 'Yes, tell me.' }],
        ...over,
    });
}

afterEach(() => {
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
});

describe('provider choice', () => {
    it('defaults to ElevenLabs and switching is audited; the same school view comes back', async () => {
        const { repo, audits, clock } = await setup({ provider: 'elevenlabs' });
        const ctx = { repo, clock } as never;
        const next = await setConversationProvider(ctx, ORG, ADMIN, 'vobiz');
        expect(next.conversationProvider).toBe('vobiz');
        expect(audits.map((a) => a.action)).toContain('school.conversation_provider');
        const again = await setConversationProvider(ctx, ORG, ADMIN, 'vobiz');
        expect(again.updatedAt).toBe(next.updatedAt); // asking again changes nothing
    });

    it('availability reports the chosen provider; unconfigured Vobiz is a named blocker, never a dial', async () => {
        const { repo } = await setup({ env: vobizEnv({ VOBIZ_STREAM_BASE_URL: undefined }) });
        const s = (await repo.getSchool(ORG)) as SamparkSchool;
        const a = riyaAvailability(s, vobizEnv({ VOBIZ_STREAM_BASE_URL: undefined }));
        expect(a.selectedProvider).toBe('vobiz');
        expect(a.blocker).toBe('VOBIZ_UNCONFIGURED');
        expect(a.configProblems).toEqual(['VOBIZ_STREAM_BASE_URL']);
        expect(JSON.stringify(a)).not.toContain('tok_test_only');
    });

    it('an ElevenLabs school is unchanged by the Vobiz settings', async () => {
        const { repo } = await setup({ provider: 'elevenlabs' });
        const a = riyaAvailability((await repo.getSchool(ORG)) as SamparkSchool, vobizEnv());
        expect(a.selectedProvider).toBe('elevenlabs');
        expect(a.blocker).toBe('ELEVENLABS_UNCONFIGURED'); // its own config, not Vobiz's
    });

    it('config problems are names only', () => {
        const r = readVobizRiyaConfig({});
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.problems.join(' ')).not.toMatch(/tok_|MA_/);
    });
});

describe('dialing through the shared start path', () => {
    it('places ONE Vobiz call to the test phone; no child data in any URL; records provider and agent', async () => {
        const { deps, fetchImpl } = await setup();
        const r = await start(deps);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.vobiz.ai/api/v1/Account/MA_TEST_ONLY/Call/');
        const body = JSON.parse(String(init.body));
        expect(body.to).toBe('919800000001');
        expect(body.answer_url).toMatch(/^https:\/\/sampark\.example\.test\/api\/webhooks\/vobiz-riya\/answer\?t=/);
        expect(body.hangup_url).toContain('/api/webhooks/vobiz-riya/status?kind=hangup&t=');
        expect(JSON.stringify(body)).not.toMatch(/Asha|2026-10-10|ptm/i);
        expect(r.call.provider).toBe('vobiz');
        expect(r.call.state).toBe('initiated');
        expect(r.call.providerConversationId).toBe('vobiz:11111111-2222-3333-4444-555555555555');
    });

    it('a Vobiz refusal is a failed call (released), a network error is unknown (never redialled)', async () => {
        const refused = await setup({ fetchImpl: jest.fn(async () => new Response('bad', { status: 400 })) });
        expect((await start(refused.deps)).call.state).toBe('failed');
        const lost = await setup({ fetchImpl: jest.fn(async () => { throw new Error('reset'); }) });
        expect((await start(lost.deps)).call.state).toBe('unknown');
    });

    it('the daily test cap is ONE allowance across both providers', async () => {
        const env = vobizEnv({ SAMPARK_RIYA_TEST_DAILY_CAP: '1' });
        const { deps } = await setup({ env });
        const first = await start(deps);
        // settle the first so it does not block as "in progress"
        await handleVobizRiyaEvent(deps, eventBody(vobizRiyaRef(ORG, first.call.id)), signBridgeBody(KEY, eventBody(vobizRiyaRef(ORG, first.call.id)), Math.floor(WED_11_IST.getTime() / 1000)));
        await deps.repo.releaseLock(`riya:${ORG}`, first.call.id);
        let code = '';
        try { await start(deps); } catch (e) { code = (e as SamparkServiceError).code; }
        expect(code).toBe('TEST_CALL_CAP_REACHED');
    });
});

describe('the four public legs', () => {
    it('answer streams to the bridge for that call only; bad token or settled call hangs up', async () => {
        const { deps } = await setup();
        const { call } = await start(deps);
        const ref = vobizRiyaRef(ORG, call.id);
        const tok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_ANSWER, ref)).token;
        const ok = await handleVobizRiyaAnswer(deps, tok, 'uuid-1');
        expect(ok.xml).toContain('<Stream');
        expect(ok.xml).toContain('wss://bridge.example.test/telephony/vobiz/stream?t=sampark%7E'); // URL-encoded ~ (the bridge decodes it)
        expect(ok.xml).toContain('agent=riya');
        expect(ok.xml).not.toContain('Asha');
        // a STATUS token is not an ANSWER token
        const wrong = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS, ref)).token;
        expect((await handleVobizRiyaAnswer(deps, wrong, 'uuid-1')).xml).toContain('<Hangup/>');
        expect((await handleVobizRiyaAnswer(deps, 'garbage', null)).xml).toContain('<Hangup/>');
    });

    it('context gives the bridge the variables only with a context token', async () => {
        const { deps } = await setup();
        const { call } = await start(deps);
        const ref = vobizRiyaRef(ORG, call.id);
        const good = await handleVobizRiyaContext(deps, (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_CONTEXT, ref)).token);
        expect(good.status).toBe(200);
        expect((good.body as { riyaVariables: Record<string, string> }).riyaVariables.student_name).toBe('Asha');
        expect((good.body as { productContext: string }).productContext).toBe('sampark');
        const bad = await handleVobizRiyaContext(deps, (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_ANSWER, ref)).token);
        expect(bad.status).toBe(404);
    });

    it('a hangup that never connected settles busy / no answer through the reducer', async () => {
        const { deps, calls } = await setup();
        const { call } = await start(deps);
        const tok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS, vobizRiyaRef(ORG, call.id))).token;
        await handleVobizRiyaStatus(deps, tok, 'hangup', { CallUUID: '11111111-2222-3333-4444-555555555555', HangupCause: 'USER_BUSY' });
        expect((await calls.getCall(ORG, call.id))?.state).toBe('busy');
    });

    it('an answered hangup waits for the bridge report instead of inventing an outcome', async () => {
        const { deps, calls } = await setup();
        const { call } = await start(deps);
        const tok = (await mintVobizToken(VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS, vobizRiyaRef(ORG, call.id))).token;
        await handleVobizRiyaStatus(deps, tok, 'hangup', { CallUUID: 'x', HangupCause: 'NORMAL_CLEARING', AnswerTime: '2026-10-07 11:00:05', BillDuration: '61' });
        const after = await calls.getCall(ORG, call.id);
        expect(after?.state).toBe('initiated');
        expect(after?.providerStatus).toBe('carrier_ended');
    });

    it('the bridge event completes the call with the same fields as ElevenLabs; duplicates are harmless', async () => {
        const { deps, calls } = await setup();
        const { call } = await start(deps);
        const body = eventBody(vobizRiyaRef(ORG, call.id));
        const sig = signBridgeBody(KEY, body, Math.floor(WED_11_IST.getTime() / 1000));
        expect((await handleVobizRiyaEvent(deps, body, sig)).status).toBe(200);
        expect((await handleVobizRiyaEvent(deps, body, sig)).status).toBe(200);
        const done = await calls.getCall(ORG, call.id);
        expect(done?.state).toBe('completed');
        expect(done?.durationSeconds).toBe(61);
        expect(done?.dataCollection).toMatchObject({ ptm_attendance: 'cannot_attend', ptm_preferred_time: 'Saturday morning', recipient_confirmed: 'yes' });
        expect(done?.appliedEvents.filter((e) => e.startsWith('vobiz-post-call:'))).toHaveLength(1);
    });

    it('a callback request becomes a PROPOSED callback; a stop request blocks it', async () => {
        const a = await setup();
        const c1 = (await start(a.deps)).call;
        const b1 = eventBody(vobizRiyaRef(ORG, c1.id), { dataCollection: { good_time_to_talk: 'no', callback_requested_time: 'tomorrow at 6 PM' } });
        await handleVobizRiyaEvent(a.deps, b1, signBridgeBody(KEY, b1, Math.floor(WED_11_IST.getTime() / 1000)));
        const proposed = await a.callbacks.listProposed(ORG, 10);
        expect(proposed.map((c) => c.status)).toEqual(['proposed']);

        const b = await setup();
        const c2 = (await start(b.deps)).call;
        const b2 = eventBody(vobizRiyaRef(ORG, c2.id), { dataCollection: { stop_requested: 'yes', callback_requested_time: 'tomorrow' } });
        await handleVobizRiyaEvent(b.deps, b2, signBridgeBody(KEY, b2, Math.floor(WED_11_IST.getTime() / 1000)));
        expect((await b.calls.getCall(ORG, c2.id))?.stopRequested).toBeTruthy();
        expect(await b.callbacks.listProposed(ORG, 10)).toHaveLength(0);
    });

    it('refuses unsigned, re-signed or stale events; ignores events for ElevenLabs calls', async () => {
        const { deps, calls } = await setup();
        const { call } = await start(deps);
        const body = eventBody(vobizRiyaRef(ORG, call.id));
        const now = Math.floor(WED_11_IST.getTime() / 1000);
        expect((await handleVobizRiyaEvent(deps, body, null)).status).toBe(401);
        expect((await handleVobizRiyaEvent(deps, body, signBridgeBody('other-key', body, now))).status).toBe(401);
        expect((await handleVobizRiyaEvent(deps, body, signBridgeBody(KEY, body, now - 3600))).status).toBe(401);
        expect((await handleVobizRiyaEvent(deps, body.replace('61', '62'), signBridgeBody(KEY, body, now))).status).toBe(401);
        expect((await calls.getCall(ORG, call.id))?.state).toBe('initiated');
    });
});

describe('wire formats shared with the Python bridge', () => {
    it('verifies a signature produced by sahayakai_agents.telephony.sampark_link.sign_body', () => {
        // Computed by the bridge for key "k3y", t=1700000000, body {"a":1} (see test_telephony_riya.py).
        const header = signBridgeBody('k3y', '{"a":1}', 1700000000);
        const expected = crypto.createHmac('sha256', 'k3y').update('1700000000.{"a":1}').digest('base64url');
        expect(header).toBe(`t=1700000000,v1=${expected}`);
        expect(verifyBridgeSignature('k3y', '{"a":1}', header, 1700000000)).toEqual({ ok: true });
    });

    it('refs and ring failures', () => {
        const ref = vobizRiyaRef('org_1', 'a'.repeat(32));
        expect(parseVobizRiyaRef(ref)).toEqual({ orgId: 'org_1', callId: 'a'.repeat(32) });
        expect(parseVobizRiyaRef('sampark~a.b~' + 'a'.repeat(32))).toBeNull();
        expect(vobizRingFailure('USER_BUSY')).toBe('busy');
        expect(vobizRingFailure('NO_ANSWER')).toBe('no-answer');
        expect(vobizRingFailure('WEIRD')).toBe('unknown');
    });
});
