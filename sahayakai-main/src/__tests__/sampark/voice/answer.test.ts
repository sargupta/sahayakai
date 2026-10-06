/**
 * @jest-environment node
 *
 * The answer webhook — the last moment a call can still say nothing.
 *
 * CLASS GATE (a): the answer service refuses, with a clean hangup and no
 * message, whenever ANY of the conditions that make a call speakable fails at
 * the moment of answer — not only at dial time. Each condition is driven on
 * its own against an otherwise-perfect call, so a refactor that drops one
 * check fails exactly one row here. Calling hours are clock-driven (23:00 IST).
 *
 * CLASS GATE (e), answer half: a clip that is missing, failed its
 * transcribe-back check, or was never checked, never reaches a <Play>; the
 * call is failed with `audio_unavailable` and settled without a retry.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { mintSamparkVoiceToken, verifySamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import type { ClipKind } from '@/types/sampark';
import { handleSamparkAnswer, type VoiceOutcome } from '@/server/sampark/voice';

import { BASE_URL, CALL_ID, INTENT_ID, ORG, VOBIZ_CALL_UUID, WED_23_IST, gatherAction, playUrls, setVoiceEnv, tokenOf, world, type ClipFate } from './_fixtures';

async function answerToken(): Promise<string> {
    return mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID));
}

beforeEach(() => setVoiceEnv());

describe('answer — happy path', () => {
    it('marks the call answered, keeps the Vobiz leg id, and returns the message inside a one-key gather', async () => {
        const w = await world();
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: VOBIZ_CALL_UUID });
        expect(result.outcome).toBe('played');

        const call = await w.repo.getCall(ORG, CALL_ID);
        expect(call?.state).toBe('in_progress');
        expect(call?.vobizCallUuid).toBe(VOBIZ_CALL_UUID);

        const [message, noInput] = playUrls(result.xml);
        expect(playUrls(result.xml)).toHaveLength(2);
        expect(result.xml).toMatch(/<Gather [^>]*executionTimeout="8"[^>]*><Play>[^<]+<\/Play><\/Gather><Play>[^<]+<\/Play><Hangup\/><\/Response>$/);
        // The audio tokens name exactly the verified message and no-input clips.
        expect(await verifySamparkVoiceToken('sampark-audio', tokenOf(message))).toBe(voicePrincipal(ORG, w.keys.message as string));
        expect(await verifySamparkVoiceToken('sampark-audio', tokenOf(noInput))).toBe(voicePrincipal(ORG, w.keys.no_input as string));
        // The gather URL carries a fresh MENU-step token for this call.
        const action = gatherAction(result.xml) as string;
        expect(await verifySamparkVoiceToken('sampark-gather-menu', tokenOf(action))).toBe(voicePrincipal(ORG, CALL_ID));
        expect(await verifySamparkVoiceToken('sampark-gather-optout', tokenOf(action))).toBeNull();
    });

    it('builds every URL from SAMPARK_PUBLIC_BASE_URL, with the .wav path before the query', async () => {
        const w = await world();
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null });
        for (const url of playUrls(result.xml)) expect(url.startsWith(`${BASE_URL}/api/webhooks/sampark-voice/audio.wav?t=`)).toBe(true);
        expect(gatherAction(result.xml)?.startsWith(`${BASE_URL}/api/webhooks/sampark-voice/gather?t=`)).toBe(true);
    });

    it('an emergency closure may speak at 07:00 IST, the one sanctioned early window', async () => {
        const w = await world({
            clock: '2026-10-07T01:30:00Z', // 07:00 IST
            campaign: { purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false }, audience: { sections: [] } },
            call: { purpose: 'emergency_closure', variant: 'today' },
        });
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null });
        expect(result.outcome).toBe('played');
    });
});

describe('class gate (a) — the answer refuses unless every condition still holds', () => {
    type Row = [string, VoiceOutcome, (w: Awaited<ReturnType<typeof world>>) => Promise<void> | void];
    const rows: Row[] = [
        ['the calling window has closed (23:00 IST)', 'window_closed', (w) => w.clock.set(WED_23_IST)],
        ['it is a school off-day (Sunday)', 'window_closed', (w) => w.clock.set('2026-10-11T05:30:00Z')],
        ['the school went back to practice mode', 'not_test_mode', async (w) => w.repo.upsertSchool({ ...w.school, mode: 'practice' })],
        ['the school is in live mode', 'not_test_mode', async (w) => w.repo.upsertSchool({ ...w.school, mode: 'live' })],
        ['the live-dial kill switch is off', 'live_dial_disabled', () => setVoiceEnv({ SAMPARK_LIVE_DIAL_ENABLED: undefined })],
        ['the live-dial flag is anything but "true"', 'live_dial_disabled', () => setVoiceEnv({ SAMPARK_LIVE_DIAL_ENABLED: 'TRUE' })],
        ['Sampark itself is off', 'disabled', () => setVoiceEnv({ SAMPARK_ENABLED: 'false' })],
        ['there is no https public base URL', 'base_url_missing', () => setVoiceEnv({ SAMPARK_PUBLIC_BASE_URL: 'http://insecure.example.test' })],
        ['the campaign was cancelled', 'campaign_closed', async (w) => w.repo.updateCampaign(ORG, w.campaign.id, { status: 'cancelled' })],
        ['the campaign has completed', 'campaign_closed', async (w) => w.repo.updateCampaign(ORG, w.campaign.id, { status: 'completed' })],
        ['the campaign has expired', 'campaign_closed', async (w) => w.repo.updateCampaign(ORG, w.campaign.id, { expiresAt: '2026-10-07T05:00:00.000Z' })],
        ['the call already ended', 'call_terminal', async (w) => w.repo.updateCall(ORG, CALL_ID, { state: 'no_answer' })],
    ];

    it.each(rows)('refuses when %s', async (_label, outcome, breakIt) => {
        const w = await world();
        await breakIt(w);
        const before = await w.repo.getCall(ORG, CALL_ID);
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: VOBIZ_CALL_UUID });
        expect(result).toEqual({ xml: EMPTY_HANGUP_XML, outcome });
        // Nothing was played and the call was not marked answered.
        expect(await w.repo.getCall(ORG, CALL_ID)).toEqual(before);
    });

    it('refuses a token for a school or call that does not exist', async () => {
        const w = await world();
        const noSchool = await mintSamparkVoiceToken('sampark-answer', voicePrincipal('no-such-school', CALL_ID));
        expect(await handleSamparkAnswer(w, { token: noSchool, callUuid: null })).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'school_missing' });
        const noCall = await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, 'no-such-call'));
        expect(await handleSamparkAnswer(w, { token: noCall, callUuid: null })).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'call_missing' });
    });

    it('records why it refused (except when Sampark is off entirely)', async () => {
        const w = await world();
        w.clock.set(WED_23_IST);
        await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null });
        expect(w.audits).toEqual([expect.objectContaining({ action: 'call.answer_refused', target: `call/${CALL_ID}`, detail: expect.objectContaining({ reason: 'window_closed' }) })]);
    });

    it('a guardian-destination call re-checks the suppression list at answer', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        await w.repo.upsertSuppression({
            orgId: ORG,
            phoneHash: 'hash:guardian',
            phoneLast4: '1111',
            scope: 'routine',
            source: 'keypad',
            officeVerification: 'pending',
            createdAt: '2026-10-07T05:00:00.000Z',
            callId: 'another-call',
        });
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null });
        expect(result).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'suppressed' });
    });

    it('a reversed suppression does not block, and a test-phone call never consults the list', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        await w.repo.upsertSuppression({
            orgId: ORG,
            phoneHash: 'hash:guardian',
            phoneLast4: '1111',
            scope: 'all',
            source: 'office',
            officeVerification: 'reversed',
            createdAt: '2026-10-07T05:00:00.000Z',
            callId: null,
        });
        expect((await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null })).outcome).toBe('played');

        const t = await world();
        await t.repo.upsertSuppression({
            orgId: ORG,
            phoneHash: 'hash:test-phone',
            phoneLast4: '4321',
            scope: 'all',
            source: 'office',
            officeVerification: 'confirmed',
            createdAt: '2026-10-07T05:00:00.000Z',
            callId: null,
        });
        expect((await handleSamparkAnswer(t, { token: await answerToken(), callUuid: null })).outcome).toBe('played');
    });

    it('an expired or missing token hangs up without touching anything', async () => {
        const w = await world();
        expect(await handleSamparkAnswer(w, { token: null, callUuid: null })).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'bad_token' });
        const expired = await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID), -10);
        expect(await handleSamparkAnswer(w, { token: expired, callUuid: null })).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'bad_token' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.state).toBe('dialing');
    });
});

describe('class gate (e) — unverified or missing audio never reaches <Play> (answer)', () => {
    const cases: [string, (kind: ClipKind) => ClipFate][] = [
        ['the message clip failed its check', (k) => (k === 'message' ? 'failed' : 'passed')],
        ['the message clip was never checked', (k) => (k === 'message' ? 'skipped' : 'passed')],
        ['the message clip is missing', (k) => (k === 'message' ? 'missing' : 'passed')],
        ['the no-input clip failed its check', (k) => (k === 'no_input' ? 'failed' : 'passed')],
        ['the no-input clip is missing', (k) => (k === 'no_input' ? 'missing' : 'passed')],
    ];

    it.each(cases)('%s → hang up, fail the call (audio_unavailable), settle without retry', async (_label, clips) => {
        const w = await world({ clips });
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: VOBIZ_CALL_UUID });
        expect(result).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
        expect(playUrls(result.xml)).toEqual([]);

        const call = await w.repo.getCall(ORG, CALL_ID);
        expect(call).toMatchObject({ state: 'failed', failureReason: 'audio_unavailable', vobizCallUuid: VOBIZ_CALL_UUID, billedSeconds: null });
        expect(call?.settledAt).toBeTruthy();
        // Not retried: the same clips would be missing again, and every attempt rings the phone.
        expect((await w.repo.getIntent(ORG, INTENT_ID))?.status).toBe('done');
        expect(w.audits.map((a) => a.action)).toContain('call.audio_unavailable');
    });

    it('a clip stored under ANOTHER school is not this school’s clip', async () => {
        const w = await world({ clips: (k) => (k === 'message' ? 'missing' : 'passed') });
        // Same content key, other org: must not satisfy the lookup.
        const other = await w.repo.getClip(ORG, w.keys.no_input as string);
        await w.repo.saveClip({ ...(other as NonNullable<typeof other>), key: w.keys.message as string, orgId: 'other-school', kind: 'message' });
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null });
        expect(result.outcome).toBe('audio_unavailable');
    });

    it('a school whose spoken name changed since rendering finds no clip (the text, and so the key, differ)', async () => {
        const w = await world();
        await w.repo.upsertSchool({ ...w.school, spokenName: { ...w.school.spokenName, English: 'Hillview School' } });
        const result = await handleSamparkAnswer(w, { token: await answerToken(), callUuid: null });
        expect(result.outcome).toBe('audio_unavailable');
    });
});
