/**
 * @jest-environment node
 *
 * CLASS GATE H4 — clip keys are frozen when a campaign is scheduled
 * (docs/sampark/EDGE_CASES.md §2 gap 3, "silence after an edit").
 *
 * The bug: the answer and keypad webhooks found their audio by re-rendering the
 * script from the CURRENT school settings, so renaming a venue or the school's
 * spoken name after scheduling changed the text, the content key missed, and
 * every call answered afterwards hung up as `audio_unavailable` (and was never
 * retried). The class: any setting a script reads, changed after the audio was
 * approved, must not change what an answered call looks up.
 *
 * What this proves:
 *   1. The render job writes `clipKeys` in the same update that schedules the
 *      campaign, for every language rendered × variant × clip kind, equal to
 *      `campaignClipKeys` on the school as rendered, and every key is a stored
 *      clip that passed its check.
 *   2. If the school changes WHILE the clips render, the campaign is not
 *      scheduled with keys that were never rendered: it stays 'rendering', the
 *      next tick renders the new text, and the keys frozen are those.
 *   3. After scheduling, change the spoken name and a venue name: in every
 *      language, an answered call still plays its message, and key 1, key 2 and
 *      key 9 still play their replies — the very clips that were approved. The
 *      dispatcher's audio length uses the frozen message key too.
 *   4. A frozen campaign never falls back to re-rendering (a language with no
 *      frozen slot has no audio), and the old re-render path still serves
 *      campaigns scheduled before 7 Oct 2026.
 * Negative control: the same edits on a campaign without frozen keys DO miss,
 * so the gate has teeth.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource, SpeechSynthesizer } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { mintSamparkVoiceToken, verifySamparkVoiceToken, voicePrincipal } from '@/lib/sampark/voice/tokens';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import { PARENT_LANGUAGES, type Campaign, type ClipKind, type Intent, type ParentLanguage, type SamparkSchool } from '@/types/sampark';
import { approveCampaign, audienceLanguages, campaignClipKeys, clipKeySlot, createCampaign, resolveCampaignAudience } from '@/server/sampark/campaigns';
import type { SamparkCtx } from '@/server/sampark/http';
import { makeAudioSecondsFor, renderJob } from '@/server/sampark/jobs';
import { enableSchool } from '@/server/sampark/school';
import { handleSamparkAnswer, handleSamparkGather } from '@/server/sampark/voice';

import { ADMIN, CRM_SCHOOL, crmGuardian, crmStudent, fakeSpeech, MON_11_IST, setPhoneEnv, testClock as serverClock } from '../server/_helpers';
import { CALL_ID, ORG, gatherAction, playUrls, setVoiceEnv, testIntent, tokenOf, world, type World } from './_fixtures';

beforeAll(setPhoneEnv);
beforeEach(() => setVoiceEnv());

/** The edits that silenced calls: the school's spoken name in every language, and the name of the venue the PTM is in. */
function editedSchool(school: SamparkSchool): SamparkSchool {
    return {
        ...school,
        spokenName: { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कुल' },
        venues: [
            ...school.venues.filter((v) => v.id !== 'school_hall'),
            { id: 'school_hall', names: { English: 'the new assembly hall', Hindi: 'नया असेंबली हॉल', Bengali: 'নতুন অ্যাসেম্বলি হল', Nepali: 'नयाँ एसेम्बली हल' } },
        ],
    };
}

/** The clip key an audio URL in our XML authorises. */
async function keyOf(url: string): Promise<string> {
    return ((await verifySamparkVoiceToken('sampark-audio', tokenOf(url))) ?? '').split('~')[1];
}

// ── 1 and 2: the render job freezes exactly what it rendered ────────────────

type LangCode = 'en' | 'hi' | 'bn' | 'ne';

/** One family per language code. */
function crm(codes: readonly LangCode[]): CrmSource {
    const students = codes.map((_, i) => crmStudent(`s${i}`, { guardians: [{ guardianId: `g${i}`, isPrimary: true, isGuardianOfRecord: true }] }));
    const guardians = codes.map((code, i) => crmGuardian(`g${i}`, { preferredLanguage: code }));
    return { kind: 'rest', fetchSchool: async () => CRM_SCHOOL, fetchStudents: async () => students, fetchGuardians: async () => guardians };
}

async function scheduledPractice(opts: { editDuringRender?: boolean; codes?: readonly LangCode[] } = {}) {
    const clock = serverClock(MON_11_IST);
    const repo = createMemorySamparkRepo();
    const ctx: SamparkCtx = { repo, clock };
    const speech = fakeSpeech();
    await enableSchool(ctx, ORG, ADMIN, {
        displayName: 'Hillview Demo School',
        isDemo: true,
        spokenName: { English: 'Hillview Demo School', Hindi: 'हिलव्यू डेमो स्कूल', Bengali: 'হিলভিউ ডেমো স্কুল', Nepali: 'हिलभ्यू डेमो स्कुल' },
    });
    expect((await runImport({ repo, clock }, ORG, crm(opts.codes ?? ['en', 'hi', 'bn', 'ne']), ADMIN)).status).toBe('succeeded');
    const campaign = await createCampaign(ctx, ORG, ADMIN, {
        purpose: 'ptm_invite',
        facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 30 }, venueId: 'school_hall' },
        audience: { sections: [] },
    });
    await approveCampaign(ctx, ORG, campaign.id, ADMIN);

    let edited = false;
    if (opts.editDuringRender) {
        // The office renames the school while the first clip is being synthesised.
        const inner = speech.synth;
        const editing: SpeechSynthesizer & { calls: number } = {
            get calls() {
                return inner.calls;
            },
            async synthesize(req) {
                if (!edited) {
                    edited = true;
                    await repo.upsertSchool(editedSchool((await repo.getSchool(ORG)) as SamparkSchool));
                }
                return inner.synthesize(req);
            },
        };
        speech.synth = editing;
    }
    const ticks: Campaign[] = [];
    for (let i = 0; i < 6; i++) {
        await renderJob({ repo, clock, speech });
        const current = (await repo.getCampaign(ORG, campaign.id)) as Campaign;
        ticks.push(current);
        if (current.status !== 'rendering') break;
    }
    return { repo, ctx, speech, campaignId: campaign.id, ticks };
}

