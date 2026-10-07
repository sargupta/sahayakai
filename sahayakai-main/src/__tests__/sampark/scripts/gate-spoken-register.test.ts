/**
 * @jest-environment node
 *
 * CLASS GATE — spoken register (VOICE_PHASE_CONTRACT §C; CONVERSATION_PLAN §6.1–6.2).
 *
 * Founder bug, 7 Oct 2026: the first real calls sounded bookish and translated
 * ("অভিভাবক-শিক্ষক সভা", "বার্তা", "कक्षा सात, सेक्शन बी", "half past ten"), and a
 * bare "নয় টিপুন" is ambiguous because নয় also means "is not". The fix moved
 * every script to the register a school office uses on the phone. This gate
 * stops the whole class from coming back:
 *
 *   1. No string in any call-script file (lexicon, names, common clips,
 *      purposes; `_meta` notes may name a retired form to explain it) and no
 *      rendered clip in the fact matrix contains a RETIRED form for its language.
 *   2. Every Bengali keypad instruction is "<number> নম্বর টিপুন", and every
 *      Nepali one "<number> नम्बर थिच्नुहोस्" — never a bare number word.
 *   3. The English time speller can never say "half past", for any hour.
 *   4. The Hindi PTM message (the longest clip on the 7 Oct test call, 32.5 s)
 *      stays within 28 s by estimate for the test-call facts.
 *
 * Each detector is proven against the production wording it replaced
 * (negative controls), so the gate has teeth. A native reviewer who wants a
 * retired word back must remove it here, in review, with a reason.
 */

import { renderNoticeScript, estimateSeconds } from '@/lib/sampark/scripts/render';
import { SAMPLE_PTM, SAMPLE_SCHOOL, SAMPLE_SECTION_AUDIENCE } from '@/lib/sampark/scripts/samples';
import { formatTime } from '@/lib/sampark/scripts/spoken';
import { callScripts, type CallScriptFile } from '@/lib/sampark/scripts/templates';
import { ScriptRenderError } from '@/lib/sampark/scripts/types';
import { PARENT_LANGUAGES, type ParentLanguage } from '@/types/sampark';

import { MATRIX_SCHOOL, renderMatrix } from './matrix';

interface RetiredForm {
    pattern: RegExp;
    why: string;
}

/** A whole word in any script: not preceded or followed by a letter or a combining mark. */
const word = (w: string) => new RegExp(`(?<![\\p{L}\\p{M}])(?:${w})(?![\\p{L}\\p{M}])`, 'u');

/**
 * Patterns are compared in NFC, like the scripts (templates.ts NFC-normalises on load):
 * য় ড় and the Devanagari nukta letters are composition exclusions, so a literal typed
 * precomposed would otherwise never match the loaded text.
 */
const nfc = (r: RegExp) => new RegExp(r.source.normalize('NFC'), r.flags);

/** A keypad digit word (0–9 from the language's own lexicon) directly before the press verb, with no নম্বর / नम्बर. */
function bareKeypad(language: ParentLanguage, verb: string): RegExp {
    const numbers = callScripts(language).lexicon.numbers;
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => numbers[d]).join('|');
    return new RegExp(`(?<![\\p{L}\\p{M}])(?:${digits})\\s+${verb}`, 'u');
}

/** A hyphen touching an Indic letter ("বি-র", "पैरेंट-टीचर"): TTS stumbles on it and parents never "say" it. */
const INDIC_HYPHEN = /[ऀ-ॿঀ-৿]-|-[ऀ-ॿঀ-৿]/u;

