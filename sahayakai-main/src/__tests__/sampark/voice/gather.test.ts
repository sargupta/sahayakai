/**
 * @jest-environment node
 *
 * The keypad webhook, driven the way Vobiz drives it: answer → take the gather
 * URL out of the XML we returned → post a key to it → follow the next URL.
 *
 * CLASS GATE (b): a gather URL works once. Replaying it — with Digits=9 or
 * anything else — records no key, writes no suppression, and hangs up.
 * CLASS GATE (e), keypad half: a reply clip that is missing or unverified
 * never reaches a <Play>; the key is still recorded.
 * And: a 9 is never lost — a 9 that lands after the hangup still opts the
 * family out (or, on a test-phone call, is audited and suppresses nobody).
 * And (H11, interim): a key the menu does not offer replays the message and its
 * menu once; the second such key gets the no-input goodbye.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { mintSamparkVoiceToken, verifySamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import type { CallDestination, ClipKind } from '@/types/sampark';
import { handleSamparkAnswer, handleSamparkGather, handleSamparkStatus, parseDigit } from '@/server/sampark/voice';

import { CALL_ID, INTENT_ID, ORG, VOBIZ_CALL_UUID, gatherAction, playUrls, setVoiceEnv, tokenOf, world, type ClipFate, type World } from './_fixtures';

beforeEach(() => setVoiceEnv());

/** Answer the call and return the menu-step gather token. */
async function answered(w: World): Promise<string> {
    const result = await handleSamparkAnswer(w, { token: await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID)), callUuid: VOBIZ_CALL_UUID });
    expect(result.outcome).toBe('played');
    return tokenOf(gatherAction(result.xml) as string);
}

async function press(w: World, token: string, digits: string | null) {
    return handleSamparkGather(w, { token, digits, callUuid: VOBIZ_CALL_UUID });
}

async function hangupNow(w: World, fields: Record<string, string> = { HangupCause: 'NORMAL_CLEARING', Duration: '35', BillDuration: '60' }) {
    const token = await mintSamparkVoiceToken('sampark-status', voicePrincipal(ORG, CALL_ID));
    return handleSamparkStatus(w, { token, kind: 'hangup', fields });
}

/** The clips a replayed answer document plays (message inside the gather, then no-input), as clip keys. */
async function replayedClips(xml: string): Promise<string[]> {
    const urls = playUrls(xml);
    return Promise.all(urls.map(async (u) => ((await verifySamparkVoiceToken('sampark-audio', tokenOf(u))) ?? '').split('~')[1]));
}

/** The single clip a play-then-hangup document plays, as a clip key. */
async function playedClip(xml: string): Promise<string> {
    const urls = playUrls(xml);
    expect(urls).toHaveLength(1);
    expect(xml).toMatch(/<\/Play><Wait length="1"\/><Hangup\/><\/Response>$/);
    const principal = await verifySamparkVoiceToken('sampark-audio', tokenOf(urls[0]));
    return (principal ?? '').split('~')[1];
}

describe('menu step', () => {
    it('1 → the confirm_1 clip, then hang up; the call records the confirmation', async () => {
        const w = await world();
        const result = await press(w, await answered(w), '1');
        expect(result.outcome).toBe('played');
        expect(await playedClip(result.xml)).toBe(w.keys.confirm_1);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '1', confirmed: true, declined: false, optOut: 'none' });
    });

    it('2 → the confirm_2 clip on a purpose whose menu offers key 2', async () => {
        const w = await world();
        const result = await press(w, await answered(w), '2');
        expect(await playedClip(result.xml)).toBe(w.keys.confirm_2);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '2', declined: true });
    });

    it('2 on a purpose with no key 2 (emergency closure) is an unknown key: the message is replayed, never read as "declined"', async () => {
        const w = await world({
            campaign: { purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false }, audience: { sections: [] } },
            call: { purpose: 'emergency_closure', variant: 'today' },
        });
        const result = await press(w, await answered(w), '2');
        expect(result.outcome).toBe('menu_repeated');
        expect(await replayedClips(result.xml)).toEqual([w.keys.message, w.keys.no_input]);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '2', declined: false });
        // A second 2 is the second unknown key: goodbye.
        expect(await playedClip((await press(w, tokenOf(gatherAction(result.xml) as string), '2')).xml)).toBe(w.keys.no_input);
    });

    it.each([['5'], ['*'], ['#'], ['0']])('%j (a key the menu does not offer) → the message and its menu once more', async (digits) => {
        const w = await world();
        const result = await press(w, await answered(w), digits);
        expect(result.outcome).toBe('menu_repeated');
        expect(await replayedClips(result.xml)).toEqual([w.keys.message, w.keys.no_input]);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome.digits).toBe(digits);
    });

    it.each([[''], [null], ['x']])('%j (no key at all) → the no-input clip, then hang up', async (digits) => {
        const w = await world();
        const result = await press(w, await answered(w), digits);
        expect(await playedClip(result.xml)).toBe(w.keys.no_input);
    });

    it('only the first character of Digits counts', () => {
        expect(parseDigit('19')).toBe('1');
        expect(parseDigit(' 9')).toBe('9');
        expect(parseDigit('a1')).toBeNull();
        expect(parseDigit(undefined)).toBeNull();
    });
});