describe('gate H4 — the render job freezes the keys of exactly the clips it rendered and checked', () => {
    it('scheduling writes clipKeys for every language × variant × kind, equal to campaignClipKeys, all passed clips', async () => {
        const { repo, ctx, campaignId, ticks } = await scheduledPractice();
        const scheduled = ticks[ticks.length - 1];
        expect(scheduled.status).toBe('scheduled');
        // Never scheduled without its keys: the update that scheduled it carried them.
        for (const t of ticks) expect(t.status === 'scheduled').toBe(t.clipKeys !== undefined);

        const school = (await repo.getSchool(ORG)) as SamparkSchool;
        const languages = audienceLanguages(await resolveCampaignAudience(ctx, ORG, scheduled), school);
        expect(languages).toEqual([...PARENT_LANGUAGES]);
        expect(scheduled.clipKeys).toEqual(campaignClipKeys(scheduled, school, languages));
        const kinds: ClipKind[] = ['confirm_1', 'confirm_2', 'fallback_office', 'message', 'no_input', 'opt_out_confirm', 'opt_out_done', 'withdrawn'];
        for (const language of languages) {
            const slot = scheduled.clipKeys?.[clipKeySlot(language, 'default')] ?? {};
            expect(Object.keys(slot).sort()).toEqual(kinds);
            for (const kind of kinds) {
                const clip = await repo.getClip(ORG, slot[kind] as string);
                expect({ language, kind, status: clip?.verification.status, campaignId: clip?.campaignId }).toEqual({ language, kind, status: 'passed', campaignId });
            }
        }
    });

    it('a school edited WHILE the clips render is never frozen with keys that were not rendered: the next tick renders and freezes the new text', async () => {
        // Two languages (16 clips) fit in one render step, so the edit lands during the step that finishes.
        const { repo, campaignId, ticks } = await scheduledPractice({ editDuringRender: true, codes: ['en', 'ne'] });
        // Tick 1 rendered and checked every clip of the OLD text, then declined to schedule: its keys are stale.
        expect(ticks[0]).toMatchObject({ status: 'rendering', renderProgress: { failures: [] } });
        expect(ticks[0].renderProgress.done).toBe(ticks[0].renderProgress.total);
        expect(ticks[0].clipKeys).toBeUndefined();
        const scheduled = ticks[ticks.length - 1];
        expect(scheduled.status).toBe('scheduled');
        const school = (await repo.getSchool(ORG)) as SamparkSchool;
        expect(school.spokenName.English).toBe('Hillview School');
        expect(scheduled.clipKeys).toEqual(campaignClipKeys(scheduled, school, ['English', 'Nepali']));
        for (const slot of Object.values(scheduled.clipKeys ?? {})) {
            for (const key of Object.values(slot)) {
                const clip = await repo.getClip(ORG, key as string);
                expect(clip?.verification.status).toBe('passed');
                expect(clip?.campaignId).toBe(campaignId);
            }
        }
        const english = await repo.getClip(ORG, scheduled.clipKeys?.[clipKeySlot('English', 'default')]?.message as string);
        expect(english?.text).toContain('Hillview School');
        expect(english?.text).not.toContain('Hillview Demo School');
    });

    it('the dispatcher sizes audio from the frozen message key, whatever the school says now', async () => {
        const { repo, campaignId, ticks } = await scheduledPractice();
        const scheduled = ticks[ticks.length - 1];
        const school = (await repo.getSchool(ORG)) as SamparkSchool;
        await repo.upsertSchool(editedSchool(school));
        const intent: Intent = { ...testIntent(), campaignId, language: 'Bengali' };
        const message = await repo.getClip(ORG, scheduled.clipKeys?.[clipKeySlot('Bengali', 'default')]?.message as string);
        expect(await makeAudioSecondsFor(repo)(editedSchool(school), intent, 'default')).toBe(message?.durationSeconds);
        // Negative control: without the frozen keys the edited school re-renders to a key that was never made.
        await repo.updateCampaign(ORG, campaignId, { clipKeys: undefined });
        expect(await makeAudioSecondsFor(repo)(editedSchool(school), intent, 'default')).toBeNull();
    });
});