const RETIRED_SOURCE: Readonly<Record<ParentLanguage, readonly RetiredForm[]>> = {
    Bengali: [
        { pattern: /অভিভাবক[\s-]*শিক্ষক[\s-]*সভা/u, why: 'bookish; parents say প্যারেন্ট টিচার মিটিং' },
        { pattern: word('সভা'), why: 'bookish; parents say মিটিং' },
        { pattern: /বার্তা/u, why: 'bookish; parents say মেসেজ' },
        { pattern: /ক্রীড়া|প্রতিযোগিতা/u, why: '"বার্ষিক ক্রীড়া প্রতিযোগিতা" is bookish; parents say স্পোর্টস ডে' },
        { pattern: /সাদর|আমন্ত্রণ/u, why: '"সাদর আমন্ত্রণ জানাই" is bookish' },
        { pattern: word('সপরিবারে'), why: 'bookish; "বাড়ির সবাইকে নিয়ে"' },
        { pattern: /কর্মশালা/u, why: 'bookish; parents say ওয়ার্কশপ' },
        { pattern: /আপনার সঙ্গে দেখা হলে/u, why: 'translated; "আপনি এলে আমরা খুব খুশি হব"' },
        { pattern: word('স্থানীয়'), why: 'bookish; "এলাকার"' },
        { pattern: INDIC_HYPHEN, why: 'no hyphen-suffix after a letter ("বি-র"): "বি সেকশনের"' },
        { pattern: bareKeypad('Bengali', 'টিপুন'), why: 'a bare number before টিপুন ("নয় টিপুন" also means "is not"): "নয় নম্বর টিপুন"' },
        { pattern: word('পানি|দাওয়াত|গোসল'), why: 'Bangladeshi usage, not Siliguri Bengali (জল, নেমন্তন্ন, স্নান)' },
        { pattern: word('তুমি|তুই|তোমার|তোর'), why: 'honorific forms only (আপনি)' },
    ],
    Hindi: [
        { pattern: /कक्षा/u, why: 'parents say क्लास ("क्लास सेवन बी")' },
        { pattern: /अभिभावक/u, why: 'parents say पेरेंट्स' },
        { pattern: /संदेश/u, why: 'parents say मैसेज' },
        { pattern: /ठीक न बैठे/u, why: 'translated ("अगर यह समय ठीक न बैठे")' },
        { pattern: /प्रशिक्षण/u, why: '"अभिभावक प्रशिक्षण कार्यक्रम" is bookish; पेरेंट्स वर्कशॉप' },
        { pattern: /सादर|आमंत्रित|सपरिवार/u, why: '"सपरिवार सादर आमंत्रित" is bookish' },
        { pattern: /भूस्खलन/u, why: 'bookish; parents say लैंडस्लाइड' },
        { pattern: /आपात|स्थानीय/u, why: '"स्थानीय आपात स्थिति" is bookish; "इलाक़े में इमरजेंसी"' },
        { pattern: word('संभव'), why: 'bookish ("अगर आना संभव न हो")' },
        { pattern: /वार्षिक/u, why: 'bookish; parents say एनुअल डे' },
        { pattern: /दिन शुभ/u, why: 'translated "have a good day"' },
        { pattern: INDIC_HYPHEN, why: 'no hyphenated compounds ("पैरेंट-टीचर"): "पेरेंट टीचर मीटिंग"' },
        { pattern: word('तुम|तू|तुम्हें|तुम्हारा|तुम्हारी|तेरा|तेरी'), why: 'honorific forms only (आप)' },
    ],
    English: [
        { pattern: /half past|quarter (?:past|to)/i, why: 'British; Indian English says "ten thirty"' },
        { pattern: /Class \w+, section/i, why: 'parents say "Class Seven B"' },
    ],
    Nepali: [
        { pattern: /स्कूल/u, why: 'Nepali spelling is स्कुल (short u), always' },
        { pattern: /कक्षा/u, why: 'parents say क्लास ("क्लास सेभेन")' },
        { pattern: /शिक्षक/u, why: 'parents say टिचर ("क्लास टिचर")' },
        { pattern: /खुसी हुनेछौं/u, why: 'translated ("तपाईंलाई भेट्न पाए हामी खुसी हुनेछौं")' },
        { pattern: /स्थानीय|आपतकालीन/u, why: '"स्थानीय आपतकालीन अवस्था" is bookish; "इलाकाको इमर्जेन्सी"' },
        { pattern: /हार्दिक|निमन्त्रणा/u, why: '"हार्दिक निमन्त्रणा" is bookish' },
        { pattern: /कार्यशाला/u, why: 'bookish; parents say वर्कसप' },
        { pattern: word('दिवस'), why: '"खेलकुद दिवस" is bookish; parents say स्पोर्ट्स डे' },
        { pattern: /वार्षिक/u, why: 'bookish; parents say एनुअल डे' },
        { pattern: INDIC_HYPHEN, why: 'no hyphenated compounds ("प्यारेन्ट-टिचर"): "प्यारेन्ट टिचर मिटिङ"' },
        { pattern: bareKeypad('Nepali', 'थिच्नुहोस्'), why: 'keypad keys take नम्बर: "एक नम्बर थिच्नुहोस्"' },
        { pattern: word('तिमी|तँ|तिम्रो|तेरो'), why: 'honorific forms only (तपाईं)' },
    ],
};

