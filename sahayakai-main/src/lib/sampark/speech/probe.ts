/**
 * The hard-word probe — the class gate for the Bengali voice bug (voice phase
 * contract, CONVERSATION_PLAN §6.1).
 *
 * Why it exists. On 7 Oct 2026 the founder heard bad Bengali on real calls.
 * Chirp 3 HD `bn-IN` said সকাল so it came back as "কাল"/"skal", আটই as "আটি",
 * and "আপনি আসছেন" as "আপনি আশ্চর্য" — and the transcribe-back gate PASSED the
 * clip at 0.954, because a whole-message similarity measures intelligibility:
 * a handful of wrong words in a long message barely moves it. A parent who
 * hears "কাল" instead of "সকাল" hears the wrong day.
 *
 * The rule. A voice configuration may not render any parent audio until ONE
 * fixed sentence of known-hard words in its language comes back word-for-word
 * — every hard word present — from TWO INDEPENDENT recognisers (Chirp 2 plus
 * Sarvam Saarika, or Chirp 3 for Nepali, which Saarika does not support). Two,
 * because one recogniser can guess a mispronounced word from context; in the
 * research both stumbled on the same words, and only on Chirp 3 HD.
 *
 * Matching. Recognisers write the same speech in different ways, and the
 * probe must fail on pronunciation, never on spelling. Every transcript and
 * every hard word goes through the SAME pipeline:
 *   1. verify.ts `normaliseForCompare` (NFC, case, Devanagari-written Bengali
 *      folded into Bengali script, digits, number words, section letters);
 *   2. spellings a speaker cannot hear apart are folded — vowel length in all
 *      three Indic scripts (Chirp writes बिहिबार for बिहीबार, गुरूवार for
 *      गुरुवार), and in Bengali and Nepali the three sibilants and ণ/न
 *      (Chirp writes साढे दश for साढे दस, खुशी for खुसी); Hindi keeps श/स,
 *      which Hindi speakers do say apart;
 *   3. the number pass again, so a folded variant ("दश") still becomes a digit;
 *   4. the half hour is written as a clock time: "সাড়ে দশটায়", "साढ़े दस",
 *      "half past ten" all become "10 30", because recognisers write "10:30".
 * A hard word (or phrase) is present when its normalised tokens appear as a
 * contiguous run of transcript tokens, compared without spaces (recognisers
 * split "বৃহস্পতি বার" and join "न चाहिए" differently) but always on token
 * boundaries — so "কাল" can never satisfy "সকাল".
 *
 * Records are stored per voice configuration and PROBE_VERSION, so changing
 * the voice, the model, the sentences or these rules forces a fresh probe.
 * Probe sentences are synthetic and never contain personal data.
 */

import { createHash } from 'node:crypto';

