/**
 * @jest-environment node
 *
 * Ring and hangup callbacks. The hangup is the one that matters: it ends the
 * call and settles it (intent done / retry_wait, opt-out → suppression,
 * campaign counts). Vobiz retries non-200 callbacks and can deliver a hangup
 * twice, so settling must happen exactly once however often it arrives.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { mintSamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { handleSamparkAnswer, handleSamparkStatus } from '@/server/sampark/voice';

import { CALL_ID, CAMPAIGN_ID, INTENT_ID, ORG, VOBIZ_CALL_UUID, WED_11_IST, setVoiceEnv, world, type World } from './_fixtures';

beforeEach(() => setVoiceEnv());

async function status(w: World, kind: string | null, fields: Record<string, string> = {}) {
    const token = await mintSamparkVoiceToken('sampark-status', voicePrincipal(ORG, CALL_ID));
    return handleSamparkStatus(w, { token, kind, fields });
}

async function answer(w: World) {
    const token = await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID));
    expect((await handleSamparkAnswer(w, { token, callUuid: VOBIZ_CALL_UUID })).outcome).toBe('played');
}

describe('ring', () => {
    it('moves a dialing call to ringing and keeps the Vobiz leg id', async () => {
        const w = await world();
        expect(await status(w, 'ring', { CallUUID: VOBIZ_CALL_UUID })).toEqual({ ok: true, outcome: 'ringing' });
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'ringing', vobizCallUuid: VOBIZ_CALL_UUID });
    });

    it('a ring that arrives after the answer never moves the call backwards', async () => {
        const w = await world();
        await answer(w);
        await status(w, 'ring');
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('in_progress');
    });
});

describe('hangup → settle', () => {
    it('answered and heard in full: completed, intent done, campaign counts current', async () => {
        const w = await world();
        await answer(w);
        // audioSeconds is 20 on the fixture call; 35 s of listening is a full listen.
        expect(await status(w, 'hangup', { CallUUID: VOBIZ_CALL_UUID, HangupCause: 'NORMAL_CLEARING', Duration: '35', BillDuration: '60' })).toEqual({ ok: true, outcome: 'settled' });

        const call = await w.repo.getCall(ORG, CALL_ID);
        expect(call).toMatchObject({ state: 'completed', durationSeconds: 35, billedSeconds: 60, outcome: expect.objectContaining({ heard: 'full' }) });
        expect(call?.settledAt).toBe(WED_11_IST.toISOString());
        expect((await w.repo.getIntent(ORG, INTENT_ID))?.status).toBe('done');
        expect((await w.repo.getCampaign(ORG, CAMPAIGN_ID))?.counts).toMatchObject({ heardKeyFact: 1, inFlight: 0 });
    });

    it('no answer: the intent waits for its retry (plan §4⑦), not done', async () => {
        const w = await world();
        await status(w, 'ring');
        await status(w, 'hangup', { Status: 'no-answer', Duration: '0' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('no_answer');
        const intent = await w.repo.getIntent(ORG, INTENT_ID);
        expect(intent?.status).toBe('retry_wait');
        expect(intent?.notBefore).toBe(new Date(WED_11_IST.getTime() + 120 * 60_000).toISOString());
    });

    it('busy: retry_wait too, and nothing billed', async () => {
        const w = await world();
        await status(w, 'hangup', { HangupCause: 'USER_BUSY' });
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'busy', billedSeconds: 0 });
        expect((await w.repo.getIntent(ORG, INTENT_ID))?.status).toBe('retry_wait');
    });

    it('a duplicated or retried hangup settles exactly once', async () => {
        const w = await world();
        await answer(w);
        const fields = { HangupCause: 'NORMAL_CLEARING', Duration: '8', BillDuration: '60' };
        expect((await status(w, 'hangup', fields)).outcome).toBe('settled');
        const callOnce = await w.repo.getCall(ORG, CALL_ID);
        const intentOnce = await w.repo.getIntent(ORG, INTENT_ID);
        expect(intentOnce?.status).toBe('retry_wait');

        w.clock.set(new Date(WED_11_IST.getTime() + 60_000));
        for (let i = 0; i < 3; i++) expect((await status(w, 'hangup', { ...fields, Duration: '99' })).outcome).toBe('recorded');
        expect(await w.repo.getCall(ORG, CALL_ID)).toEqual(callOnce);
        expect(await w.repo.getIntent(ORG, INTENT_ID)).toEqual(intentOnce);
    });

    it('a hangup for a call failed at answer (no verified audio) fills in what the carrier billed, once', async () => {
        const w = await world({ clips: (k) => (k === 'message' ? 'failed' : 'passed') });
        const token = await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID));
        expect((await handleSamparkAnswer(w, { token, callUuid: null })).outcome).toBe('audio_unavailable');
        expect((await w.repo.getCall(ORG, CALL_ID))?.billedSeconds).toBeNull();

        await status(w, 'hangup', { CallUUID: VOBIZ_CALL_UUID, HangupCause: 'NORMAL_CLEARING', Duration: '2', BillDuration: '60' });
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'failed', failureReason: 'audio_unavailable', billedSeconds: 60, vobizCallUuid: VOBIZ_CALL_UUID });
        await status(w, 'hangup', { HangupCause: 'NORMAL_CLEARING', Duration: '2', BillDuration: '120' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.billedSeconds).toBe(60);
    });

    it('stores the Vobiz leg id from the hangup when nothing earlier reported it', async () => {
        const w = await world();
        await status(w, 'hangup', { CallUUID: 'leg-from-hangup', Status: 'busy' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.vobizCallUuid).toBe('leg-from-hangup');
    });
});

describe('always ok, never a change it should not make', () => {
    it('an unknown kind changes nothing', async () => {
        const w = await world();
        const before = await w.repo.getCall(ORG, CALL_ID);
        expect(await status(w, 'answer', { HangupCause: 'NORMAL_CLEARING' })).toEqual({ ok: true, outcome: 'unknown_kind' });
        expect(await status(w, null)).toEqual({ ok: true, outcome: 'unknown_kind' });
        expect(await w.repo.getCall(ORG, CALL_ID)).toEqual(before);
    });

    it('a bad or expired token changes nothing', async () => {
        const w = await world();
        const expired = await mintSamparkVoiceToken('sampark-status', voicePrincipal(ORG, CALL_ID), -1);
        expect(await handleSamparkStatus(w, { token: expired, kind: 'hangup', fields: { HangupCause: 'NORMAL_CLEARING' } })).toEqual({ ok: true, outcome: 'bad_token' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('dialing');
    });

    it('a call that does not exist is reported, not created', async () => {
        const w = await world();
        const token = await mintSamparkVoiceToken('sampark-status', voicePrincipal(ORG, 'no-such-call'));
        expect(await handleSamparkStatus(w, { token, kind: 'hangup', fields: {} })).toEqual({ ok: true, outcome: 'call_missing' });
        expect(await w.repo.getCall(ORG, 'no-such-call')).toBeNull();
    });

    it('records the hangup even with the live-dial kill switch off (it stops playback, not bookkeeping)', async () => {
        const w = await world();
        setVoiceEnv({ SAMPARK_LIVE_DIAL_ENABLED: undefined });
        expect((await status(w, 'hangup', { Status: 'busy' })).outcome).toBe('settled');
    });

    it('with Sampark off, nothing is recorded', async () => {
        const w = await world();
        setVoiceEnv({ SAMPARK_ENABLED: undefined });
        expect((await status(w, 'hangup', { Status: 'busy' })).outcome).toBe('disabled');
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('dialing');
    });
});