const RETIRED: Readonly<Record<ParentLanguage, readonly RetiredForm[]>> = Object.fromEntries(
    PARENT_LANGUAGES.map((l) => [l, RETIRED_SOURCE[l].map((r) => ({ ...r, pattern: nfc(r.pattern) }))]),
) as Record<ParentLanguage, readonly RetiredForm[]>;

/** Every string of a call-script file except `_meta`, keyed by its JSON path. */
function scriptStrings(file: CallScriptFile): [string, string][] {
    const out: [string, string][] = [];
    const walk = (path: string, value: unknown) => {
        if (typeof value === 'string') out.push([path, value]);
        else if (Array.isArray(value)) value.forEach((v, i) => walk(`${path}[${i}]`, v));
        else if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(path ? `${path}.${k}` : k, v);
        }
    };
    const { _meta: _ignored, ...spoken } = file;
    walk('', spoken);
    return out;
}

function retiredFormsIn(text: string, language: ParentLanguage): string[] {
    return RETIRED[language].filter((r) => r.pattern.test(text.normalize('NFC'))).map((r) => r.why);
}

describe('Class gate — spoken register: no retired bookish or translated form', () => {
    it('no string in any call-script file (lexicon, names, clips) contains a retired form', () => {
        const hits: unknown[] = [];
        for (const language of PARENT_LANGUAGES) {
            for (const [path, text] of scriptStrings(callScripts(language))) {
                const found = retiredFormsIn(text, language);
                if (found.length) hits.push({ language, path, text, found });
            }
        }
        expect(hits).toEqual([]);
    });

    it('no rendered clip in the fact matrix contains a retired form', () => {
        const hits: unknown[] = [];
        let clips = 0;
        for (const c of renderMatrix()) {
            for (const language of PARENT_LANGUAGES) {
                for (const clip of renderNoticeScript({ ...c, school: MATRIX_SCHOOL, language }).clips) {
                    clips++;
                    const found = retiredFormsIn(clip.text, language);
                    if (found.length) hits.push({ language, case: c.label, kind: clip.kind, text: clip.text, found });
                }
            }
        }
        expect(clips).toBeGreaterThan(100);
        expect(hits).toEqual([]);
    });

    it('the English time speller never says "half past" or "quarter", for any hour a notice may name', () => {
        let said = 0;
        for (let hour = 0; hour < 24; hour++) {
            for (const minute of [0, 30] as const) {
                let text: string;
                try {
                    text = formatTime({ hour, minute }, 'English');
                } catch (e) {
                    expect(e).toBeInstanceOf(ScriptRenderError); // outside the school day: refused, never guessed
                    continue;
                }
                said++;
                expect({ hour, minute, text, found: retiredFormsIn(text, 'English') }).toEqual({ hour, minute, text, found: [] });
                if (minute === 30) expect(text).toMatch(/ thirty /);
            }
        }
        expect(said).toBeGreaterThan(20);
    });
});