import type { SpeechEngineConfig } from '@/lib/sampark/languages';
import type { Clock, SamparkRepo, SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import type { ParentLanguage } from '@/types/sampark';

import { normaliseForCompare } from './verify';

/** Bump whenever a sentence, a hard-word list or the matching rules change: older records stop counting. */
export const PROBE_VERSION = 1;

export interface ProbeDefinition {
    language: ParentLanguage;
    sentence: string;
    hardWords: string[];
}

/**
 * One natural spoken sentence per language, in the register parents hear, ≤ ~15 s.
 *
 * Hard words are the contract's list (words R2 heard fail, plus the place and
 * school words every call says). A word whose inflected form is what the
 * sentence says is checked in that form (Nepali स्कुलबाट contains स्कुल), and
 * the half hour is checked with its hour ("সাড়ে দশটায়") because recognisers
 * write it as a clock time. Words R2 saw "fail" only through a recogniser's
 * spelling or number format (অসুবিধে, सेवन → 7, eighth → 8th, म्यासेज) are
 * deliberately NOT hard words: they fail every voice, including good ones.
 */
export const PROBES: Readonly<Record<ParentLanguage, ProbeDefinition>> = Object.freeze({
    English: {
        language: 'English',
        sentence: 'Hello, this is a call from the school in Siliguri. The parent teacher meeting is on Thursday at ten thirty in the morning.',
        hardWords: ['Siliguri', 'Thursday', 'ten thirty', 'parent teacher meeting'],
    },
    Hindi: {
        language: 'Hindi',
        sentence: 'नमस्ते, यह सिलीगुड़ी के स्कूल की तरफ़ से एक कॉल है। गुरुवार, आठ अक्टूबर को सुबह साढ़े दस बजे पेरेंट टीचर मीटिंग है, ज़रूर आइएगा।',
        hardWords: ['सिलीगुड़ी', 'कॉल', 'गुरुवार', 'साढ़े दस', 'मीटिंग'],
    },
    Bengali: {
        language: 'Bengali',
        sentence: 'নমস্কার, শিলিগুড়ি থেকে স্কুলের তরফে বলছি। এই বৃহস্পতিবার, আটই অক্টোবর, সকাল সাড়ে দশটায় প্যারেন্ট টিচার মিটিং আছে। আপনি আসছেন তো?',
        hardWords: ['শিলিগুড়ি', 'এই', 'বৃহস্পতিবার', 'আটই', 'সকাল', 'সাড়ে দশটায়', 'আসছেন'],
    },
    Nepali: {
        language: 'Nepali',
        sentence: 'नमस्ते, सिलिगुडी स्कुलबाट फोन गरेको। बिहीबार बिहान साढे दस बजे प्यारेन्ट टिचर मिटिङ छ। आउन सक्नुहुन्छ भने एक नम्बर थिच्नुहोस्।',
        hardWords: ['सिलिगुडी', 'स्कुलबाट', 'बिहीबार', 'साढे दस', 'थिच्नुहोस्'],
    },
});

export interface RecognizerResult {
    name: string;
    transcript: string;
    missing: string[];
}

export interface VoiceProbeRecord {
    key: string;
    language: ParentLanguage;
    speech: SpeechEngineConfig;
    probeVersion: number;
    status: 'passed' | 'failed';
    recognizers: RecognizerResult[];
    checkedAt: string;
}

/** sha256 hex of engine|model|voice|ttsLanguageCode|probeVersion — the identity of "this voice, this probe". */
export function voiceProbeKey(speech: SpeechEngineConfig, probeVersion: number = PROBE_VERSION): string {
    const parts = [speech.engine, speech.model ?? '', speech.voice, speech.ttsLanguageCode, String(probeVersion)];
    return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
}

// ── Matching ────────────────────────────────────────────────────────────────

/** Spellings a listener cannot tell apart (see the header). Applied after normaliseForCompare, so Bengali is already in Bengali script. */
function foldUnheardSpelling(s: string, language: ParentLanguage): string {
    if (language === 'Bengali') {
        return s
            .replace(/ী/g, 'ি') // ী → ি
            .replace(/ূ/g, 'ু') // ূ → ু
            .replace(/ঈ/g, 'ই') // ঈ → ই
            .replace(/ঊ/g, 'উ') // ঊ → উ
            .replace(/[শষ]/g, 'স') // শ ষ → স
            .replace(/ণ/g, 'ন'); // ণ → ন
    }
    if (language === 'Hindi' || language === 'Nepali') {
        let out = s
            .replace(/ी/g, 'ि') // ी → ि
            .replace(/ू/g, 'ु') // ू → ु
            .replace(/ई/g, 'इ') // ई → इ
            .replace(/ऊ/g, 'उ'); // ऊ → उ
        if (language === 'Nepali') out = out.replace(/[शष]/g, 'स').replace(/ण/g, 'न'); // श ष → स, ण → न
        return out;
    }
    return s;
}

function baseTokens(text: string, language: ParentLanguage): string[] {
    const once = normaliseForCompare(text, language);
    const twice = normaliseForCompare(foldUnheardSpelling(once, language), language);
    return twice.split(' ').filter(Boolean);
}

/**
 * The words said before the hour for "half past". Fixed here, not read from the
 * call-script lexicon: the probe's rules must not move when a script's wording
 * does (English scripts now say "ten thirty", but a recogniser may still write
 * "half past 10"). Changing this list is a PROBE_VERSION bump.
 */
const HALF_PAST: Readonly<Record<ParentLanguage, string>> = { English: 'half past', Hindi: 'साढ़े', Bengali: 'সাড়ে', Nepali: 'साढे' };

const halfPhraseCache = new Map<ParentLanguage, string[]>();

function halfPhraseTokens(language: ParentLanguage): string[] {
    let tokens = halfPhraseCache.get(language);
    if (!tokens) {
        tokens = baseTokens(HALF_PAST[language], language);
        halfPhraseCache.set(language, tokens);
    }
    return tokens;
}

/** "<half word(s)> N" → "N 30", the way recognisers write the time ("10:30"). */
function foldHalfHours(tokens: string[], language: ParentLanguage): string[] {
    const half = halfPhraseTokens(language);
    if (half.length === 0) return tokens;
    const out: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const hour = tokens[i + half.length];
        if (hour !== undefined && /^\d{1,2}$/.test(hour) && half.every((w, k) => tokens[i + k] === w)) {
            out.push(hour, '30');
            i += half.length;
        } else out.push(tokens[i]);
    }
    return out;
}

