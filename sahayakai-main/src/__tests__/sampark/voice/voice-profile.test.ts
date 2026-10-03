/**
 * @jest-environment node
 *
 * Voice profiles are data (src/lib/sampark/voice-profiles.json). These tests prove
 * (1) the shipped defaults reproduce the pre-profile renderer byte for byte,
 * (2) the validator fences Nepali and pace, and (3) the rules the voice does not touch
 * (no Latin letters in Indic scripts) still hold.
 */

import { availablePurposes, PURPOSE_CATALOGUE } from '@/lib/sampark/catalogue';
import { languageInfo, speechFor, toSpeechConfig, type SpeechEngineConfig } from '@/lib/sampark/languages';
import { SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, sampleFactsFor } from '@/lib/sampark/scripts/samples';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import { buildSynthesizeRequest, GEMINI_TTS_STYLE_PROMPT } from '@/lib/sampark/speech/google-speech';
import { neededClips } from '@/lib/sampark/speech/render-job';
import {
    allVoiceProfiles,
    currentProfile,
    PROVIDER_PACE_RANGE,
    profileProblems,
    purposeGroup,
    validateVoiceProfiles,
    VOICE_PROFILE_FILE,
    VOICE_PURPOSE_GROUPS,
    VoiceProfileError,
    type VoiceProfile,
    type VoiceProfileFile,
} from '@/lib/sampark/voice-profile';
import { PARENT_LANGUAGES, type ParentLanguage, type PurposeId } from '@/types/sampark';

// ── Frozen copy of the renderer BEFORE voice profiles existed ───────────────
// (languages.ts engine table + google-speech.ts buildSynthesizeRequest + clip-key.ts). Never edit:
// it is the oracle that proves "nothing changes in behaviour".
const LEGACY_ENGINES: Record<ParentLanguage, { engine: 'gemini-tts' | 'chirp3-hd'; ttsLanguageCode: string; voice: string; model: string | null; sttLanguageCode: string }> = {
    English: { engine: 'gemini-tts', ttsLanguageCode: 'en-IN', voice: 'Kore', model: 'gemini-2.5-flash-tts', sttLanguageCode: 'en-IN' },
    Hindi: { engine: 'gemini-tts', ttsLanguageCode: 'hi-IN', voice: 'Kore', model: 'gemini-2.5-flash-tts', sttLanguageCode: 'hi-IN' },
    Bengali: { engine: 'chirp3-hd', ttsLanguageCode: 'bn-IN', voice: 'bn-IN-Chirp3-HD-Kore', model: null, sttLanguageCode: 'bn-IN' },
    Nepali: { engine: 'gemini-tts', ttsLanguageCode: 'ne-NP', voice: 'Kore', model: 'gemini-2.5-flash-tts', sttLanguageCode: 'ne-NP' },
};

function legacyRequest(text: string, language: ParentLanguage, delivery: 'styled' | 'plain'): Record<string, unknown> {
    const speech = LEGACY_ENGINES[language];
    const audioConfig = { audioEncoding: 'MULAW', sampleRateHertz: 8000 };
    if (speech.engine === 'gemini-tts') {
        return {
            input: delivery === 'styled' ? { text, prompt: 'Warm, calm and unhurried.' } : { text },
            voice: { languageCode: speech.ttsLanguageCode, name: speech.voice, modelName: speech.model },
            audioConfig,
        };
    }
    return { input: { text }, voice: { languageCode: speech.ttsLanguageCode, name: speech.voice }, audioConfig };
}

function legacyKey(language: ParentLanguage, text: string): string {
    const s = LEGACY_ENGINES[language];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('node:crypto') as typeof import('node:crypto');
    return crypto.createHash('sha256').update([s.engine, s.voice, s.model ?? '', s.ttsLanguageCode, text.normalize('NFC')].join('|'), 'utf8').digest('hex').slice(0, 40);
}

