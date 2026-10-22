/**
 * Transcribe-back comparison (plan §4⑥).
 *
 * A rendered message is played to Chirp 2 and the transcript compared with the
 * text we asked for. Recognisers write numbers their own way ("बाह्र हजार पाँच
 * सय" comes back as "१२५००", "দশটায়" as "১০টায়", "ten" as "10"), so BOTH strings
 * are normalised first:
 *   NFC → lower-case → Devanagari/Bengali digits to ASCII → thousands commas
 *   dropped → punctuation (incl. । ॥) to spaces → a suffix glued to digits
 *   dropped ("10th", "১০ই", "১০টায়" → "10") → Devanagari nukta dropped and
 *   candrabindu folded to anusvara → number words from the language's lexicon
 *   (cardinals, date forms, clock words, class words, aliases, with
 *   hundred/thousand/lakh multipliers) to digits → section letters to Latin →
 *   spaces collapsed.
 * Similarity is 1 − Levenshtein / max length over code points, computed with
 * spaces removed (recognisers split and join words differently; spacing is not
 * what we are checking).
 */

import { callScripts } from '@/lib/sampark/scripts/templates';
import type { ParentLanguage } from '@/types/sampark';

/** A message clip must transcribe back at least this similar to its text. */
export const VERIFY_THRESHOLD = 0.85;

interface NumberLexicon {
    words: Map<string, number>;
    multipliers: Map<string, number>;
    letters: Map<string, string>;
}

const lexiconCache = new Map<ParentLanguage, NumberLexicon>();

/**
 * Chirp 2 sometimes writes bn-IN speech in Devanagari (seen on short clips that
 * open with "ধন্যবাদ", a word Hindi shares). The Bengali and Devanagari blocks
 * are ISCII-parallel (same letter at +0x80), so for Bengali a Devanagari
 * transcript is folded into Bengali script before comparing; व (U+0935) has no
 * Bengali slot and maps to ব (U+09AC), as Bengali writes it.
 */
function devanagariToBengali(s: string): string {
    return s.replace(/[\u0900-\u097F]/g, (ch) => {
        if (ch === '\u0935') return '\u09AC';
        if (ch === '\u0964' || ch === '\u0965') return ch; // dandas are shared
        return String.fromCodePoint(ch.codePointAt(0)! + 0x80);
    });
}

/** Case, joiners, nukta, candrabindu and (for Bengali) script folding — applied identically to texts and lexicon words. */
function foldWord(word: string, language: ParentLanguage): string {
    let s = word
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\u200C\u200D]/g, '')
        .replace(/\u093C/g, '')
        .replace(/\u0901/g, '\u0902');
    if (language === 'Bengali') s = devanagariToBengali(s).replace(/\u0981/g, '\u0982');
    return s.normalize('NFC');
}

function numberLexicon(language: ParentLanguage): NumberLexicon {
    const cached = lexiconCache.get(language);
    if (cached) return cached;
    const lex = callScripts(language).lexicon;
    const words = new Map<string, number>();
    const add = (table: Record<string, string>) => {
        for (const [n, w] of Object.entries(table)) {
            const v = Number(n);
            // Multi-word entries (English "twenty-one") are rebuilt from their parts by the run parser.
            if (!/[\s-]/.test(w) && !words.has(foldWord(w, language))) words.set(foldWord(w, language), v);
        }
    };
    add(lex.numbers);
    add(lex.dayOfMonth);
    add(lex.time.hourWords);
    add(lex.grade.gradeWords);
    for (const [w, v] of Object.entries(lex.numberAliases)) words.set(foldWord(w, language), v);
    const multipliers = new Map<string, number>();
    for (const [n, ws] of Object.entries(lex.multipliers)) for (const w of ws) multipliers.set(foldWord(w, language), Number(n));
    const letters = new Map<string, string>();
    for (const table of [lex.sectionLetters, lex.sectionLettersGenitive]) {
        for (const [latin, w] of Object.entries(table)) letters.set(foldWord(w, language), latin.toLowerCase());
    }
    const built = { words, multipliers, letters };
    lexiconCache.set(language, built);
    return built;
}

const DEVANAGARI_ZERO = 0x0966;
const BENGALI_ZERO = 0x09e6;

function asciiDigits(s: string): string {
    return s.replace(/[\u0966-\u096F\u09E6-\u09EF]/g, (d) => {
        const cp = d.codePointAt(0)!;
        return String(cp - (cp >= BENGALI_ZERO ? BENGALI_ZERO : DEVANAGARI_ZERO));
    });
}

/** Combine runs of number words ("twelve thousand five hundred", "बाह्र हजार पाँच सय") into digits. */
function numbersToDigits(tokens: string[], lex: NumberLexicon): string[] {
    const out: string[] = [];
    let total = 0;
    let current = 0;
    let inRun = false;
    let lastPlain: number | null = null;
    const flush = () => {
        if (inRun) out.push(String(total + current));
        total = 0;
        current = 0;
        inRun = false;
        lastPlain = null;
    };
    for (const token of tokens) {
        const asDigits = /^\d+$/.test(token) ? Number(token) : undefined;
        const n = asDigits ?? lex.words.get(token);
        const m = lex.multipliers.get(token);
        if (n !== undefined) {
            // "twenty one" joins; "one two" or "ten ten" are two separate numbers.
            if (inRun && lastPlain !== null && !(lastPlain >= 20 && lastPlain % 10 === 0 && n < 10)) flush();
            current += n;
            inRun = true;
            lastPlain = n;
        } else if (m !== undefined && inRun) {
            if (m >= 1000) {
                total += (current || 1) * m;
                current = 0;
            } else {
                current = (current || 1) * m;
            }
            lastPlain = null;
        } else {
            flush();
            out.push(lex.letters.get(token) ?? token);
        }
    }
    flush();
    return out;
}

/** Normalise a text (expected or transcript) for comparison. */
export function normaliseForCompare(text: string, language: ParentLanguage): string {
    let s = foldWord(String(text ?? ''), language);
    s = asciiDigits(s);
    s = s.replace(/(\d)[,\u066C](?=\d{2,3}\b)/g, '$1');
    s = s.replace(/[\p{P}\p{S}]/gu, ' ');
    s = s.replace(/(\d+)[\p{L}\p{M}]+/gu, '$1');
    const tokens = s.split(/\s+/).filter(Boolean);
    return numbersToDigits(tokens, numberLexicon(language)).join(' ').replace(/\s+/g, ' ').trim();
}

/** Levenshtein distance over two code-point arrays (two-row DP). */
export function levenshtein(a: readonly string[], b: readonly string[]): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    let curr = new Array<number>(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

/** 1 − Levenshtein / max length, on normalised text without spaces. 1 = identical. */
export function transcriptSimilarity(expected: string, transcript: string, language: ParentLanguage): number {
    const a = Array.from(normaliseForCompare(expected, language).replace(/ /g, ''));
    const b = Array.from(normaliseForCompare(transcript, language).replace(/ /g, ''));
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    return Math.round((1 - levenshtein(a, b) / max) * 1000) / 1000;
}
