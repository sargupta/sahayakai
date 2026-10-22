/**
 * The Nepali-versus-Hindi gate (class gate 7).
 *
 * Plan §5: Nepali and Hindi share Devanagari, so a script check cannot tell
 * them apart, and naive marker lists misfire (छ sits inside Hindi कुछ and
 * अच्छा; हो is also a Hindi verb; है appears in colloquial Nepali). The gate is
 * therefore PER SENTENCE, on WHOLE WORDS, with template slots masked:
 *
 *   a sentence FAILS if it contains
 *     - a Hindi-only word (है, नहीं, में, से, दबाएँ, होगी, रुपये …) or a Hindi
 *       future-tense ending (-एगा/-ेगी/-ेंगे …), or
 *     - any nukta (U+093C, or a precomposed nukta letter) or ॉ / ऑ, or
 *     - NO Nepali marker at all (छ, छैन, हुन्छ, तपाईं, पनि, भने, लागि … as
 *       whole words, or the endings -लाई -बाट -सम्म -हरू -नुहोस् -नेछ -को -मा).
 *
 * Decisions (documented and tested):
 *   - "है" is flagged even in colloquial Nepali ("…आउनुहोस् है", "है त").
 *     A reviewed notice never needs the tag particle; a false fail costs a
 *     rewrite, a false pass lets Hindi reach a Nepali family.
 *   - A standalone "को" (Hindi dative, Nepali "who") is not a marker; only
 *     "-को" as a suffix is (स्कूलको, {schoolName}को).
 *   - Greetings and thanks ("नमस्ते", "धन्यवाद") carry no marker, so Nepali
 *     templates join them to a sentence with a comma.
 *   - A sentence made only of slots ("{buses}") passes: its filler is itself a
 *     template sentence, checked on its own and again in the rendered text.
 *     The Hindi negative control is unaffected — a Hindi slot-only sentence is
 *     vacuous too, and every Hindi sentence with words must still fail.
 *
 * The gate proves itself: it must pass every Nepali template sentence and fail
 * every Hindi one (the negative control in the class-gate test).
 */

/** Stand-in for a `{slot}` so the gate judges only reviewed template words. */
export const SLOT_MASK = '◌';

export const HINDI_ONLY_WORDS: ReadonlySet<string> = new Set([
    'है', 'हैं', 'था', 'थी', 'थे', 'नहीं', 'मत', 'आप', 'आपका', 'आपकी', 'आपके', 'आपको', 'आपने',
    'हम', 'हमारा', 'हमारी', 'हमारे', 'हमें', 'यह', 'वह', 'ये', 'वे', 'इसमें', 'उसमें', 'में', 'से',
    'तक', 'और', 'भी', 'लिए', 'करें', 'कीजिए', 'दबाएँ', 'दबाएं', 'दबाइए', 'होगा', 'होगी', 'होंगे',
    'होंगी', 'सकते', 'सकती', 'सकता', 'रुपये', 'रुपए', 'बारह', 'सौ', 'पंद्रह', 'पन्द्रह', 'तो', 'अगर',
    'गया', 'गई', 'गए', 'रहा', 'रही', 'रहे', 'ऐसी', 'ऐसे', 'ऐसा', 'क्योंकि', 'लेकिन', 'चाहिए',
    'वाला', 'वाली', 'वाले',
].map((w) => w.normalize('NFC')));

/** Hindi future-tense endings; Nepali never inflects this way. */
export const HINDI_ONLY_ENDINGS: readonly string[] = ['ेगा', 'ेगी', 'ेगे', 'ेंगे', 'ेंगी', 'एगा', 'एगी', 'एँगे', 'एँगी', 'एंगे', 'एंगी'].map((e) =>
    e.normalize('NFC'),
);

export const NEPALI_MARKER_WORDS: ReadonlySet<string> = new Set([
    'छ', 'छन्', 'छैन', 'छौ', 'छु', 'हुन्छ', 'हुन्छन्', 'हुँदैन', 'हुनुहुन्छ', 'हुनुहुन्न', 'हुनेछ', 'हुनेछन्',
    'भयो', 'थियो', 'तपाईं', 'तपाईँ', 'हजुर', 'पनि', 'अनि', 'भने', 'भनेर', 'होइन', 'लागि', 'रुपैयाँ',
    'बाट', 'हो', 'यो', 'त्यो', 'यस्ता', 'यस्तो', 'गर्दा', 'सबै', 'धेरै', 'भोलि', 'फेरि',
].map((w) => w.normalize('NFC')));

