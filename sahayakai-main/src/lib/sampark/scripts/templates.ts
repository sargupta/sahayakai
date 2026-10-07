/**
 * Call-script templates — loader and shape.
 *
 * Plan §5 ("Words") and §4⑥. Every word a parent hears lives in
 * `src/locales/call-scripts/{english,hindi,bengali,nepali}.json`; the repo law
 * forbids inline multi-language dictionaries, so this module holds only the
 * SHAPE of those files and loads them. Facts come from typed campaign data and
 * are turned into words by `spoken.ts` from each file's `lexicon`.
 *
 * Each file is validated with Zod when this module is first imported, so a
 * malformed template fails loudly at startup (and in the class-gate tests),
 * never mid-render. Strings are NFC-normalised on load so content hashes and
 * the purity/parity gates see one canonical form.
 */

import { z } from 'zod';

import bengaliJson from '@/locales/call-scripts/bengali.json';
import englishJson from '@/locales/call-scripts/english.json';
import hindiJson from '@/locales/call-scripts/hindi.json';
import nepaliJson from '@/locales/call-scripts/nepali.json';
import { PARENT_LANGUAGES, type ParentLanguage } from '@/types/sampark';

const text = z.string().min(1);
const numberKeyed = z.record(z.string().regex(/^\d+$/), text);

const dayPeriodSchema = z.object({
    id: z.string().min(1),
    fromHour: z.number().int().min(0).max(24),
    toHour: z.number().int().min(0).max(24),
    word: text,
});

const lexiconSchema = z.object({
    /** 0–60 as spoken cardinal words. */
    numbers: numberKeyed,
    /** Extra spellings a recogniser may write back (verification only; never rendered). */
    numberAliases: z.record(z.string(), z.number().int().min(0)),
    /** Words for 100 / 1000 / 100000 (verification only). */
    multipliers: z.record(z.string().regex(/^\d+$/), z.array(text)),
    /** Sunday first. */
    weekdays: z.array(text).length(7),
    months: z.array(text).length(12),
    /** 1–31 as said inside a date ("দশই", "दस", "10"). */
    dayOfMonth: numberKeyed,
    dateFormat: text,
    dayPeriods: z.array(dayPeriodSchema).min(1),
    time: z.object({
        /** 1–12 as used in a clock time (Bengali: locative clock forms, e.g. দশটায়). */
        hourWords: numberKeyed,
        whole: text,
        half: text,
        /** 12-hour key → pattern for the half hours with their own word (1:30 डेढ़, 2:30 ढाई). */
        halfSpecial: z.record(z.string().regex(/^\d+$/), text),
        /** "H:MM" (24-hour) → complete phrase, overriding everything else (e.g. 12:00 "twelve noon"). */
        special: z.record(z.string().regex(/^\d{1,2}:\d{2}$/), text),
    }),
    grade: z
        .object({
            pattern: text,
            /**
             * The genitive class phrase, where the case falls on a noun rather than on the
             * section letter (Bengali "ক্লাস সেভেন, বি সেকশনের" — never a suffix hyphenated
             * onto the letter, "বি-র"). Filled with sectionLettersGenitive. Absent → `pattern`.
             */
            genitivePattern: text.optional(),
            gradeWords: numberKeyed,
        })
        .strict(),
    sectionLetters: z.record(z.string().regex(/^[A-Z]$/), text),
    sectionLettersGenitive: z.record(z.string().regex(/^[A-Z]$/), text),
    /** How a venue is said after the time: "in {venue}", "{venue} में", "{venue}मा", "{venueLocative}". */
    venuePhrase: text,
    /** Suffixes for `{venueLocative}` (Bengali): after a final consonant / after a final vowel. */
    locative: z.object({ afterConsonant: text, afterVowel: text }).nullable(),
});

const purposeTemplateSchema = z
    .object({
        /** A string, or per-variant strings (emergency_closure: today / tomorrow). */
        message: z.union([text, z.object({ today: text, tomorrow: text }).strict()]),
        /** Keypad menu, played right after the message inside the same gather. */
        menu: text,
        confirm_1: text.optional(),
        confirm_2: text.optional(),
        /** emergency_closure only: the bus sentence, chosen from facts.busesRunning. */
        buses: z.object({ running: text, notRunning: text }).strict().optional(),
    })
    .strict();

const callScriptFileSchema = z
    .object({
        _meta: z
            .object({
                language: z.enum(PARENT_LANGUAGES),
                bcp47: text,
                reviewStatus: text,
                reviewedBy: z.string().nullable(),
                /** Measured speaking rate for the renderer's duration estimate. */
                charsPerSecond: z.number().positive(),
                notes: z.array(text),
            })
            .strict(),
        lexicon: lexiconSchema.strict(),
        names: z
            .object({
                eventTypes: z
                    .object({ annual_day: text, sports_day: text, science_fair: text, cultural_programme: text, parent_workshop: text })
                    .strict(),
                closureReasons: z.object({ rain_landslide: text, heavy_rain: text, bandh: text, local_emergency: text }).strict(),
                /** Default venue names (a school's own venues override these by id). */
                venues: z.record(z.string(), text),
                audience: z.object({ section: text, school: text }).strict(),
            })
            .strict(),
        common: z
            .object({ opt_out_confirm: text, opt_out_done: text, no_input: text, fallback_office: text })
            .strict(),
        purposes: z.record(z.string(), purposeTemplateSchema),
    })
    .strict();

export type CallScriptFile = z.infer<typeof callScriptFileSchema>;
export type PurposeTemplate = z.infer<typeof purposeTemplateSchema>;
export type CommonClipKey = keyof CallScriptFile['common'];

function nfcDeep<T>(value: T): T {
    if (typeof value === 'string') return value.normalize('NFC') as T;
    if (Array.isArray(value)) return value.map((v) => nfcDeep(v)) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [k.normalize('NFC'), nfcDeep(v)]),
        ) as T;
    }
    return value;
}

function load(language: ParentLanguage, raw: unknown): CallScriptFile {
    const parsed = callScriptFileSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`call-scripts/${language}: invalid template file at ${issue.path.join('.')}: ${issue.message}`);
    }
    if (parsed.data._meta.language !== language) {
        throw new Error(`call-scripts/${language}: _meta.language is ${parsed.data._meta.language}`);
    }
    return Object.freeze(nfcDeep(parsed.data));
}

const FILES: Readonly<Record<ParentLanguage, CallScriptFile>> = Object.freeze({
    English: load('English', englishJson),
    Hindi: load('Hindi', hindiJson),
    Bengali: load('Bengali', bengaliJson),
    Nepali: load('Nepali', nepaliJson),
});

/** The reviewed template file for a parent language. */
export function callScripts(language: ParentLanguage): CallScriptFile {
    const file = FILES[language];
    if (!file) throw new Error(`No call-script templates for language: ${String(language)}`);
    return file;
}

/** The common clip kinds every notice call can play, in a stable order. */
export const COMMON_CLIP_KEYS: readonly CommonClipKey[] = ['opt_out_confirm', 'opt_out_done', 'no_input', 'fallback_office'];