describe('H11 (interim) — one replay on an unknown key, then the goodbye', () => {
    it('unknown key → replay with a FRESH menu token; a second unknown key → no-input goodbye', async () => {
        const w = await world();
        const firstToken = await answered(w);
        const replay = await press(w, firstToken, '5');
        expect(replay.outcome).toBe('menu_repeated');
        expect(replay.xml).toMatch(/<Gather [^>]*executionTimeout="8"[^>]*><Play>[^<]+<\/Play><\/Gather><Play>[^<]+<\/Play><Wait length="1"\/><Hangup\/><\/Response>$/);
        const replayToken = tokenOf(gatherAction(replay.xml) as string);
        expect(replayToken).not.toBe(firstToken);
        expect(await verifySamparkVoiceToken('sampark-gather-menu', replayToken)).toBe(voicePrincipal(ORG, CALL_ID));
        // The burned token stays burned.
        expect(await press(w, firstToken, '1')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'replayed' });

        const goodbye = await press(w, replayToken, '7');
        expect(goodbye.outcome).toBe('played');
        expect(await playedClip(goodbye.xml)).toBe(w.keys.no_input);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '57', confirmed: false, declined: false, optOut: 'none' });
    });

    it('after the replay, a real key works as usual: 1 confirms, 9 starts the opt-out', async () => {
        const w = await world();
        const replay = await press(w, await answered(w), '#');
        const confirmed = await press(w, tokenOf(gatherAction(replay.xml) as string), '1');
        expect(await playedClip(confirmed.xml)).toBe(w.keys.confirm_1);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '#1', confirmed: true });

        const v = await world();
        const again = await press(v, await answered(v), '0');
        const optOut = await press(v, tokenOf(gatherAction(again.xml) as string), '9');
        expect(playUrls(optOut.xml)).toHaveLength(2);
        expect(await verifySamparkVoiceToken('sampark-gather-optout', tokenOf(gatherAction(optOut.xml) as string))).toBe(voicePrincipal(ORG, CALL_ID));
        expect((await v.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '09', optOut: 'requested' });
    });

    it('the replay never plays unverified audio: a failed message clip hangs up (the key is still recorded)', async () => {
        const w = await world({ clips: (k) => (k === 'message' ? 'failed' : 'passed') });
        const token = await mintSamparkVoiceToken('sampark-gather-menu', voicePrincipal(ORG, CALL_ID));
        expect(await press(w, token, '5')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome.digits).toBe('5');
    });
});

