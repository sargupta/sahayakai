/**
 * Deterministic spoken forms — facts become words, from each language's
 * reviewed lexicon, never from a model.
 *
 * Plan §4⑥: the voice test heard "कक्षा ४ ए" read as "four amperes" and "SMS"
 * silently skipped, so nothing reaches TTS as a numeral or an abbreviation in
 * an Indic language: dates, times, classes and sections are all rendered here
 * as words ("शनिबार, दस अक्टोबर", "बिहान दस बजे", "ক্লাস সেভেন, বি সেকশন").
 *
 * Register (VOICE_PHASE_CONTRACT §C): the words are the ones a school office
 * says to parents on the phone, not translated office language — "Class Seven
 * B", "क्लास सेवन बी", "ten thirty in the morning" (never the British "half
 * past ten"). Every purpose takes its class, date and time from here, so a
 * register fix lands in every message at once.
 *
 * Every function throws ScriptRenderError for a fact it cannot say (an
 * impossible date, a minute that is not 0 or 30, an hour outside the day
 * periods, an unknown section letter or venue) — the renderer refuses rather
 * than guessing.
 */

import type { ParentLanguage, SchoolVenue, SpokenTime } from '@/types/sampark';

import { callScripts } from './templates';
import { ScriptRenderError, type AudienceLabel } from './types';

const PLACEHOLDER = /\{([A-Za-z]+)\}/g;

/** Replace `{name}` placeholders. Throws if the pattern names a value that was not supplied. */
export function fillPattern(pattern: string, values: Readonly<Record<string, string>>): string {
    return pattern.replace(PLACEHOLDER, (_, name: string) => {
        const v = values[name];
        if (v === undefined) throw new ScriptRenderError(`No value for {${name}} in "${pattern}"`);
        return v;
    });
}

/** Cardinal 0–60 as a word. */
export function numberWord(n: number, language: ParentLanguage): string {
    const w = callScripts(language).lexicon.numbers[String(n)];
    if (!Number.isInteger(n) || w === undefined) throw new ScriptRenderError(`${language} has no word for the number ${n}`);
    return w;
}

export interface CalendarDate {
    year: number;
    month: number; // 1–12
    day: number; // 1–31
    /** 0 = Sunday … 6 = Saturday. */
    weekday: number;
}

/** Parse a YYYY-MM-DD calendar date (no time zone: it is a school day, not an instant). */
export function parseCalendarDate(dateISO: string): CalendarDate {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO ?? '');
    if (!m) throw new ScriptRenderError(`Not a YYYY-MM-DD date: "${dateISO}"`);
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
        throw new ScriptRenderError(`Not a real calendar date: "${dateISO}"`);
    }
    return { year, month, day, weekday: d.getUTCDay() };
}

/** "Saturday, the tenth of October" · "शनिवार, दस अक्टूबर" · "শনিবার, দশই অক্টোবর" · "शनिबार, दस अक्टोबर". The year is never spoken. */
export function formatDate(dateISO: string, language: ParentLanguage): string {
    const { month, day, weekday } = parseCalendarDate(dateISO);
    const lex = callScripts(language).lexicon;
    const dayWord = lex.dayOfMonth[String(day)];
    if (!dayWord) throw new ScriptRenderError(`${language} has no date form for day ${day}`);
    return fillPattern(lex.dateFormat, { weekday: lex.weekdays[weekday], day: dayWord, month: lex.months[month - 1] });
}

/**
 * "ten o'clock in the morning", "ten thirty in the morning" · "सुबह साढ़े दस बजे" ·
 * "দুপুর দেড়টায়" · "दिउँसो अढाई बजे". Whole and half hours only; the words for
 * each come from the lexicon's time patterns.
 */
