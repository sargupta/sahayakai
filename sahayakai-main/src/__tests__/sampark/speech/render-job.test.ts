/**
 * @jest-environment node
 *
 * runRenderStep (SLICE1_CONTRACT §4): renders each language × variant × clip
 * kind once, verifies only `message` clips, is idempotent, respects maxClips
 * and concurrency, records failures with the transcript, never touches
 * campaign.status.
 */

import type { AudioStore, SamparkRepo, SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import { SAMPLE_CLOSURE, SAMPLE_PTM, SAMPLE_SCHOOL } from '@/lib/sampark/scripts/samples';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import { isRunaway, MESSAGE_LEAD_IN_SECONDS, neededClips, runRenderStep } from '@/lib/sampark/speech/render-job';
import { estimateSeconds } from '@/lib/sampark/scripts/render';
import { buildMulawWav, mulawSamples, parseWav } from '@/lib/sampark/speech/wav';
import type { Campaign, CampaignFacts, ParentLanguage, PurposeId, RenderedClip } from '@/types/sampark';

const NOW = new Date('2026-10-01T04:00:00.000Z');
const clock = { now: () => NOW };

function campaign(purpose: PurposeId, facts: CampaignFacts): Campaign {
    return {
        id: 'camp-1',
        orgId: SAMPLE_SCHOOL.orgId,
        purpose,
        facts,
        audience: { sections: [{ grade: 7, section: 'B' }] },
        status: 'rendering',
        notBefore: null,
        expiresAt: '2026-10-10T18:29:59.999Z',
        createdBy: 'u1',
        createdAt: NOW.toISOString(),
        approvedBy: 'u1',
        approvedAt: NOW.toISOString(),
        renderProgress: { done: 0, total: 0, failures: [] },
        counts: { guardians: 0, blocked: 0, queued: 0, inFlight: 0, heardKeyFact: 0, confirmedYes: 0, declinedOrOther: 0, noAnswer: 0, failed: 0, optOuts: 0 },
        updatedAt: NOW.toISOString(),
    };
}

/** The two repo reads and two writes the render step needs — stream B builds the full memory repo. */
function fakeRepo(c: Campaign) {
    const clips = new Map<string, RenderedClip>();
    const updates: Partial<Campaign>[] = [];
    let current = { ...c };
    const repo = {
        getCampaign: async (orgId: string, id: string) => (orgId === c.orgId && id === c.id ? current : null),
        getSchool: async (orgId: string) => (orgId === SAMPLE_SCHOOL.orgId ? SAMPLE_SCHOOL : null),
        getClip: async (_orgId: string, key: string) => clips.get(key) ?? null,
        saveClip: async (clip: RenderedClip) => void clips.set(clip.key, clip),
        updateCampaign: async (_orgId: string, _id: string, patch: Partial<Campaign>) => {
            updates.push(patch);
            current = { ...current, ...patch };
        },
    } as unknown as SamparkRepo;
    return { repo, clips, updates, current: () => current };
}

function fakeStore() {
    const files = new Map<string, Buffer>();
    const store: AudioStore = {
        put: async (key, audio) => void files.set(key, audio),
        get: async (key) => (files.has(key) ? { audio: files.get(key)!, mimeType: 'audio/wav' } : null),
        exists: async (key) => files.has(key),
    };
    return { store, files };
}

/**
 * A synthesizer whose "audio" is the UTF-8 text itself as μ-law samples (UTF-8
 * never contains 0xFF, so the lead-in silence strips off cleanly), reporting
 * 1 s of speech per 12 characters.
 */
function fakeSynth() {
    let inFlight = 0;
    let maxInFlight = 0;
    const calls: string[] = [];
    const synth: SpeechSynthesizer = {
        async synthesize({ text }) {
            calls.push(text);
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((r) => setTimeout(r, 2));
            inFlight--;
            return { audio: buildMulawWav(Buffer.from(text, 'utf8')), mimeType: 'audio/wav', durationSeconds: Array.from(text).length / 12 };
        },
    };
    return { synth, calls, maxInFlight: () => maxInFlight };
}

/** A verifier that "hears" the text in the fake audio, unless told to mishear a language. */
function fakeVerifier(mishear: (language: ParentLanguage, spoken: string) => string | null = () => null) {
    const calls: ParentLanguage[] = [];
    const verifier: SpeechVerifier = {
        async transcribe({ audio, language }) {
            calls.push(language);
            const samples = mulawSamples(audio);
            let i = 0;
            while (i < samples.length && samples[i] === 0xff) i++;
            const spoken = samples.subarray(i).toString('utf8');
            return { transcript: mishear(language, spoken) ?? spoken, confidence: 0.9 };
        },
    };
    return { verifier, calls };
}

const LANGS: ParentLanguage[] = ['English', 'Hindi', 'Bengali', 'Nepali'];

describe('neededClips', () => {
    it('PTM: 7 clips per language; closure: message + confirm per variant plus the common clips once', () => {
        const aud = { kind: 'section', grade: 7, section: 'B' } as const;
        expect(neededClips('ptm_invite', SAMPLE_PTM, SAMPLE_SCHOOL, aud, LANGS)).toHaveLength(28);
        const closure = neededClips('emergency_closure', SAMPLE_CLOSURE, SAMPLE_SCHOOL, aud, ['Nepali', 'Nepali']);
        // today + tomorrow messages, one shared confirm_1, four common clips.
        expect(closure.map((c) => `${c.variant}:${c.kind}`).sort()).toEqual(
            ['today:message', 'tomorrow:message', 'today:confirm_1', 'default:opt_out_confirm', 'default:opt_out_done', 'default:no_input', 'default:fallback_office'].sort(),
        );
        for (const c of closure) expect(c.key).toBe(clipKey(c.speech, c.text));
    });
});

describe('runRenderStep', () => {
    it('renders everything once, verifies EVERY clip a parent can hear, and is idempotent', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo, clips, current } = fakeRepo(c);
        const { store, files } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier();
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock };

        const first = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 3 });
        expect(first).toEqual({ done: 28, total: 28, failures: [], finished: true });
        expect(s.calls).toHaveLength(28);
        expect(v.calls).toHaveLength(28); // every clip, not only the message
        expect(files.size).toBe(28);
        expect(s.maxInFlight()).toBeLessThanOrEqual(3);
        expect(current().renderProgress).toEqual({ done: 28, total: 28, failures: [] });
        expect(current().status).toBe('rendering'); // never changes status

        const message = [...clips.values()].find((x) => x.kind === 'message' && x.language === 'Nepali')!;
        expect(message.verification.status).toBe('passed');
        expect(message.verification.similarity).toBe(1);
        expect(message.engine).toBe('gemini-tts');
        expect(message.languageCode).toBe('ne-NP');
        expect(message.campaignId).toBe('camp-1');
        // The message clip starts with the lead-in silence and its duration includes it.
        const info = parseWav(files.get(message.key)!);
        expect(files.get(message.key)![info.dataOffset]).toBe(0xff);
        expect(info.dataBytes).toBe(Math.round(MESSAGE_LEAD_IN_SECONDS * 8000) + Buffer.byteLength(message.text, 'utf8'));
        expect(message.durationSeconds).toBeCloseTo(Array.from(message.text).length / 12 + MESSAGE_LEAD_IN_SECONDS, 1);
        const confirm = [...clips.values()].find((x) => x.kind === 'confirm_1' && x.language === 'Bengali')!;
        expect(confirm.verification.status).toBe('passed'); // confirmations are heard too
        expect(confirm.engine).toBe('chirp3-hd');

        const second = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 3 });
        expect(second).toEqual({ done: 28, total: 28, failures: [], finished: true });
        expect(s.calls).toHaveLength(28); // nothing re-synthesised
        expect(v.calls).toHaveLength(28);
    });

    it('works in bounded steps with maxClips and reports finished only at the end', async () => {
        const c = campaign('emergency_closure', SAMPLE_CLOSURE);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier();
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock };

        const r1 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r1).toMatchObject({ done: 5, total: 14, finished: false });
        const r2 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r2).toMatchObject({ done: 10, total: 14, finished: false });
        const r3 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r3).toEqual({ done: 14, total: 14, failures: [], finished: true });
        expect(s.calls).toHaveLength(14);
    });

    it('a message that transcribes back wrong is retried once, then recorded as failed with the transcript', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo, clips, current } = fakeRepo(c);
        const { store, files } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier((language, spoken) => (language === 'Bengali' && spoken.includes('অভিভাবক-শিক্ষক সভা') ? 'সম্পূর্ণ অন্য কথা' : null));
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock };

        const r = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 4 });
        expect(r.finished).toBe(true);
        expect(r.done).toBe(27);
        expect(r.failures).toHaveLength(1);
        expect(r.failures[0]).toMatch(/^Bengali default message: similarity 0\.\d+, [\d.]+ s spoken — heard "সম্পূর্ণ অন্য কথা"/);
        expect(v.calls.filter((l) => l === 'Bengali')).toHaveLength(7 + 1); // every Bengali clip once, plus one retry of the message
        const failed = [...clips.values()].find((x) => x.language === 'Bengali' && x.kind === 'message')!;
        expect(failed.verification).toMatchObject({ status: 'failed', transcript: 'সম্পূর্ণ অন্য কথা' });
        expect(files.has(failed.key)).toBe(true); // kept for a person to listen to
        expect(current().renderProgress.failures).toEqual(r.failures);

        // The failure is reported again on a re-run, which re-attempts only that clip.
        const before = s.calls.length;
        const again = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 4 });
        expect(again.failures).toHaveLength(1);
        expect(s.calls.length - before).toBe(2);
    });

    it('class gate: a clip whose voice added or repeated words fails even when the words it should say are all there', async () => {
        // Seen live on 2026-09-30: short confirmations spoken twice, and one Nepali confirmation that
        // invented a date. The transcript can still contain the right words, so length is checked too.
        const c = campaign('emergency_closure', SAMPLE_CLOSURE);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        const doubled: SpeechSynthesizer = {
            async synthesize(req) {
                const r = await s.synth.synthesize(req);
                return req.language === 'English' && req.text.startsWith('Thank you. Please take care')
                    ? { ...r, durationSeconds: r.durationSeconds * 2 + 2 } // spoken twice, plus a pause
                    : r;
            },
        };
        const v = fakeVerifier();
        const r = await runRenderStep({ repo, synth: doubled, verifier: v.verifier, store, clock }, c.orgId, c.id, ['English'], { maxClips: 100, concurrency: 2 });
        expect(r.failures).toEqual([expect.stringMatching(/^English (today|tomorrow|default) confirm_1: similarity 1, [\d.]+ s spoken/)]);
    });

    it('isRunaway allows natural speech but not a doubled clip', () => {
        const text = 'Thank you. Please take care, and stay safe.';
        const estimate = estimateSeconds(text, 'English');
        expect(isRunaway(estimate * 0.8, text, 'English')).toBe(false);
        expect(isRunaway(estimate, text, 'English')).toBe(false);
        expect(isRunaway(estimate * 2 + 2, text, 'English')).toBe(true);
    });

    it('a synthesis error is a failure for that clip only', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        // Fail exactly the two Hindi confirmation clips, whatever their current wording.
        const hindiConfirms = new Set(
            neededClips('ptm_invite', SAMPLE_PTM, SAMPLE_SCHOOL, { kind: 'section', grade: 7, section: 'B' }, ['Hindi'])
                .filter((n) => n.kind === 'confirm_1' || n.kind === 'confirm_2')
                .map((n) => n.text),
        );
        expect(hindiConfirms.size).toBe(2);
        const failing: SpeechSynthesizer = {
            synthesize: (req) => (req.language === 'Hindi' && hindiConfirms.has(req.text) ? Promise.reject(new Error('HTTP 503')) : s.synth.synthesize(req)),
        };
        const v = fakeVerifier();
        const r = await runRenderStep({ repo, synth: failing, verifier: v.verifier, store, clock }, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 2 });
        expect(r.failures).toEqual([expect.stringMatching(/^Hindi default confirm_1: HTTP 503/), expect.stringMatching(/^Hindi default confirm_2: HTTP 503/)]);
        expect(r.done).toBe(26);
        expect(r.finished).toBe(true);
    });

    it('throws for a missing campaign or school', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const deps = { repo, synth: fakeSynth().synth, verifier: fakeVerifier().verifier, store, clock };
        await expect(runRenderStep(deps, c.orgId, 'nope', LANGS, { maxClips: 1, concurrency: 1 })).rejects.toThrow(/not found/);
        await expect(runRenderStep(deps, 'other-org', c.id, LANGS, { maxClips: 1, concurrency: 1 })).rejects.toThrow(/not found/);
    });
});