describe('Class gate — keypad digits are said with নম্বর / नम्बर', () => {
    const cases: [ParentLanguage, string, string][] = [
        ['Bengali', 'টিপুন', 'নম্বর'],
        ['Nepali', 'थिच्नुहोस्', 'नम्बर'],
    ];

    it.each(cases)('every %s keypad instruction is "<number word> <নম্বর/नम्बर> %s"', (language, rawVerb, rawNumberWord) => {
        const verb = rawVerb.normalize('NFC');
        const numberWord = rawNumberWord.normalize('NFC');
        const digitWords = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => callScripts(language).lexicon.numbers[d]));
        const texts: [string, string][] = [
            ...scriptStrings(callScripts(language)),
            ...renderMatrix().map((c): [string, string] => [c.label, renderNoticeScript({ ...c, school: MATRIX_SCHOOL, language }).clips[0].text]),
        ];
        const instructions: unknown[] = [];
        const bad: unknown[] = [];
        for (const [path, text] of texts) {
            const words = text.normalize('NFC').split(/[\s,।.!?]+/u).filter(Boolean);
            words.forEach((w, i) => {
                if (w !== verb) return;
                instructions.push(path);
                const ok = words[i - 1] === numberWord && digitWords.has(words[i - 2]);
                if (!ok) bad.push({ path, said: words.slice(Math.max(0, i - 2), i + 1).join(' '), text });
            });
        }
        expect(instructions.length).toBeGreaterThan(10);
        expect(bad).toEqual([]);
    });
});

describe('Class gate — the Hindi message stays short', () => {
    it('the Hindi PTM message + menu for the 7 Oct test-call facts (Thursday, 10:30) is at most 28 s by estimate (was 34 s; 32.5 s measured)', () => {
        const r = renderNoticeScript({
            purpose: 'ptm_invite',
            facts: { ...SAMPLE_PTM, date: '2026-10-08', time: { hour: 10, minute: 30 } },
            school: SAMPLE_SCHOOL,
            audience: SAMPLE_SECTION_AUDIENCE,
            language: 'Hindi',
            variant: 'default',
        });
        expect(r.estimatedSeconds).toBeLessThanOrEqual(28);
        expect(estimateSeconds(r.clips[0].text, 'Hindi')).toBe(r.estimatedSeconds);
    });
});

