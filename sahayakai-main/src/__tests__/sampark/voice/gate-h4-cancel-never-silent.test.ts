/**
 * @jest-environment node
 *
 * CLASS GATE H4 — a cancel is never silence (docs/sampark/EDGE_CASES.md §2 gap 4,
 * edge-cases/school-ops-data-safety.md CL04).
 *
 * The bug: cancelling a campaign left calls already dialling to finish, and the
 * answer webhook then returned an empty hang-up, so a parent who picked up heard
 * nothing, which feels like a scam call. The class: ANY call answered after its
 * campaign was cancelled, whatever the purpose, language, audio variant, the
 * state the call was in when the cancel landed, and whether the campaign froze
 * its clip keys, must hear the withdrawn line whenever a verified one exists.
 *
 * The matrix drives every such combination through the real cancel service
 * (whose carrier hang-up "fails", so the phone keeps ringing and is answered)
 * and the real answer webhook, then the hangup callback. It also proves the
 * other half of the fix: cancelling hangs up the phones still ringing, leaves a
 * call already speaking to finish, and reports both in the response and audit.
 * Negative control: a campaign rendered before the withdrawn line existed still
 * hangs up cleanly, exactly as before.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { callScripts } from '@/lib/sampark/scripts/templates';
import { mintSamparkVoiceToken, verifySamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import { PARENT_LANGUAGES, type Campaign, type CampaignFacts, type ParentLanguage, type PurposeId, type SamparkCall } from '@/types/sampark';
import { campaignClipKeys, cancelCampaign } from '@/server/sampark/campaigns';
import type { LegHangup } from '@/server/sampark/hangup';
import { handleSamparkAnswer, handleSamparkStatus } from '@/server/sampark/voice';

import { CALL_ID, ORG, VOBIZ_CALL_UUID, playUrls, setVoiceEnv, testCall, testIntent, tokenOf, world, type World } from './_fixtures';

beforeEach(() => setVoiceEnv());

const ADMIN = 'dev-user-123';

interface PurposeCase {
    purpose: PurposeId;
    facts: CampaignFacts;
    variant: SamparkCall['variant'];
    audience: Campaign['audience'];
}

const PURPOSES: PurposeCase[] = [
    { purpose: 'ptm_invite', facts: { kind: 'ptm_invite', date: '2026-10-10', time: { hour: 10, minute: 0 }, venueId: 'school_hall' }, variant: 'default', audience: { sections: [{ grade: 7, section: 'B' }] } },
    {
        purpose: 'event_invite',
        facts: { kind: 'event_invite', eventType: 'sports_day', date: '2026-10-10', time: { hour: 9, minute: 0 }, venueId: 'main_ground' },
        variant: 'default',
        audience: { sections: [] },
    },
    { purpose: 'emergency_closure', facts: { kind: 'emergency_closure', date: '2026-10-07', reason: 'heavy_rain', busesRunning: false }, variant: 'today', audience: { sections: [] } },
];

/** The carrier refused (or never got) the hang-up: the phone keeps ringing and the parent picks up. */
const hangupThatDoesNotLand: LegHangup = async () => false;

async function answer(w: World) {
    return handleSamparkAnswer(w, { token: await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID)), callUuid: VOBIZ_CALL_UUID });
}

async function hangupCallback(w: World) {
    const token = await mintSamparkVoiceToken('sampark-status', voicePrincipal(ORG, CALL_ID));
    return handleSamparkStatus(w, { token, kind: 'hangup', fields: { HangupCause: 'NORMAL_CLEARING', Duration: '9', BillDuration: '60' } });
}

type Row = [ParentLanguage, PurposeId, 'dialing' | 'ringing', 'frozen' | 'not frozen'];
const ROWS: Row[] = PARENT_LANGUAGES.flatMap((language) =>
    PURPOSES.flatMap((p) =>
        (['dialing', 'ringing'] as const).flatMap((state) => (['frozen', 'not frozen'] as const).map((keys): Row => [language, p.purpose, state, keys])),
    ),
);