describe('opt-out: 9 → confirm → 9 → done', () => {
    async function optOutTwice(destination: CallDestination) {
        const w = await world({ call: destination === 'guardian' ? { destination, phoneHash: 'hash:guardian', phoneLast4: '1111' } : { destination } });
        const first = await press(w, await answered(w), '9');
        expect(first.outcome).toBe('played');
        // The confirmation prompt inside a fresh OPT-OUT-step gather, then opt_out_done if nothing is pressed.
        const [prompt, done] = playUrls(first.xml);
        expect((await verifySamparkVoiceToken('sampark-audio', tokenOf(prompt)))?.split('~')[1]).toBe(w.keys.opt_out_confirm);
        expect((await verifySamparkVoiceToken('sampark-audio', tokenOf(done)))?.split('~')[1]).toBe(w.keys.opt_out_done);
        const optOutToken = tokenOf(gatherAction(first.xml) as string);
        expect(await verifySamparkVoiceToken('sampark-gather-optout', optOutToken)).toBe(voicePrincipal(ORG, CALL_ID));
        expect(await verifySamparkVoiceToken('sampark-gather-menu', optOutToken)).toBeNull();

        const second = await press(w, optOutToken, '9');
        expect(await playedClip(second.xml)).toBe(w.keys.opt_out_done);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '99', optOut: 'confirmed' });

        expect((await hangupNow(w)).outcome).toBe('settled');
        return w;
    }

    it('guardian destination: the hangup settles a CONFIRMED keypad suppression for the parent’s number', async () => {
        const w = await optOutTwice('guardian');
        expect(await w.repo.getSuppression(ORG, 'hash:guardian')).toMatchObject({ scope: 'routine', source: 'keypad', officeVerification: 'pending', callId: CALL_ID });
    });

    it('test-phone destination: the 9s are audited, nobody is suppressed', async () => {
        const w = await optOutTwice('test_phone');
        expect(await w.repo.listSuppressions(ORG)).toEqual([]);
        expect(w.audits).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'test_call.opt_out_pressed', detail: { optOut: 'confirmed' } })]));
    });

    it('a 9 that is never confirmed still stands (plan §5.1): requested, unconfirmed suppression', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        await press(w, await answered(w), '9');
        await hangupNow(w);
        expect(await w.repo.getSuppression(ORG, 'hash:guardian')).toMatchObject({ source: 'keypad_unconfirmed', scope: 'routine' });
    });

    it('a different key at the confirmation prompt is not read as "yes, I will attend"; the parent is told the opt-out stands', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const first = await press(w, await answered(w), '9');
        const second = await press(w, tokenOf(gatherAction(first.xml) as string), '1');
        expect(await playedClip(second.xml)).toBe(w.keys.opt_out_done);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '9', confirmed: false, optOut: 'requested' });
    });
});

describe('class gate (b) — a gather URL works exactly once', () => {
    it('replaying the menu URL with Digits=9 records no second key and hangs up', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const token = await answered(w);
        expect((await press(w, token, '9')).outcome).toBe('played');
        for (let i = 0; i < 3; i++) {
            expect(await press(w, token, '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'replayed' });
        }
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '9', optOut: 'requested' });
    });

    it('a URL first used for a 1, replayed with Digits=9, creates no suppression at all', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const token = await answered(w);
        await press(w, token, '1');
        expect(await press(w, token, '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'replayed' });
        await hangupNow(w);
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '1', optOut: 'none' });
        expect(await w.repo.listSuppressions(ORG)).toEqual([]);
    });

    it('replaying the opt-out URL does not record a third 9', async () => {
        const w = await world();
        const first = await press(w, await answered(w), '9');
        const optOutToken = tokenOf(gatherAction(first.xml) as string);
        await press(w, optOutToken, '9');
        expect(await press(w, optOutToken, '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'replayed' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome.digits).toBe('99');
    });

    it('a replay after the call ended is refused before the late-digit path can act', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const token = await answered(w);
        await press(w, token, '1');
        await hangupNow(w);
        expect(await press(w, token, '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'replayed' });
        expect(await w.repo.listSuppressions(ORG)).toEqual([]);
    });
});

describe('a 9 is never lost — keys that arrive after the hangup', () => {
    it('a late menu-step 9 on a guardian call still writes an (unconfirmed) suppression, and is audited', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian', phoneLast4: '1111' } });
        const token = await answered(w);
        expect((await hangupNow(w)).outcome).toBe('settled');
        const callAfterHangup = await w.repo.getCall(ORG, CALL_ID);

        expect(await press(w, token, '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'call_terminal' });
        expect(await w.repo.getSuppression(ORG, 'hash:guardian')).toMatchObject({ source: 'keypad_unconfirmed', scope: 'routine', callId: CALL_ID, phoneLast4: '1111' });
        expect(w.audits.map((a) => a.action)).toEqual(expect.arrayContaining(['call.late_digit', 'suppression.add']));
        // The terminal call itself is never rewritten.
        expect(await w.repo.getCall(ORG, CALL_ID)).toEqual(callAfterHangup);
    });

    it('a late SECOND 9 upgrades the unconfirmed opt-out to a confirmed one', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const first = await press(w, await answered(w), '9');
        await hangupNow(w);
        expect(await w.repo.getSuppression(ORG, 'hash:guardian')).toMatchObject({ source: 'keypad_unconfirmed' });
        await press(w, tokenOf(gatherAction(first.xml) as string), '9');
        expect(await w.repo.getSuppression(ORG, 'hash:guardian')).toMatchObject({ source: 'keypad' });
    });

    it('a late 9 on a test-phone call is audited and suppresses nobody', async () => {
        const w = await world();
        const token = await answered(w);
        await hangupNow(w);
        await press(w, token, '9');
        expect(await w.repo.listSuppressions(ORG)).toEqual([]);
        expect(w.audits.map((a) => a.action)).toEqual(expect.arrayContaining(['call.late_digit', 'test_call.opt_out_pressed']));
    });

    it('a late 1 is audited only', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const token = await answered(w);
        await hangupNow(w);
        await press(w, token, '1');
        expect(await w.repo.listSuppressions(ORG)).toEqual([]);
        expect(w.audits.filter((a) => a.action === 'call.late_digit')).toHaveLength(1);
    });
});