const SAMPLE_TEXTS: Record<ParentLanguage, string> = {
    English: 'Namaste. This is a recorded message from Hillview Demo School. Press 1.',
    Hindi: 'नमस्ते। यह एक रिकॉर्ड किया हुआ संदेश है। 1 दबाएँ।',
    Bengali: 'নমস্কার। এটা একটা রেকর্ড করা বার্তা। এক টিপুন।',
    Nepali: 'नमस्ते। यो रेकर्ड गरिएको सूचना हो। एक थिच्नुहोस्।',
};

const LANGUAGE_CODE = { English: 'en', Hindi: 'hi', Bengali: 'bn', Nepali: 'ne' } as const;

describe('default profile reproduces the pre-profile renderer exactly', () => {
    for (const language of PARENT_LANGUAGES) {
        for (const delivery of ['styled', 'plain'] as const) {
            it(`${language} / ${delivery}: the request payload is byte-identical`, () => {
                for (const group of VOICE_PURPOSE_GROUPS) {
                    const speech = toSpeechConfig(currentProfile(LANGUAGE_CODE[language], group));
                    const now = JSON.stringify(buildSynthesizeRequest(SAMPLE_TEXTS[language], speech, delivery));
                    const before = JSON.stringify(legacyRequest(SAMPLE_TEXTS[language], language, delivery));
                    expect(now).toBe(before);
                }
            });
        }

        it(`${language}: languageInfo().speech and clip keys are unchanged`, () => {
            const s = languageInfo(language).speech;
            expect({ engine: s.engine, ttsLanguageCode: s.ttsLanguageCode, voice: s.voice, model: s.model, sttLanguageCode: s.sttLanguageCode }).toEqual(LEGACY_ENGINES[language]);
            expect(clipKey(s, SAMPLE_TEXTS[language])).toBe(legacyKey(language, SAMPLE_TEXTS[language]));
        });
    }

    it('every purpose resolves to a current profile whose payload and clip key match the old renderer', () => {
        for (const purpose of Object.keys(PURPOSE_CATALOGUE) as PurposeId[]) {
            for (const language of PARENT_LANGUAGES) {
                const speech = speechFor(language, purpose);
                expect(JSON.stringify(buildSynthesizeRequest('x', speech, 'styled'))).toBe(JSON.stringify(legacyRequest('x', language, 'styled')));
                expect(clipKey(speech, 'x')).toBe(legacyKey(language, 'x'));
            }
        }
    });

    it('the clips a campaign renders carry the old keys (existing rendered audio stays valid)', () => {
        for (const spec of availablePurposes()) {
            for (const language of PARENT_LANGUAGES) {
                for (const clip of neededClips(spec.id, sampleFactsFor(spec.id), SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, [language])) {
                    expect(clip.key).toBe(legacyKey(language, clip.text));
                }
            }
        }
    });

    it('Nepali is pinned to ne-NP on the fixed Gemini-TTS model and Bengali is Chirp 3 HD bn-IN, in every group', () => {
        for (const group of VOICE_PURPOSE_GROUPS) {
            const ne = currentProfile('ne', group);
            expect([ne.provider, ne.localeCode, ne.model]).toEqual(['gemini-tts', 'ne-NP', 'gemini-2.5-flash-tts']);
            const bn = currentProfile('bn', group);
            expect([bn.provider, bn.localeCode, bn.model, bn.voice]).toEqual(['chirp3-hd', 'bn-IN', null, 'bn-IN-Chirp3-HD-Kore']);
        }
    });

    it('the shipped style hint is the legacy one and is still a few words', () => {
        expect(currentProfile('hi', 'ptm_event_invite').stylePrompt).toBe(GEMINI_TTS_STYLE_PROMPT);
        expect(GEMINI_TTS_STYLE_PROMPT.split(/\s+/).length).toBeLessThanOrEqual(6);
    });
});

