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
import { isRunaway, MESSAGE_LEAD_IN_SECONDS, neededClips, runRenderStep, synthesizeClip } from '@/lib/sampark/speech/render-job';
import { integratedLoudness, mulawDecode, mulawEncode, TELEPHONY_TARGET_LUFS } from '@/lib/sampark/speech/dsp';
import { PROBES, type VoiceProbeRecord } from '@/lib/sampark/speech/probe';
import { languageInfo } from '@/lib/sampark/languages';
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
    const probes = new Map<string, VoiceProbeRecord>();
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
        getVoiceProbe: async (key: string) => probes.get(key) ?? null,
        saveVoiceProbe: async (record: VoiceProbeRecord) => void probes.set(record.key, record),
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
/** The fake audio here is text bytes, not speech: loudness normalisation is exercised in its own test below. */
const identity = (wav: Buffer): Buffer => wav;

/**
 * A hard-word probe whose voice is perfect: its own synth and recognisers (so the render
 * synth/verifier call counts below stay exact), hearing back exactly the probe sentence.
 */
function passingVoiceCheck(dropFor?: { language: ParentLanguage; word: string }) {
    const synth: SpeechSynthesizer = {
        async synthesize({ text }) {
            return { audio: buildMulawWav(Buffer.from(text, 'utf8')), mimeType: 'audio/wav', durationSeconds: 1 };
        },
    };
    const hear = (name: string): SpeechVerifier => ({
        async transcribe({ audio, language }) {
            const text = mulawSamples(audio).toString('utf8');
            const drop = name === 'fake-secondary' && dropFor && dropFor.language === language;
            return { transcript: drop ? text.split(dropFor.word).join('') : text, confidence: 1 };
        },
    });
    return { synth, primary: { name: 'fake-primary', verifier: hear('fake-primary') }, secondaryFor: () => ({ name: 'fake-secondary', verifier: hear('fake-secondary') }) };
}

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
    it('PTM: 8 clips per language; closure: message + confirm per variant plus the common clips once', () => {
        const aud = { kind: 'section', grade: 7, section: 'B' } as const;
        // 8 = message, confirm_1, confirm_2 and the five common clips (the withdrawn line, H4, is one of them).
        expect(neededClips('ptm_invite', SAMPLE_PTM, SAMPLE_SCHOOL, aud, LANGS)).toHaveLength(32);
        const closure = neededClips('emergency_closure', SAMPLE_CLOSURE, SAMPLE_SCHOOL, aud, ['Nepali', 'Nepali']);
        // today + tomorrow messages, one shared confirm_1, five common clips.
        expect(closure.map((c) => `${c.variant}:${c.kind}`).sort()).toEqual(
            ['today:message', 'tomorrow:message', 'today:confirm_1', 'default:opt_out_confirm', 'default:opt_out_done', 'default:no_input', 'default:fallback_office', 'default:withdrawn'].sort(),
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
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() };

        const first = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 3 });
        expect(first).toEqual({ done: 32, total: 32, failures: [], finished: true });
        expect(s.calls).toHaveLength(32);
        expect(v.calls).toHaveLength(32); // every clip, not only the message
        expect(files.size).toBe(32);
        expect(s.maxInFlight()).toBeLessThanOrEqual(3);
        expect(current().renderProgress).toEqual({ done: 32, total: 32, failures: [] });
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
        expect(confirm.engine).toBe('gemini-tts-vertex');

        const second = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 3 });
        expect(second).toEqual({ done: 32, total: 32, failures: [], finished: true });
        expect(s.calls).toHaveLength(32); // nothing re-synthesised
        expect(v.calls).toHaveLength(32);
    });

    it('only the main message is rendered with the style hint; every short clip is plain', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo, clips } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        const seen: { text: string; delivery?: string }[] = [];
        const recording: SpeechSynthesizer = {
            synthesize: (req) => {
                seen.push({ text: req.text, delivery: req.delivery });
                return s.synth.synthesize(req);
            },
        };
        await runRenderStep({ repo, synth: recording, verifier: fakeVerifier().verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() }, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 3 });
        const kindOf = new Map([...clips.values()].map((x) => [x.text, x.kind]));
        expect(seen.length).toBe(32);
        for (const r of seen) expect(r.delivery).toBe(kindOf.get(r.text) === 'message' ? 'styled' : 'plain');
    });

    it('works in bounded steps with maxClips and reports finished only at the end', async () => {
        const c = campaign('emergency_closure', SAMPLE_CLOSURE);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier();
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() };

        const r1 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r1).toMatchObject({ done: 5, total: 16, finished: false });
        const r2 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r2).toMatchObject({ done: 10, total: 16, finished: false });
        const r3 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r3).toMatchObject({ done: 15, total: 16, finished: false });
        const r4 = await runRenderStep(deps, c.orgId, c.id, ['Hindi', 'Nepali'], { maxClips: 5, concurrency: 2 });
        expect(r4).toEqual({ done: 16, total: 16, failures: [], finished: true });
        expect(s.calls).toHaveLength(16);
    });

    it('a message that transcribes back wrong is retried once, then recorded as failed with the transcript', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo, clips, current } = fakeRepo(c);
        const { store, files } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier((language, spoken) => (language === 'Bengali' && spoken.includes('প্যারেন্ট টিচার মিটিং') ? 'সম্পূর্ণ অন্য কথা' : null));
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() };

        const r = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 4 });
        expect(r.finished).toBe(true);
        expect(r.done).toBe(31);
        expect(r.failures).toHaveLength(1);
        expect(r.failures[0]).toMatch(/^Bengali default message: similarity 0\.\d+, [\d.]+ s spoken — heard "সম্পূর্ণ অন্য কথা"/);
        expect(v.calls.filter((l) => l === 'Bengali')).toHaveLength(8 + 2); // every Bengali clip once, plus two re-renders of the message
        const failed = [...clips.values()].find((x) => x.language === 'Bengali' && x.kind === 'message')!;
        expect(failed.verification).toMatchObject({ status: 'failed', transcript: 'সম্পূর্ণ অন্য কথা' });
        expect(files.has(failed.key)).toBe(true); // kept for a person to listen to
        expect(current().renderProgress.failures).toEqual(r.failures);

        // The failure is reported again on a re-run, which re-attempts only that clip.
        const before = s.calls.length;
        const again = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 4 });
        expect(again.failures).toHaveLength(1);
        expect(s.calls.length - before).toBe(3);
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
        const r = await runRenderStep({ repo, synth: doubled, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() }, c.orgId, c.id, ['English'], { maxClips: 100, concurrency: 2 });
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
        const r = await runRenderStep({ repo, synth: failing, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() }, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 2 });
        expect(r.failures).toEqual([expect.stringMatching(/^Hindi default confirm_1: HTTP 503/), expect.stringMatching(/^Hindi default confirm_2: HTTP 503/)]);
        expect(r.done).toBe(30);
        expect(r.finished).toBe(true);
    });

    it('throws for a missing campaign or school', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const deps = { repo, synth: fakeSynth().synth, verifier: fakeVerifier().verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck() };
        await expect(runRenderStep(deps, c.orgId, 'nope', LANGS, { maxClips: 1, concurrency: 1 })).rejects.toThrow(/not found/);
        await expect(runRenderStep(deps, 'other-org', c.id, LANGS, { maxClips: 1, concurrency: 1 })).rejects.toThrow(/not found/);
    });
});