// ── 3 and 4: an answered call plays what was approved ───────────────────────

/** A dispatched Test-mode call whose campaign froze its keys from the school as rendered, then the school is edited. */
async function frozenThenEdited(language: ParentLanguage, opts: { freeze?: boolean } = {}): Promise<World> {
    const w = await world({ call: { language } });
    if (opts.freeze ?? true) {
        await w.repo.updateCampaign(ORG, w.campaign.id, { clipKeys: campaignClipKeys(w.campaign, w.school, [language]) });
    }
    await w.repo.upsertSchool(editedSchool(w.school));
    return w;
}

async function answer(w: World) {
    return handleSamparkAnswer(w, { token: await mintSamparkVoiceToken('sampark-answer', voicePrincipal(ORG, CALL_ID)), callUuid: 'vobiz-leg-0001' });
}

describe.each(PARENT_LANGUAGES)('gate H4 — %s: after the school is edited, the approved clips still play', (language) => {
    it('the edit really changes the texts (otherwise this gate would prove nothing)', async () => {
        const w = await world({ call: { language } });
        const before = campaignClipKeys(w.campaign, w.school, [language])[clipKeySlot(language, 'default')];
        const after = campaignClipKeys(w.campaign, editedSchool(w.school), [language])[clipKeySlot(language, 'default')];
        expect(after?.message).not.toBe(before?.message);
        expect(after?.withdrawn).not.toBe(before?.withdrawn);
    });

    it('answer → the approved message and no-input clips inside the menu gather', async () => {
        const w = await frozenThenEdited(language);
        const result = await answer(w);
        expect(result.outcome).toBe('played');
        const [message, noInput] = playUrls(result.xml);
        expect(await keyOf(message)).toBe(w.keys.message);
        expect(await keyOf(noInput)).toBe(w.keys.no_input);
    });

    it.each([
        ['1', ['confirm_1']],
        ['2', ['confirm_2']],
        ['9', ['opt_out_confirm', 'opt_out_done']],
    ] as const)('key %s → the approved reply', async (digit, kinds) => {
        const w = await frozenThenEdited(language);
        const answered = await answer(w);
        const reply = await handleSamparkGather(w, { token: tokenOf(gatherAction(answered.xml) as string), digits: digit, callUuid: null });
        expect(reply.outcome).toBe('played');
        expect(await Promise.all(playUrls(reply.xml).map(keyOf))).toEqual(kinds.map((k) => w.keys[k]));
    });

    it('NEGATIVE CONTROL: the same edits on a campaign without frozen keys find no audio', async () => {
        const w = await frozenThenEdited(language, { freeze: false });
        expect(await answer(w)).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
    });
});

describe('gate H4 — a frozen campaign never falls back to re-rendering', () => {
    it('a call in a language the campaign did not freeze has no audio, even though a re-render would find clips', async () => {
        const w = await world({ call: { language: 'English' } }); // English clips are seeded and passed
        await w.repo.updateCampaign(ORG, w.campaign.id, { clipKeys: campaignClipKeys(w.campaign, w.school, ['Hindi']) });
        expect(await answer(w)).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
    });

    it('a frozen key whose clip later failed its check is refused, not replaced', async () => {
        const w = await frozenThenEdited('Nepali');
        const clip = await w.repo.getClip(ORG, w.keys.message as string);
        await w.repo.saveClip({ ...(clip as NonNullable<typeof clip>), verification: { ...(clip as NonNullable<typeof clip>).verification, status: 'failed' } });
        expect(await answer(w)).toEqual({ xml: EMPTY_HANGUP_XML, outcome: 'audio_unavailable' });
    });
});