describe('profile data can change the request (and only through the profile)', () => {
    const base = currentProfile('hi', 'ptm_event_invite');

    it('a pace on a Chirp 3 HD profile reaches audioConfig and changes the clip key', () => {
        const chirp = { ...currentProfile('bn', 'ptm_event_invite'), speakingRate: 0.9 };
        const speech = toSpeechConfig(chirp);
        expect((buildSynthesizeRequest('x', speech) as { audioConfig: Record<string, unknown> }).audioConfig).toEqual({ audioEncoding: 'MULAW', sampleRateHertz: 8000, speakingRate: 0.9 });
        expect(clipKey(speech, 'x')).not.toBe(clipKey(toSpeechConfig(currentProfile('bn', 'ptm_event_invite')), 'x'));
    });

    it('a null style prompt sends no prompt even for a styled clip; a different one is sent and keys differently', () => {
        const none = toSpeechConfig({ ...base, stylePrompt: null });
        expect((buildSynthesizeRequest('x', none, 'styled') as { input: object }).input).toEqual({ text: 'x' });
        const other = toSpeechConfig({ ...base, stylePrompt: 'Friendly and clear.' });
        expect((buildSynthesizeRequest('x', other, 'styled') as { input: object }).input).toEqual({ text: 'x', prompt: 'Friendly and clear.' });
        expect(clipKey(other, 'x')).not.toBe(clipKey(toSpeechConfig(base), 'x'));
    });

    it('the Google request builder refuses a Sarvam config', () => {
        const sarvam: SpeechEngineConfig = { engine: 'sarvam-bulbul', ttsLanguageCode: 'hi-IN', voice: 'priya', model: 'bulbul:v3', sttLanguageCode: 'hi-IN' };
        expect(() => buildSynthesizeRequest('x', sarvam)).toThrow(/not a Google/);
    });
});

describe('purpose groups', () => {
    it('every catalogue purpose maps to one of the five groups', () => {
        for (const id of Object.keys(PURPOSE_CATALOGUE) as PurposeId[]) expect(VOICE_PURPOSE_GROUPS).toContain(purposeGroup(id));
    });
    it('the named purposes land in the intended groups', () => {
        expect(purposeGroup('attendance_talk')).toBe('class_teacher_request');
        expect(purposeGroup('recognition')).toBe('recognition');
        expect(purposeGroup('fee_due')).toBe('fees_accounts');
        expect(purposeGroup('emergency_closure')).toBe('closure_emergency');
        expect(purposeGroup('ptm_invite')).toBe('ptm_event_invite');
        expect(purposeGroup('event_invite')).toBe('ptm_event_invite');
    });
});

describe('the shipped file', () => {
    it('validates, has exactly one current profile per language x group, and empty reviewer sign-off everywhere', () => {
        expect(() => validateVoiceProfiles(VOICE_PROFILE_FILE)).not.toThrow();
        for (const code of ['en', 'hi', 'bn', 'ne'] as const) {
            for (const group of VOICE_PURPOSE_GROUPS) {
                expect(allVoiceProfiles().filter((p) => p.language === code && p.group === group && p.status === 'current')).toHaveLength(1);
            }
        }
        for (const p of allVoiceProfiles()) expect(p.review).toEqual({ reviewer: '', date: '', verdict: '' });
    });

    it('every Nepali profile in the file is ne-NP on Gemini-TTS', () => {
        const ne = allVoiceProfiles().filter((p) => p.language === 'ne');
        expect(ne.length).toBeGreaterThan(0);
        for (const p of ne) {
            expect(p.localeCode).toBe('ne-NP');
            expect(p.sttLanguageCode).toBe('ne-NP');
            expect(p.provider).toBe('gemini-tts');
        }
    });

    it('every pace in the file is inside its provider range', () => {
        for (const p of allVoiceProfiles()) {
            if (p.speakingRate === null) continue;
            const range = PROVIDER_PACE_RANGE[p.provider];
            expect(range).not.toBeNull();
            expect(p.speakingRate).toBeGreaterThanOrEqual(range!.min);
            expect(p.speakingRate).toBeLessThanOrEqual(range!.max);
        }
    });
});

