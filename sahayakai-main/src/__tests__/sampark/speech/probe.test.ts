/**
 * @jest-environment node
 *
 * CLASS GATE — the hard-word probe (voice phase contract §B, CONVERSATION_PLAN
 * §6.1). Founder bug, 7 Oct 2026: Chirp 3 HD bn-IN said সকাল so it came back as
 * "কাল", আটই as "আটি", "আপনি আসছেন" as "আপনি আশ্চর্য", and the transcribe-back
 * gate passed it at 0.954. The class: ANY voice that mispronounces ANY known-hard
 * word of its language. These tests pin that such a voice cannot pass the probe,
 * that a pass is only ever reused for exactly the voice and probe it was earned
 * by, and that every parent language has a probe covering its hard words.
 */

import { PARENT_LANGUAGE_INFO, type SpeechEngineConfig } from '@/lib/sampark/languages';
import type { SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { estimateSeconds } from '@/lib/sampark/scripts/render';
import {
    ensureVoiceProbe,
    missingHardWords,
    PROBE_VERSION,
    PROBES,
    runVoiceProbe,
    voiceProbeKey,
    type ProbeDeps,
    type VoiceProbeRecord,
} from '@/lib/sampark/speech/probe';
import { SARVAM_STT_LANGUAGES, secondaryRecognizerFor } from '@/lib/sampark/speech/secondary-recognizers';
import type { ParentLanguage } from '@/types/sampark';

import { fakeMulawWav } from './helpers';

const LANGUAGES = Object.keys(PARENT_LANGUAGE_INFO) as ParentLanguage[];

/** The hard words the contract names per language; each must be spoken in the probe sentence and covered by a hard word. */
const CONTRACT_HARD_WORDS: Record<ParentLanguage, string[]> = {
    Bengali: ['সকাল', 'আটই', 'এই', 'আসছেন', 'বৃহস্পতিবার', 'সাড়ে', 'শিলিগুড়ি'],
    Hindi: ['कॉल', 'गुरुवार', 'साढ़े', 'मीटिंग', 'सिलीगुड़ी'],
    English: ['Siliguri', 'Thursday', 'thirty', 'parent teacher meeting'],
    Nepali: ['बिहीबार', 'साढे', 'थिच्नुहोस्', 'स्कुल', 'सिलिगुडी'],
};

const BENGALI_CHIRP3HD: SpeechEngineConfig = PARENT_LANGUAGE_INFO.Bengali.speech;
const BENGALI_GEMINI: SpeechEngineConfig = { engine: 'gemini-tts', ttsLanguageCode: 'bn-IN', voice: 'Kore', model: 'gemini-x-tts', sttLanguageCode: 'bn-IN' };

/** The probe sentence spoken the way Chirp 3 HD spoke it to both recognisers in R2. */
const CHIRP3HD_BENGALI_PROBE_HEARD = 'নমস্কার, শিলিগুড়ি থেকে স্কুলের তরফে বলছি। এই বৃহস্পতিবার আটি অক্টোবর কাল সাড়ে দশটায় প্যারেন্ট টিচার মিটিং আছে। আপনি আশ্চর্য তো?';

function echoVerifier(transcriptFor: (language: ParentLanguage) => string = (l) => PROBES[l].sentence): SpeechVerifier & { calls: Buffer[] } {
    const calls: Buffer[] = [];
    return {
        calls,
        async transcribe({ audio, language }) {
            calls.push(audio);
            return { transcript: transcriptFor(language), confidence: 0.9 };
        },
    };
}

function fakeSynth(): SpeechSynthesizer & { requests: Parameters<SpeechSynthesizer['synthesize']>[0][] } {
    const requests: Parameters<SpeechSynthesizer['synthesize']>[0][] = [];
    return {
        requests,
        async synthesize(req) {
            requests.push(req);
            return { audio: fakeMulawWav(1), mimeType: 'audio/wav', durationSeconds: 1 };
        },
    };
}

function deps(overrides: Partial<ProbeDeps> = {}): ProbeDeps & { synth: ReturnType<typeof fakeSynth> } {
    return {
        synth: fakeSynth(),
        primary: { name: 'chirp_2', verifier: echoVerifier() },
        secondary: { name: 'sarvam', verifier: echoVerifier() },
        clock: { now: () => new Date('2026-10-07T09:00:00.000Z') },
        ...overrides,
    } as ProbeDeps & { synth: ReturnType<typeof fakeSynth> };
}

describe('missingHardWords — fails on pronunciation, never on how a recogniser spells', () => {
    it('class gate: the Chirp 3 HD Bengali failure (কাল for সকাল, আটি for আটই, আশ্চর্য for আসছেন) fails', () => {
        const { hardWords } = PROBES.Bengali;
        expect(missingHardWords(CHIRP3HD_BENGALI_PROBE_HEARD, hardWords, 'Bengali')).toEqual(['আটই', 'সকাল', 'আসছেন']);
    });

    it('class gate: the R2 recordings themselves — Chirp 2 heard আটটি, Saarika heard কাল — both fail', () => {
        const words = ['সকাল', 'আটই', 'বৃহস্পতিবার', 'সাড়ে দশটায়'];
        const chirp2 = 'বৃহস্পতিবার আটটি অক্টোবর সকাল সাড়ে দশটায় স্কুলের হলে প্যারেন্ট টিচার মিটিং আছে';
        const saarika = 'বৃহস্পতি বার আটই অক্টোবর কাল সাড়ে দশটায় স্কুলের হলে প্যারেন্ট টিচার মিটিং আছে।';
        expect(missingHardWords(chirp2, words, 'Bengali')).toEqual(['আটই']);
        expect(missingHardWords(saarika, words, 'Bengali')).toEqual(['সকাল']);
    });

    it('a word is only ever matched on whole tokens: "কাল" never satisfies "সকাল", nor "সকাল" "কাল"', () => {
        expect(missingHardWords('কাল', ['সকাল'], 'Bengali')).toEqual(['সকাল']);
        expect(missingHardWords('সকাল', ['কাল'], 'Bengali')).toEqual(['কাল']);
        expect(missingHardWords('call', ['all'], 'English')).toEqual(['all']);
    });

    it('accepts the ways good voices came back in R2: clock digits, ৮ই / 8 ই, split words, Devanagari-written Bengali', () => {
        const { hardWords } = PROBES.Bengali;
        const gemini = 'নমস্কার শিলিগুড়ি থেকে স্কুলের তরফে বলছি এই বৃহস্পতিবার 8 ই অক্টোবর সকাল 10:30 টায় প্যারেন্ট টিচার মিটিং আছে আপনি আসছেন তো';
        const saarika = 'নমস্কার, শিলিগুড়ি থেকে স্কুলের তরফে বলছি। এই বৃহস্পতি বার ৮ই অক্টোবর সকাল সাড়ে ১০টায় প্যারেন্ট টিচার মিটিং আছে। আপনি আসছেন তো?';
        expect(missingHardWords(gemini, hardWords, 'Bengali')).toEqual([]);
        expect(missingHardWords(saarika, hardWords, 'Bengali')).toEqual([]);
        expect(missingHardWords('सकाल', ['সকাল'], 'Bengali')).toEqual([]);
        // ী/ি and শ/স are one sound in Bengali; recognisers pick either spelling.
        expect(missingHardWords('শিলিগুড়ী', ['শিলিগুড়ি'], 'Bengali')).toEqual([]);
    });

    it('multi-word hard words must appear contiguously, spacing-insensitive', () => {
        const w = ['parent teacher meeting'];
        expect(missingHardWords('The Parent-Teacher Meeting is on Thursday', w, 'English')).toEqual([]);
        expect(missingHardWords('the parentteacher meeting', w, 'English')).toEqual([]);
        expect(missingHardWords('the parent and teacher meeting', w, 'English')).toEqual(w);
        expect(missingHardWords('the teacher meeting', w, 'English')).toEqual(w);
    });

    it('the half hour: "10:30", "साढ़े दस" and "half past ten" are one time; another time is not', () => {
        expect(missingHardWords('on Thursday at 10:30 a.m.', ['ten thirty'], 'English')).toEqual([]);
        expect(missingHardWords('at half past ten', ['ten thirty'], 'English')).toEqual([]);
        expect(missingHardWords('at ten thirteen', ['ten thirty'], 'English')).toEqual(['ten thirty']);
        expect(missingHardWords('सुबह 10:30 बजे', ['साढ़े दस'], 'Hindi')).toEqual([]);
        expect(missingHardWords('सुबह साढ़े नौ बजे', ['साढ़े दस'], 'Hindi')).toEqual(['साढ़े दस']);
        expect(missingHardWords('बिहान १०:३० बजे', ['साढे दस'], 'Nepali')).toEqual([]);
    });

    it('Hindi: the wrong day or "काल" for "कॉल" fails; गुरूवार (a common spelling) passes', () => {
        expect(missingHardWords('पेरेंट टीचर मीटिंग बुधवार को है', ['गुरुवार'], 'Hindi')).toEqual(['गुरुवार']);
        expect(missingHardWords('एक काल है', ['कॉल'], 'Hindi')).toEqual(['कॉल']);
        expect(missingHardWords('गुरूवार', ['गुरुवार'], 'Hindi')).toEqual([]);
        expect(missingHardWords('सिलिगुडी', ['सिलीगुड़ी'], 'Hindi')).toEqual([]);
    });

    it('Nepali: Chirp spells बिहिबार and साढे दश; थिच्नुहोस् heard as खिच्नुहोस् fails', () => {
        const { hardWords } = PROBES.Nepali;
        const chirp = 'नमस्ते सिलिगुडी स्कुल बाट फोन गरेको बिहिबार बिहान साढे दश बजे प्यारेन्ट टिचर मिटिङ छ आउन सक्नुहुन्छ भने एक नम्बर थिच्नुहोस्';
        expect(missingHardWords(chirp, hardWords, 'Nepali')).toEqual([]);
        expect(missingHardWords(chirp.replace('थिच्नुहोस्', 'खिच्नुहोस्'), hardWords, 'Nepali')).toEqual(['थिच्नुहोस्']);
    });

    it('an empty transcript misses everything; a hard word that normalises to nothing is never vacuously present', () => {
        expect(missingHardWords('', PROBES.Hindi.hardWords, 'Hindi')).toEqual(PROBES.Hindi.hardWords);
        expect(missingHardWords('anything at all', ['…'], 'English')).toEqual(['…']);
    });
});

describe('PROBES — every parent language has one, covering its hard words', () => {
    it.each(LANGUAGES)('%s: the sentence contains every one of its hard words', (language) => {
        const probe = PROBES[language];
        expect(probe).toBeDefined();
        expect(probe.language).toBe(language);
        expect(probe.hardWords.length).toBeGreaterThanOrEqual(4);
        expect(missingHardWords(probe.sentence, probe.hardWords, language)).toEqual([]);
    });

    it.each(LANGUAGES)('%s: every contract hard word is spoken and checked', (language) => {
        const { sentence, hardWords } = PROBES[language];
        for (const word of CONTRACT_HARD_WORDS[language]) {
            expect(sentence.normalize('NFC')).toContain(word.normalize('NFC'));
            expect(hardWords.some((h) => h.normalize('NFC').includes(word.normalize('NFC')))).toBe(true);
        }
    });

    it.each(LANGUAGES)('%s: dropping any single hard word from the transcript fails the probe', (language) => {
        const { sentence, hardWords } = PROBES[language];
        for (const word of hardWords) {
            const without = sentence.normalize('NFC').replace(word.normalize('NFC'), ' ');
            expect(missingHardWords(without, hardWords, language)).toContain(word);
        }
    });

    it.each(LANGUAGES)('%s: the sentence is short enough to probe cheaply (≤ 15 s estimated)', (language) => {
        expect(estimateSeconds(PROBES[language].sentence, language)).toBeLessThanOrEqual(15);
    });

    it.each(LANGUAGES)('%s: its second recogniser supports its language', (language) => {
        const stt = PARENT_LANGUAGE_INFO[language].speech.sttLanguageCode;
        const kind = secondaryRecognizerFor(language);
        if (kind === 'sarvam') expect(SARVAM_STT_LANGUAGES).toContain(stt);
        else expect(language).toBe('Nepali'); // Saarika has no Nepali; Chirp 3 is its second recogniser
    });
});

describe('voiceProbeKey', () => {
    it('is the sha256 hex of the voice identity and the probe version', () => {
        const key = voiceProbeKey(BENGALI_GEMINI);
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(voiceProbeKey(BENGALI_GEMINI)).toBe(key);
        expect(voiceProbeKey(BENGALI_GEMINI, PROBE_VERSION)).toBe(key);
    });

    it('changes with the engine, model, voice, language code or probe version', () => {
        const base = voiceProbeKey(BENGALI_GEMINI);
        expect(voiceProbeKey({ ...BENGALI_GEMINI, engine: 'chirp3-hd' })).not.toBe(base);
        expect(voiceProbeKey({ ...BENGALI_GEMINI, model: 'gemini-y-tts' })).not.toBe(base);
        expect(voiceProbeKey({ ...BENGALI_GEMINI, model: null })).not.toBe(base);
        expect(voiceProbeKey({ ...BENGALI_GEMINI, voice: 'Puck' })).not.toBe(base);
        expect(voiceProbeKey({ ...BENGALI_GEMINI, ttsLanguageCode: 'bn-BD' })).not.toBe(base);
        expect(voiceProbeKey(BENGALI_GEMINI, PROBE_VERSION + 1)).not.toBe(base);
    });
});

describe('runVoiceProbe', () => {
    it('passes when both recognisers hear every hard word; synthesises the probe sentence plainly and normalised', async () => {
        const primary = echoVerifier();
        const secondary = echoVerifier();
        const normalised = fakeMulawWav(2);
        const d = deps({ primary: { name: 'chirp_2', verifier: primary }, secondary: { name: 'sarvam', verifier: secondary }, normalise: () => normalised });
        const record = await runVoiceProbe(d, 'Bengali', BENGALI_GEMINI);

        expect(record).toMatchObject({ key: voiceProbeKey(BENGALI_GEMINI), language: 'Bengali', speech: BENGALI_GEMINI, probeVersion: PROBE_VERSION, status: 'passed', checkedAt: '2026-10-07T09:00:00.000Z' });
        expect(record.recognizers).toEqual([
            { name: 'chirp_2', transcript: PROBES.Bengali.sentence, missing: [] },
            { name: 'sarvam', transcript: PROBES.Bengali.sentence, missing: [] },
        ]);
        expect(d.synth.requests).toEqual([{ text: PROBES.Bengali.sentence, language: 'Bengali', speech: BENGALI_GEMINI, delivery: 'plain' }]);
        expect(primary.calls[0]).toBe(normalised);
        expect(secondary.calls[0]).toBe(normalised);
    });

    it('class gate: a secondary recogniser that drops one hard word fails the probe', async () => {
        for (const language of LANGUAGES) {
            const dropped = PROBES[language].hardWords[0];
            const secondary = echoVerifier((l) => PROBES[l].sentence.normalize('NFC').replace(dropped.normalize('NFC'), ''));
            const record = await runVoiceProbe(deps({ secondary: { name: 'second', verifier: secondary } }), language, PARENT_LANGUAGE_INFO[language].speech);
            expect(record.status).toBe('failed');
            expect(record.recognizers[0].missing).toEqual([]);
            expect(record.recognizers[1].missing).toEqual([dropped]);
        }
    });

    it('class gate: Chirp 3 HD Bengali as both recognisers heard it fails', async () => {
        const heard = echoVerifier(() => CHIRP3HD_BENGALI_PROBE_HEARD);
        const record = await runVoiceProbe(deps({ primary: { name: 'chirp_2', verifier: heard }, secondary: { name: 'sarvam', verifier: echoVerifier(() => CHIRP3HD_BENGALI_PROBE_HEARD) } }), 'Bengali', BENGALI_CHIRP3HD);
        expect(record.status).toBe('failed');
        expect(record.recognizers.map((r) => r.missing)).toEqual([['আটই', 'সকাল', 'আসছেন'], ['আটই', 'সকাল', 'আসছেন']]);
    });

    it('refuses one recogniser counted twice: the two must be independent', async () => {
        const same = echoVerifier();
        await expect(runVoiceProbe(deps({ primary: { name: 'chirp_2', verifier: same }, secondary: { name: 'other', verifier: same } }), 'Hindi', PARENT_LANGUAGE_INFO.Hindi.speech)).rejects.toThrow(/independent/);
        await expect(runVoiceProbe(deps({ secondary: { name: 'chirp_2', verifier: echoVerifier() } }), 'Hindi', PARENT_LANGUAGE_INFO.Hindi.speech)).rejects.toThrow(/independent/);
    });
});

describe('ensureVoiceProbe — a pass is reused only for exactly the voice and probe that earned it', () => {
    function stored(speech: SpeechEngineConfig, overrides: Partial<VoiceProbeRecord> = {}): VoiceProbeRecord {
        return {
            key: voiceProbeKey(speech),
            language: 'Bengali',
            speech,
            probeVersion: PROBE_VERSION,
            status: 'passed',
            recognizers: [{ name: 'chirp_2', transcript: 'x', missing: [] }, { name: 'sarvam', transcript: 'x', missing: [] }],
            checkedAt: '2026-10-01T00:00:00.000Z',
            ...overrides,
        };
    }

    it('reuses a stored pass for the same config and PROBE_VERSION without synthesising', async () => {
        const repo = createMemorySamparkRepo();
        await repo.saveVoiceProbe(stored(BENGALI_GEMINI));
        const d = deps();
        const record = await ensureVoiceProbe({ ...d, repo }, 'Bengali', BENGALI_GEMINI);
        expect(record.checkedAt).toBe('2026-10-01T00:00:00.000Z');
        expect(d.synth.requests).toHaveLength(0);
    });

    it('class gate: a pass for another config is not reused', async () => {
        const repo = createMemorySamparkRepo();
        await repo.saveVoiceProbe(stored(BENGALI_GEMINI));
        const failing = echoVerifier(() => CHIRP3HD_BENGALI_PROBE_HEARD);
        const d = deps({ secondary: { name: 'sarvam', verifier: failing } });
        const record = await ensureVoiceProbe({ ...d, repo }, 'Bengali', BENGALI_CHIRP3HD);
        expect(d.synth.requests).toHaveLength(1);
        expect(record.status).toBe('failed');
        expect(await repo.getVoiceProbe(voiceProbeKey(BENGALI_CHIRP3HD))).toEqual(record);
        expect((await repo.getVoiceProbe(voiceProbeKey(BENGALI_GEMINI)))?.status).toBe('passed'); // untouched
    });

    it('class gate: a pass from an older PROBE_VERSION is not reused', async () => {
        const repo = createMemorySamparkRepo();
        // Under the older version's own key (how it was written) …
        await repo.saveVoiceProbe(stored(BENGALI_GEMINI, { key: voiceProbeKey(BENGALI_GEMINI, PROBE_VERSION - 1), probeVersion: PROBE_VERSION - 1 }));
        const d1 = deps();
        expect((await ensureVoiceProbe({ ...d1, repo }, 'Bengali', BENGALI_GEMINI)).probeVersion).toBe(PROBE_VERSION);
        expect(d1.synth.requests).toHaveLength(1);

        // … and even if an old record somehow sits under the current key.
        const repo2 = createMemorySamparkRepo();
        await repo2.saveVoiceProbe(stored(BENGALI_GEMINI, { probeVersion: PROBE_VERSION - 1 }));
        const d2 = deps();
        await ensureVoiceProbe({ ...d2, repo: repo2 }, 'Bengali', BENGALI_GEMINI);
        expect(d2.synth.requests).toHaveLength(1);
    });

    it('a pass earned with another language’s sentence is not reused (the key leaves the language out)', async () => {
        const repo = createMemorySamparkRepo();
        await repo.saveVoiceProbe(stored(BENGALI_GEMINI, { language: 'Hindi' }));
        const d = deps();
        const record = await ensureVoiceProbe({ ...d, repo }, 'Bengali', BENGALI_GEMINI);
        expect(d.synth.requests).toHaveLength(1);
        expect(record.language).toBe('Bengali');
    });

    it('re-runs a stored failure exactly once per call, stores and returns the new result without throwing', async () => {
        const repo = createMemorySamparkRepo();
        await repo.saveVoiceProbe(stored(BENGALI_GEMINI, { status: 'failed' }));

        const stillFailing = deps({ secondary: { name: 'sarvam', verifier: echoVerifier(() => CHIRP3HD_BENGALI_PROBE_HEARD) } });
        const failed = await ensureVoiceProbe({ ...stillFailing, repo }, 'Bengali', BENGALI_GEMINI);
        expect(stillFailing.synth.requests).toHaveLength(1);
        expect(failed.status).toBe('failed');
        expect(failed.checkedAt).toBe('2026-10-07T09:00:00.000Z');

        const nowPassing = deps();
        const passed = await ensureVoiceProbe({ ...nowPassing, repo }, 'Bengali', BENGALI_GEMINI);
        expect(nowPassing.synth.requests).toHaveLength(1);
        expect(passed.status).toBe('passed');
        expect(await repo.getVoiceProbe(voiceProbeKey(BENGALI_GEMINI))).toEqual(passed);
    });

    it('an outage is not a verdict: a recogniser error propagates and nothing is stored', async () => {
        const repo = createMemorySamparkRepo();
        const broken: SpeechVerifier = { transcribe: async () => { throw new Error('Sarvam STT failed: HTTP 503'); } };
        await expect(ensureVoiceProbe({ ...deps({ secondary: { name: 'sarvam', verifier: broken } }), repo }, 'Bengali', BENGALI_GEMINI)).rejects.toThrow(/503/);
        expect(await repo.getVoiceProbe(voiceProbeKey(BENGALI_GEMINI))).toBeNull();
    });
});