describe('loudness normalisation in the render job', () => {
    it('by default every stored clip is levelled to the telephony target before it is verified', async () => {
        // A real tone (not text bytes), far quieter than the target.
        const quiet = Buffer.from(Array.from({ length: 8000 * 3 }, (_, i) => mulawEncode(Math.round(1200 * Math.sin((2 * Math.PI * 440 * i) / 8000)))));
        const heard: Buffer[] = [];
        const result = await synthesizeClip(
            {
                synth: { async synthesize() { return { audio: buildMulawWav(quiet), mimeType: 'audio/wav', durationSeconds: 3 }; } },
                verifier: { async transcribe({ audio }) { heard.push(audio); return { transcript: 'नमस्ते', confidence: 1 }; } },
                clock,
            },
            { kind: 'confirm_1', text: 'नमस्ते', language: 'Hindi', speech: languageInfo('Hindi').speech },
            { retries: 0 },
        );
        const before = integratedLoudness(Float32Array.from(mulawSamples(buildMulawWav(quiet)), (c) => mulawDecode(c) / 32768), 8000);
        const after = integratedLoudness(Float32Array.from(mulawSamples(result.audio), (c) => mulawDecode(c) / 32768), 8000);
        expect(before).toBeLessThan(TELEPHONY_TARGET_LUFS - 6);
        expect(Math.abs(after - TELEPHONY_TARGET_LUFS)).toBeLessThan(0.5);
        expect(heard[0].equals(result.audio)).toBe(true); // the verifier heard exactly what is stored
    });
});

describe('class gate: the hard-word probe guards every language before any audio is made (founder bug, 7 Oct 2026)', () => {
    it('a voice that mishears one hard word renders nothing in its language, and the reason names the word', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier();
        const word = PROBES.Bengali.hardWords.find((w) => w === 'সকাল') ?? PROBES.Bengali.hardWords[0];
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: passingVoiceCheck({ language: 'Bengali', word }) };
        const r = await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 3 });
        expect(r.finished).toBe(true);
        const bengali = r.failures.filter((f) => f.startsWith('Bengali'));
        expect(bengali.length).toBeGreaterThan(0);
        expect(r.failures.every((f) => f.startsWith('Bengali'))).toBe(true);
        expect(bengali[0]).toContain('hard-word check');
        expect(bengali[0]).toContain(word);
        expect(s.calls.some((t) => /[\u0980-\u09FF]/.test(t))).toBe(false); // not one Bengali clip was synthesised
    });

    it('a passing probe is stored and reused: the next step does not probe again', async () => {
        const c = campaign('ptm_invite', SAMPLE_PTM);
        const { repo } = fakeRepo(c);
        const { store } = fakeStore();
        const s = fakeSynth();
        const v = fakeVerifier();
        const check = passingVoiceCheck();
        let probeSyntheses = 0;
        const counted = { ...check, synth: { synthesize: async (req: Parameters<SpeechSynthesizer['synthesize']>[0]) => { probeSyntheses++; return check.synth.synthesize(req); } } };
        const deps = { repo, synth: s.synth, verifier: v.verifier, store, clock, normalise: identity, voiceCheck: counted };
        await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 5, concurrency: 2 });
        const first = probeSyntheses;
        await runRenderStep(deps, c.orgId, c.id, LANGS, { maxClips: 100, concurrency: 2 });
        expect(first).toBeGreaterThan(0);
        expect(probeSyntheses).toBe(new Set(LANGS).size); // one probe per language, ever, for this voice config
    });
});