describe('gate H4 — a call answered after its campaign was cancelled hears the withdrawn line, never silence', () => {
    it('the matrix covers every language × purpose × call state × key mode', () => {
        expect(ROWS).toHaveLength(4 * 3 * 2 * 2);
    });

    it.each(ROWS)('%s · %s · %s at cancel · keys %s', async (language, purpose, state, keys) => {
        const p = PURPOSES.find((x) => x.purpose === purpose) as PurposeCase;
        const w = await world({
            clock: purpose === 'emergency_closure' ? '2026-10-07T03:30:00Z' : undefined, // 09:00 IST for the closure
            campaign: { purpose, facts: p.facts, audience: p.audience },
            call: { purpose, variant: p.variant, language, state, vobizCallUuid: state === 'ringing' ? VOBIZ_CALL_UUID : null },
        });
        if (keys === 'frozen') await w.repo.updateCampaign(ORG, w.campaign.id, { clipKeys: campaignClipKeys(w.campaign, w.school, [language]) });

        const cancelled = await cancelCampaign(w, ORG, w.campaign.id, ADMIN, hangupThatDoesNotLand);
        expect(cancelled.status).toBe('cancelled');

        const result = await answer(w);
        expect(result.xml).not.toBe(EMPTY_HANGUP_XML);
        expect(result.outcome).toBe('withdrawn');
        // Exactly one clip, the verified withdrawn line, then the goodbye pause and the hang-up.
        const urls = playUrls(result.xml);
        expect(urls).toHaveLength(1);
        expect(((await verifySamparkVoiceToken('sampark-audio', tokenOf(urls[0]))) ?? '').split('~')[1]).toBe(w.keys.withdrawn);
        expect(result.xml).toMatch(/<\/Play><Wait length="1"\/><Hangup\/><\/Response>$/);
        expect(result.xml).not.toContain('<Gather');

        // The answer is recorded like any other, so the hangup callback settles the call normally.
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'in_progress', vobizCallUuid: VOBIZ_CALL_UUID });
        expect(w.audits.map((a) => a.action)).toContain('call.withdrawn_played');
        expect((await hangupCallback(w)).outcome).toBe('settled');
        expect(await w.repo.getCall(ORG, CALL_ID)).toMatchObject({ state: 'completed' });
        expect((await w.repo.getCall(ORG, CALL_ID))?.settledAt).toBeTruthy();
    });

    it('the withdrawn clip a parent hears is the reviewed line for their language, naming their school', async () => {
        for (const language of PARENT_LANGUAGES) {
            const w = await world({ call: { language } });
            const clip = await w.repo.getClip(ORG, w.keys.withdrawn as string);
            expect(clip?.text).toBe(callScripts(language).common.withdrawn.replace('{schoolName}', w.school.spokenName[language]));
        }
    });

    it('NEGATIVE CONTROL: a campaign rendered before the withdrawn line existed hangs up cleanly, as before', async () => {
        const w = await world({ clips: (k) => (k === 'withdrawn' ? 'missing' : 'passed') });
        await cancelCampaign(w, ORG, w.campaign.id, ADMIN, hangupThatDoesNotLand);
        const before = await w.repo.getCall(ORG, CALL_ID);
        expect(await answer(w)).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'campaign_closed' });
        expect(await w.repo.getCall(ORG, CALL_ID)).toEqual(before);
    });

    it('a cancel never overrides the other refusals: a paused school or a closed window still says nothing', async () => {
        const paused = await world({ school: { pause: { at: '2026-10-07T05:00:00.000Z', by: ADMIN, reason: 'Exam week', scope: 'all' } } });
        await cancelCampaign(paused, ORG, paused.campaign.id, ADMIN, hangupThatDoesNotLand);
        expect((await answer(paused)).outcome).toBe('school_paused');
        const late = await world({ clock: '2026-10-07T17:30:00Z' }); // 23:00 IST
        await cancelCampaign(late, ORG, late.campaign.id, ADMIN, hangupThatDoesNotLand);
        expect((await answer(late)).outcome).toBe('window_closed');
    });
});

describe('gate H4 — cancelling hangs up the phones still ringing and reports what it did', () => {
    it('a ringing call is hung up through the carrier; one already speaking is left to finish; both are reported', async () => {
        const w = await world({ call: { state: 'ringing', vobizCallUuid: VOBIZ_CALL_UUID } });
        // A second call of the same campaign, already speaking.
        const speaking = testCall({ id: 'feedfacefeedfacefeedfacefeedface', intentId: 'other-intent', state: 'dialing', vobizCallUuid: 'vobiz-leg-0002' });
        await w.repo.createIntentIfAbsent(testIntent({ id: 'other-intent', dedupeKey: 'other', guardianId: 'g002', studentIds: ['s002'] }));
        expect(await w.repo.claimIntentForDial(ORG, 'other-intent', speaking, new Date(speaking.createdAt))).toBe('claimed');
        await w.repo.updateCall(ORG, speaking.id, { state: 'in_progress' });

        const legs: string[] = [];
        const cancelled = await cancelCampaign(w, ORG, w.campaign.id, ADMIN, async (uuid) => {
            legs.push(uuid);
            return true;
        });
        expect(legs).toEqual([VOBIZ_CALL_UUID]); // never the call that is speaking
        expect(cancelled.calls).toEqual({ ringingStopped: 1, stillSpeaking: 1 });
        const audit = w.audits.find((a) => a.action === 'campaign.cancel');
        expect(audit?.detail).toMatchObject({ ringingStopped: 1, stillSpeaking: 1 });
        expect(w.audits.filter((a) => a.action === 'call.hangup_requested')).toEqual([
            expect.objectContaining({ target: `call/${CALL_ID}`, detail: { reason: 'campaign_cancelled', confirmed: true } }),
        ]);
    });

    it('a carrier fault while hanging up never undoes the cancel; the audit says the hang-up failed', async () => {
        const w = await world({ call: { state: 'ringing', vobizCallUuid: VOBIZ_CALL_UUID } });
        const original = w.repo.listCalls.bind(w.repo);
        w.repo.listCalls = async () => {
            throw new Error('firestore unavailable');
        };
        const cancelled = await cancelCampaign(w, ORG, w.campaign.id, ADMIN, hangupThatDoesNotLand);
        w.repo.listCalls = original;
        expect(cancelled).toMatchObject({ status: 'cancelled', calls: null });
        expect((await w.repo.getCampaign(ORG, w.campaign.id))?.status).toBe('cancelled');
        expect(w.audits.find((a) => a.action === 'campaign.cancel')?.detail).toMatchObject({ hangupError: 'firestore unavailable' });
        // And the parent who picks up still hears the withdrawn line.
        expect((await answer(w)).outcome).toBe('withdrawn');
    });
});