export function formatTime(time: SpokenTime, language: ParentLanguage): string {
    const hour = time?.hour;
    const minute = time?.minute as number;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new ScriptRenderError(`Hour out of range: ${String(hour)}`);
    if (minute !== 0 && minute !== 30) throw new ScriptRenderError(`Only whole and half hours can be said; got minute ${String(minute)}`);
    const t = callScripts(language).lexicon.time;
    const special = t.special[`${hour}:${minute === 0 ? '00' : '30'}`];
    if (special) return special;
    const period = callScripts(language).lexicon.dayPeriods.find((p) => hour >= p.fromHour && hour < p.toHour);
    if (!period) throw new ScriptRenderError(`${language}: no day period covers ${hour}:${minute === 0 ? '00' : '30'} — outside the hours a school notice may name`);
    const hour12 = ((hour + 11) % 12) + 1;
    const hourWord = t.hourWords[String(hour12)];
    if (!hourWord) throw new ScriptRenderError(`${language} has no clock word for ${hour12}`);
    const pattern = minute === 0 ? t.whole : (t.halfSpecial[String(hour12)] ?? t.half);
    return fillPattern(pattern, { period: period.word, hour: hourWord });
}

/**
 * The class as parents say it: "Class Seven B" · "क्लास सेवन बी" ·
 * "ক্লাস সেভেন, বি সেকশন" · "क्लास सेभेन, सेक्सन बी". The genitive uses the
 * lexicon's genitivePattern where the case falls on a noun ("ক্লাস সেভেন, বি
 * সেকশনের"), so no case suffix is ever hyphenated onto a letter.
 */
export function formatGrade(grade: number, section: string, language: ParentLanguage, opts: { genitive?: boolean } = {}): string {
    const lex = callScripts(language).lexicon;
    const gradeWord = Number.isInteger(grade) ? lex.grade.gradeWords[String(grade)] : undefined;
    if (!gradeWord) throw new ScriptRenderError(`${language} has no word for class ${String(grade)}`);
    const letter = String(section ?? '').trim().toUpperCase();
    const letters = opts.genitive ? lex.sectionLettersGenitive : lex.sectionLetters;
    const sectionWord = letters[letter];
    if (!sectionWord) throw new ScriptRenderError(`${language} cannot say section "${section}"`);
    const pattern = opts.genitive ? (lex.grade.genitivePattern ?? lex.grade.pattern) : lex.grade.pattern;
    return fillPattern(pattern, { grade: gradeWord, section: sectionWord });
}

/**
 * The audience phrase, already in the case the message template needs:
 * "the parents of Class Seven B" · "क्लास सेवन बी के पेरेंट्स" ·
 * "ক্লাস সেভেন, বি সেকশনের অভিভাবকদের" · "सबै प्यारेन्टहरू". Names no child, ever.
 */
export function formatAudience(label: AudienceLabel, language: ParentLanguage, schoolName: string): string {
    const audience = callScripts(language).names.audience;
    if (label.kind === 'school') return fillPattern(audience.school, { schoolName });
    return fillPattern(audience.section, {
        schoolName,
        class: formatGrade(label.grade, label.section, language),
        classGen: formatGrade(label.grade, label.section, language, { genitive: true }),
    });
}

// Bengali and Devanagari consonant letters (and the precomposed nukta letters).
const FINAL_CONSONANT = /[\u0995-\u09B9\u09CE\u09DC-\u09DF\u0915-\u0939\u0958-\u095F][\u09BC\u093C]?$/u;

/** Apply the language's locative suffix rule (Bengali: হল → হলে, মাঠ → মাঠে, লাইব্রেরি → লাইব্রেরিতে). */
export function locativeOf(noun: string, language: ParentLanguage): string {
    const rule = callScripts(language).lexicon.locative;
    if (!rule) throw new ScriptRenderError(`${language} has no locative rule`);
    return noun + (FINAL_CONSONANT.test(noun) ? rule.afterConsonant : rule.afterVowel);
}

/**
 * The venue as said after the time: "in the school hall" · "स्कूल हॉल में" ·
 * "স্কুলের হলে" · "स्कुलको हलमा". The school's own venues (reviewed names per
 * language) win over the defaults in the template file; an unknown id throws.
 */
export function formatVenue(venueId: string, venues: readonly SchoolVenue[] | undefined, language: ParentLanguage): string {
    const file = callScripts(language);
    const own = venues?.find((v) => v.id === venueId)?.names?.[language]?.trim();
    const name = own || file.names.venues[venueId];
    if (!name) throw new ScriptRenderError(`Unknown venue "${venueId}" for ${language}`);
    const phrase = file.lexicon.venuePhrase;
    return fillPattern(phrase, {
        venue: name,
        ...(phrase.includes('{venueLocative}') ? { venueLocative: locativeOf(name, language) } : {}),
    });
}