function probeTokens(text: string, language: ParentLanguage): string[] {
    return foldHalfHours(baseTokens(text, language), language);
}

/** True when `target` (spaces removed) equals the concatenation of a contiguous run of whole tokens. */
function containsRun(tokens: readonly string[], target: string): boolean {
    for (let i = 0; i < tokens.length; i++) {
        let acc = '';
        for (let j = i; j < tokens.length; j++) {
            acc += tokens[j];
            if (acc === target) return true;
            if (acc.length >= target.length || !target.startsWith(acc)) break;
        }
    }
    return false;
}

/**
 * The hard words (as given) that the transcript does not contain, in order.
 * A hard word that normalises to nothing is reported missing: a vacuous check must never pass.
 */
export function missingHardWords(transcript: string, hardWords: string[], language: ParentLanguage): string[] {
    const tokens = probeTokens(transcript, language);
    return hardWords.filter((word) => {
        const target = probeTokens(word, language).join('');
        return target.length === 0 || !containsRun(tokens, target);
    });
}

// ── Running the probe ───────────────────────────────────────────────────────

export interface ProbeDeps {
    synth: SpeechSynthesizer;
    primary: { name: string; verifier: SpeechVerifier };
    secondary: { name: string; verifier: SpeechVerifier };
    clock: Clock;
    /** The loudness normaliser the render job applies, so the probe hears what parents hear. */
    normalise?: (wav: Buffer) => Buffer;
}

/**
 * Synthesise the language's probe sentence with `speech` (plain delivery: no
 * instruction text, ever) and transcribe it with both recognisers. Passed only
 * if BOTH heard every hard word. Throws only when the probe could not run (TTS
 * or a recogniser errored, or the two recognisers are not independent) — an
 * outage is not evidence about the voice, so it is never recorded as a result.
 */
export async function runVoiceProbe(deps: ProbeDeps, language: ParentLanguage, speech: SpeechEngineConfig): Promise<VoiceProbeRecord> {
    if (deps.primary.name === deps.secondary.name || deps.primary.verifier === deps.secondary.verifier) {
        throw new Error(`The hard-word probe needs two independent recognisers; got "${deps.primary.name}" twice`);
    }
    const probe = PROBES[language];
    const synthesized = await deps.synth.synthesize({ text: probe.sentence, language, speech, delivery: 'plain' });
    const audio = deps.normalise ? deps.normalise(synthesized.audio) : synthesized.audio;
    const recognizers = await Promise.all(
        [deps.primary, deps.secondary].map(async ({ name, verifier }): Promise<RecognizerResult> => {
            const { transcript } = await verifier.transcribe({ audio, mimeType: 'audio/wav', language, sttLanguageCode: speech.sttLanguageCode });
            return { name, transcript, missing: missingHardWords(transcript, probe.hardWords, language) };
        }),
    );
    return {
        key: voiceProbeKey(speech),
        language,
        speech: { ...speech },
        probeVersion: PROBE_VERSION,
        status: recognizers.every((r) => r.missing.length === 0) ? 'passed' : 'failed',
        recognizers,
        checkedAt: deps.clock.now().toISOString(),
    };
}

function isReusablePass(record: VoiceProbeRecord | null, key: string, language: ParentLanguage): record is VoiceProbeRecord {
    return !!record && record.status === 'passed' && record.key === key && record.probeVersion === PROBE_VERSION && record.language === language;
}

/**
 * Returns the stored passing record, or runs the probe (and stores the result).
 * Throws nothing for a failed probe: returns the failed record. A stored FAILED
 * record is re-run — TTS is not deterministic — but at most once per call.
 *
 * The key leaves the language out (contract formula), so a record is reused
 * only for the language it was run for: one voice config serving two languages
 * is probed with each language's own sentence.
 */
export async function ensureVoiceProbe(
    deps: ProbeDeps & { repo: SamparkRepo },
    language: ParentLanguage,
    speech: SpeechEngineConfig,
): Promise<VoiceProbeRecord> {
    const key = voiceProbeKey(speech);
    const stored = await deps.repo.getVoiceProbe(key);
    if (isReusablePass(stored, key, language)) return stored;
    const record = await runVoiceProbe(deps, language, speech);
    await deps.repo.saveVoiceProbe(record);
    return record;
}