describe('NEGATIVE CONTROLS: the detectors catch the wording they retired', () => {
    // The scripts as rendered on the 7 Oct 2026 test call (qa/sampark-voice-eval/manifest.json, text_variant "current").
    const OLD: Record<ParentLanguage, string> = {
        Bengali:
            'নমস্কার! এটা হিলভিউ ডেমো স্কুল থেকে ক্লাস সেভেন, সেকশন বি-র অভিভাবকদের জন্য একটা রেকর্ড করা বার্তা। অভিভাবক-শিক্ষক সভা হবে বৃহস্পতিবার, আটই অক্টোবর, সকাল সাড়ে দশটায়, স্কুলের হলে। আপনার সঙ্গে দেখা হলে আমরা খুব খুশি হব। আপনি আসতে পারলে এক টিপুন। এই সময়টা অসুবিধার হলে দুই টিপুন। আর এই ধরনের কল না চাইলে নয় টিপুন।',
        Hindi:
            'नमस्ते! यह हिलव्यू डेमो स्कूल की ओर से कक्षा सात, सेक्शन बी के अभिभावकों के लिए एक रिकॉर्ड किया हुआ संदेश है। पैरेंट-टीचर मीटिंग गुरुवार, आठ अक्टूबर को सुबह साढ़े दस बजे स्कूल हॉल में होगी, और हमें आपसे मिलकर बहुत ख़ुशी होगी। अगर आप आ सकें, तो कृपया एक दबाएँ। अगर यह समय ठीक न बैठे, तो दो दबाएँ। और अगर ऐसी कॉल आपको नहीं चाहिए, तो नौ दबाएँ।',
        English:
            "Namaste! This is a recorded message from Hillview Demo School for parents of Class seven, section B. The parent-teacher meeting is on Thursday, 8 October, at half past ten in the morning, in the school hall, and we'd love to see you.",
        Nepali:
            'नमस्ते, यो हिलभ्यू डेमो स्कूलबाट कक्षा सात, सेक्सन बी का अभिभावकहरूका लागि रेकर्ड गरिएको सूचना हो। प्यारेन्ट-टिचर मिटिङ बिहीबार, आठ अक्टोबर, बिहान साढे दस बजे स्कुलको हलमा हुन्छ, तपाईंलाई भेट्न पाए हामी खुसी हुनेछौं। आउन सक्नुहुन्छ भने एक थिच्नुहोस्। यो समय मिल्दैन भने दुई थिच्नुहोस्। यस्ता कल नचाहिए नौ थिच्नुहोस्।',
    };

    it.each(PARENT_LANGUAGES)('the old %s PTM message is flagged', (language) => {
        expect(retiredFormsIn(OLD[language], language).length).toBeGreaterThanOrEqual(2);
    });

    it('each retired Bengali form is caught on its own, including the ambiguous bare নয়', () => {
        expect(retiredFormsIn('আর এই ধরনের কল না চাইলে নয় টিপুন।', 'Bengali')).toHaveLength(1);
        expect(retiredFormsIn('আর এরকম কল না চাইলে নয় নম্বর টিপুন।', 'Bengali')).toEqual([]);
        expect(retiredFormsIn('ক্লাস সেভেন, সেকশন বি-র অভিভাবকদের', 'Bengali')).toHaveLength(1);
        expect(retiredFormsIn('ক্লাস সেভেন, বি সেকশনের অভিভাবকদের', 'Bengali')).toEqual([]);
        expect(retiredFormsIn('স্কুলের বার্ষিক ক্রীড়া প্রতিযোগিতা হবে', 'Bengali')).toHaveLength(1);
        expect(retiredFormsIn('সপরিবারে আপনাকে সাদর আমন্ত্রণ জানাই।', 'Bengali')).toHaveLength(2);
        expect(retiredFormsIn('এক গ্লাস পানি', 'Bengali')).toHaveLength(1);
        // Whole words only: সভা inside another word is not the retired noun.
        expect(retiredFormsIn('সভাপতি', 'Bengali')).toEqual([]);
    });

    it('each retired Nepali form is caught on its own', () => {
        expect(retiredFormsIn('स्कूलको हलमा', 'Nepali')).toHaveLength(1);
        expect(retiredFormsIn('स्कुलको हलमा', 'Nepali')).toEqual([]);
        expect(retiredFormsIn('स्थानीय आपतकालीन अवस्था', 'Nepali')).toHaveLength(1);
        expect(retiredFormsIn('नौ थिच्नुहोस्', 'Nepali')).toHaveLength(1);
        expect(retiredFormsIn('नौ नम्बर थिच्नुहोस्', 'Nepali')).toEqual([]);
        expect(retiredFormsIn('तिमी आऊ', 'Nepali')).toHaveLength(1);
    });

    it('each retired Hindi and English form is caught on its own', () => {
        expect(retiredFormsIn('अगर यह समय ठीक न बैठे, तो दो दबाएँ।', 'Hindi')).toHaveLength(1);
        expect(retiredFormsIn('अभिभावक प्रशिक्षण कार्यक्रम', 'Hindi')).toHaveLength(2);
        expect(retiredFormsIn('तुम आ जाना', 'Hindi')).toHaveLength(1);
        expect(retiredFormsIn('at half past ten', 'English')).toHaveLength(1);
        expect(retiredFormsIn('at ten thirty in the morning', 'English')).toEqual([]);
        expect(retiredFormsIn('Class Seven B', 'English')).toEqual([]);
    });
});