describe('validation rejects what must never ship', () => {
    const ne = currentProfile('ne', 'ptm_event_invite');
    const hi = currentProfile('hi', 'ptm_event_invite');
    const bn = currentProfile('bn', 'ptm_event_invite');
    const cand = (p: Partial<VoiceProfile>): VoiceProfile => ({ ...hi, id: 'x-candidate', group: '*', status: 'candidate', ...p });

    it('Nepali on Sarvam Bulbul v3 (no Nepali) is rejected', () => {
        const p = cand({ language: 'ne', provider: 'sarvam-bulbul', model: 'bulbul:v3', voice: 'priya', localeCode: 'ne-NP', sttLanguageCode: 'ne-NP', speakingRate: 1 });
        expect(profileProblems(p).join('\n')).toMatch(/provider sarvam-bulbul has no ne-NP/);
    });
    it('Nepali on Chirp 3 HD (not documented) is rejected', () => {
        const p = cand({ language: 'ne', provider: 'chirp3-hd', model: null, voice: 'ne-NP-Chirp3-HD-Kore', localeCode: 'ne-NP', sttLanguageCode: 'ne-NP', stylePrompt: null });
        expect(profileProblems(p).join('\n')).toMatch(/provider chirp3-hd has no ne-NP/);
    });
    it('Nepali with any locale but ne-NP (hi-IN, ne-IN, en-IN) is rejected, including on Gemini-TTS', () => {
        for (const localeCode of ['hi-IN', 'ne-IN', 'en-IN', 'bn-IN']) {
            expect(profileProblems({ ...ne, id: 'x', group: '*', status: 'candidate', localeCode }).join('\n')).toMatch(/not allowed for language ne|must use locale ne-NP/);
        }
        expect(profileProblems({ ...ne, id: 'x', group: '*', status: 'candidate', sttLanguageCode: 'hi-IN' }).join('\n')).toMatch(/Nepali transcribe-back must use ne-NP/);
    });
    it('a Hindi profile cannot borrow a Nepali locale either', () => {
        expect(profileProblems(cand({ localeCode: 'ne-NP' })).join('\n')).toMatch(/not allowed for language hi/);
    });
    it('a whole file with Nepali on Sarvam fails validation with a listing of problems', () => {
        const file: VoiceProfileFile = {
            ...VOICE_PROFILE_FILE,
            profiles: [...VOICE_PROFILE_FILE.profiles, cand({ id: 'ne-bad', language: 'ne', provider: 'sarvam-bulbul', model: 'bulbul:v3', voice: 'priya', localeCode: 'ne-NP', sttLanguageCode: 'ne-NP', speakingRate: 1 })],
        };
        expect(() => validateVoiceProfiles(file)).toThrow(VoiceProfileError);
        expect(() => validateVoiceProfiles(file)).toThrow(/ne-bad: provider sarvam-bulbul has no ne-NP/);
    });

    it('pace outside the provider range is rejected, and Gemini-TTS takes none', () => {
        expect(profileProblems({ ...bn, speakingRate: 0.24 }).join()).toMatch(/outside chirp3-hd/);
        expect(profileProblems({ ...bn, speakingRate: 2.01 }).join()).toMatch(/outside chirp3-hd/);
        expect(profileProblems({ ...bn, speakingRate: 0.25 })).toEqual([]);
        expect(profileProblems({ ...bn, speakingRate: 2.0 })).toEqual([]);
        const sarvam = { id: 'x', language: 'hi' as const, group: '*' as const, status: 'candidate' as const, provider: 'sarvam-bulbul' as const, model: 'bulbul:v3', voice: 'priya', localeCode: 'hi-IN', sttLanguageCode: 'hi-IN', stylePrompt: null, notes: '', review: { reviewer: '', date: '', verdict: '' as const } };
        expect(profileProblems({ ...sarvam, speakingRate: 0.49 }).join()).toMatch(/outside sarvam-bulbul/);
        expect(profileProblems({ ...sarvam, speakingRate: 2.5 }).join()).toMatch(/outside sarvam-bulbul/);
        expect(profileProblems({ ...sarvam, speakingRate: 0.5 })).toEqual([]);
        expect(profileProblems({ ...hi, speakingRate: 1.0 }).join()).toMatch(/takes no pace parameter/);
        expect(profileProblems({ ...bn, speakingRate: Number.NaN }).join()).toMatch(/finite/);
    });

    it('other structural rules', () => {
        expect(profileProblems({ ...hi, provider: 'elevenlabs' as never }).join()).toMatch(/ElevenLabs is benchmark-only/);
        expect(profileProblems({ ...bn, stylePrompt: 'Warm.' }).join()).toMatch(/ignores a style prompt/);
        expect(profileProblems({ ...hi, stylePrompt: 'one two three four five six seven eight nine ten eleven twelve thirteen' }).join()).toMatch(/over 12 words/);
        expect(profileProblems({ ...hi, model: null }).join()).toMatch(/needs a pinned model/);
        expect(profileProblems({ ...bn, model: 'x' }).join()).toMatch(/takes no model/);
        expect(profileProblems({ ...hi, group: '*' }).join()).toMatch(/must name its purpose group/);
        expect(profileProblems(cand({ language: 'bn', localeCode: 'bn-IN', sttLanguageCode: 'bn-IN', provider: 'gemini-tts' })).join()).toEqual('');
        expect(profileProblems({ ...hi, review: { reviewer: 'A', date: '3 Oct', verdict: '' } }).join()).toMatch(/review.date/);
        expect(profileProblems({ ...hi, review: { reviewer: '', date: '', verdict: 'maybe' as never } }).join()).toMatch(/review must be/);
    });

    it('a current profile needs a verified locale and a Google engine; each slot needs exactly one current', () => {
        expect(profileProblems({ ...hi, provider: 'chirp3-hd', model: null, stylePrompt: null, voice: 'hi-IN-Chirp3-HD-Kore' }).join()).toMatch(/needs a locale verified live/);
        const noCurrent: VoiceProfileFile = { ...VOICE_PROFILE_FILE, profiles: VOICE_PROFILE_FILE.profiles.filter((p) => p.id !== 'hi-ptm-event-invite-current') };
        expect(() => validateVoiceProfiles(noCurrent)).toThrow(/hi\/ptm_event_invite: expected exactly 1 current/);
        const dup: VoiceProfileFile = { ...VOICE_PROFILE_FILE, profiles: [...VOICE_PROFILE_FILE.profiles, VOICE_PROFILE_FILE.profiles[0]] };
        expect(() => validateVoiceProfiles(dup)).toThrow(/duplicate id/);
        expect(() => validateVoiceProfiles({ nope: true })).toThrow(/schemaVersion/);
    });
});

describe('rules the voice does not touch are unchanged: no Latin letters in Indic scripts', () => {
    it('every rendered clip text in Hindi, Bengali and Nepali is free of Latin letters', () => {
        for (const spec of availablePurposes()) {
            for (const language of ['Hindi', 'Bengali', 'Nepali'] as const) {
                for (const clip of neededClips(spec.id, sampleFactsFor(spec.id), SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE, [language])) {
                    expect({ language, kind: clip.kind, latin: clip.text.match(/[A-Za-z]/g) }).toEqual({ language, kind: clip.kind, latin: null });
                }
            }
        }
    });

    it('the voice settings never rewrite the text that is sent', () => {
        const text = SAMPLE_TEXTS.Nepali;
        const req = buildSynthesizeRequest(text, speechFor('Nepali', 'ptm_invite'), 'styled') as { input: { text: string } };
        expect(req.input.text).toBe(text);
    });
});