describe('class gate (e) — unverified or missing reply audio never reaches <Play> (keypad)', () => {
    const cases: [string, string, ClipKind, ClipFate][] = [
        ['confirm_1 failed its check', '1', 'confirm_1', 'failed'],
        ['confirm_2 was never checked', '2', 'confirm_2', 'skipped'],
        ['no_input is missing', '5', 'no_input', 'missing'],
        ['opt_out_confirm failed its check', '9', 'opt_out_confirm', 'failed'],
        ['opt_out_done is missing', '9', 'opt_out_done', 'missing'],
    ];

    it.each(cases)('%s → hang up with no <Play>, but the key is recorded', async (_label, digit, kind, fate) => {
        const w = await world({ clips: (k) => (k === kind ? fate : 'passed') });
        // Minted directly: with no_input unavailable the answer itself would (rightly) have refused.
        const token = await mintSamparkVoiceToken('sampark-gather-menu', voicePrincipal(ORG, CALL_ID));
        const result = await press(w, token, digit);
        expect(result).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome.digits).toBe(digit);
    });

    it('opt_out_done unavailable at the second 9 → hang up; the confirmed opt-out is still recorded', async () => {
        const w = await world({ call: { destination: 'guardian', phoneHash: 'hash:guardian' } });
        const first = await press(w, await answered(w), '9');
        expect(first.outcome).toBe('played');
        // The clip goes bad between the two keys.
        const clip = await w.repo.getClip(ORG, w.keys.opt_out_done as string);
        await w.repo.saveClip({ ...(clip as NonNullable<typeof clip>), verification: { ...(clip as NonNullable<typeof clip>).verification, status: 'failed' } });
        expect(await press(w, tokenOf(gatherAction(first.xml) as string), '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
        await hangupNow(w);
        expect(await w.repo.getSuppression(ORG, 'hash:guardian')).toMatchObject({ source: 'keypad' });
    });
});

describe('kill switch and lifecycle', () => {
    it('with the live-dial switch off mid-call, the key is recorded and nothing more is played', async () => {
        const w = await world();
        const token = await answered(w);
        setVoiceEnv({ SAMPARK_LIVE_DIAL_ENABLED: 'false' });
        expect(await press(w, token, '1')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'live_dial_disabled' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome).toMatchObject({ digits: '1', confirmed: true });
    });

    it('with Sampark off, nothing is recorded', async () => {
        const w = await world();
        const token = await answered(w);
        setVoiceEnv({ SAMPARK_ENABLED: undefined });
        expect(await press(w, token, '9')).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'disabled' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.outcome.digits).toBe('');
    });

    it('a key before the answer webhook (lost answer) still moves the call to in_progress', async () => {
        const w = await world();
        const token = await mintSamparkVoiceToken('sampark-gather-menu', voicePrincipal(ORG, CALL_ID));
        await press(w, token, '1');
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'in_progress', vobizCallUuid: VOBIZ_CALL_UUID });
    });

    it('1 then hangup: the intent is done (the parent reached the school)', async () => {
        const w = await world();
        await press(w, await answered(w), '1');
        await hangupNow(w);
        expect((await w.repo.getIntent(ORG, INTENT_ID))?.status).toBe('done');
    });
});