/** Nepali suffixes; counted only on a longer word (or a masked slot), never as a word on their own. */
export const NEPALI_MARKER_ENDINGS: readonly string[] = [
    'लाई', 'बाट', 'सम्म', 'हरू', 'हरु', 'नुहोस्', 'नुहुन्छ', 'नेछ', 'नेछन्', 'को', 'मा', 'दैन', 'एको',
].map((e) => e.normalize('NFC'));

/** Nukta (combining or precomposed: ऩ ऱ ऴ क़–य़) and the candra-O vowel ॉ / ऑ — Hindi/English-loan spellings, never Nepali. */
const FORBIDDEN_CHARS = /[\u093C\u0929\u0931\u0934\u0958-\u095F\u0949\u0911]/gu;

const SENTENCE_SPLIT = /[\u0964\u0965?!.]+/u;
const WORD_SPLIT = /[\s,;:'"“”‘’()[\]\-–—…/]+/u;

export function maskSlots(text: string): string {
    return text.replace(/\{[^{}]*\}/g, SLOT_MASK);
}

export function splitSentences(text: string): string[] {
    return text
        .normalize('NFC')
        .split(SENTENCE_SPLIT)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export function wordsOf(sentence: string): string[] {
    return sentence.normalize('NFC').split(WORD_SPLIT).filter((w) => w.length > 0);
}

export interface SentenceVerdict {
    sentence: string;
    ok: boolean;
    hindiOnly: string[];
    forbiddenChars: string[];
    nepaliMarkers: string[];
    reason: 'hindi_word' | 'forbidden_char' | 'no_nepali_marker' | null;
}

export function checkNepaliSentence(sentence: string): SentenceVerdict {
    const masked = maskSlots(sentence.normalize('NFC'));
    const hindiOnly: string[] = [];
    const nepaliMarkers: string[] = [];
    const tokens = wordsOf(masked);
    // A sentence that is nothing but slots ("{buses}") has no template words to judge;
    // what fills it is a template of its own and is checked there and in the rendered text.
    if (tokens.every((t) => t.split(SLOT_MASK).join('') === '')) {
        return { sentence, ok: true, hindiOnly, forbiddenChars: [], nepaliMarkers, reason: null };
    }
    for (const token of tokens) {
        const hasSlot = token.includes(SLOT_MASK);
        const bare = token.split(SLOT_MASK).join('');
        if (!bare) continue;
        if (HINDI_ONLY_WORDS.has(bare) || HINDI_ONLY_ENDINGS.some((e) => bare.length > e.length && bare.endsWith(e))) {
            hindiOnly.push(bare);
        }
        if (
            NEPALI_MARKER_WORDS.has(bare) ||
            NEPALI_MARKER_ENDINGS.some((e) => bare.endsWith(e) && (bare.length > e.length || hasSlot))
        ) {
            nepaliMarkers.push(bare);
        }
    }
    const forbiddenChars = [...new Set(masked.match(FORBIDDEN_CHARS) ?? [])];
    const reason: SentenceVerdict['reason'] =
        hindiOnly.length > 0 ? 'hindi_word' : forbiddenChars.length > 0 ? 'forbidden_char' : nepaliMarkers.length === 0 ? 'no_nepali_marker' : null;
    return { sentence, ok: reason === null, hindiOnly, forbiddenChars, nepaliMarkers, reason };
}

/** Every sentence must pass. An empty text passes vacuously (nothing Hindi is said). */
export function checkNepaliText(text: string): { ok: boolean; sentences: SentenceVerdict[] } {
    const sentences = splitSentences(text).map(checkNepaliSentence);
    return { ok: sentences.every((s) => s.ok), sentences };
}

/** For fragments that are never a sentence on their own (event names, venues): only the negative checks. */
export function checkNepaliFragment(fragment: string): { ok: boolean; hindiOnly: string[]; forbiddenChars: string[] } {
    const v = checkNepaliSentence(fragment);
    return { ok: v.hindiOnly.length === 0 && v.forbiddenChars.length === 0, hindiOnly: v.hindiOnly, forbiddenChars: v.forbiddenChars };
}
