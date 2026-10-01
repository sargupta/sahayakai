/**
 * Helpers for the template-parity class gate (gate 6).
 *
 * Plan §13 gate 6: every template exists in all four languages with identical
 * slots, no unfilled placeholder, and no Latin abbreviation inside an Indic
 * template. Plan §4⑥: letters and numbers are written as spoken words, so an
 * ASCII letter or digit in rendered Hindi/Bengali/Nepali text means a fact
 * bypassed the lexicon. These helpers are pure so the gate test, the console
 * preview and the verify-voice script can all use them.
 */

import type { MenuSpec } from '@/lib/sampark/catalogue';
import type { ParentLanguage } from '@/types/sampark';

import { callScripts, type CallScriptFile } from './templates';

/** Sorted, de-duplicated `{placeholder}` names in a template string. */
export function placeholdersIn(template: string): string[] {
    return [...new Set([...template.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]))].sort();
}

/**
 * Every spoken template string of a file (purposes and common clips), keyed by
 * its path, e.g. "purposes.emergency_closure.message.today". Lexicon and names
 * are fragments, not sentences, and are excluded.
 */
export function templateLeaves(file: CallScriptFile): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (prefix: string, value: unknown) => {
        if (typeof value === 'string') out.set(prefix, value);
        else if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(prefix ? `${prefix}.${k}` : k, v);
        }
    };
    walk('purposes', file.purposes);
    walk('common', file.common);
    return out;
}

export function hasLatinLetters(text: string): boolean {
    return /[A-Za-z]/.test(text);
}

export function hasAsciiDigits(text: string): boolean {
    return /[0-9]/.test(text);
}

export function hasEmoji(text: string): boolean {
    return /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F]/u.test(text);
}

export function hasUnfilledPlaceholder(text: string): boolean {
    return /[{}]/.test(text);
}

/**
 * Keypad keys a menu offers: the key's numeral or its lexicon word, as a whole
 * word ("press 1", "एक दबाएँ", "দুই টিপুন", "नौ थिच्नुहोस्").
 */
export function menuKeysMentioned(menu: string, language: ParentLanguage): Set<string> {
    const numbers = callScripts(language).lexicon.numbers;
    const words = new Set(menu.normalize('NFC').split(/[\s,.;:!?\u0964]+/u).filter(Boolean));
    const keys = new Set<string>();
    for (const key of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        if (words.has(key) || words.has(numbers[key])) keys.add(key);
    }
    return keys;
}

/** The keys a catalogue MenuSpec says the menu must offer. */
export function expectedMenuKeys(menu: MenuSpec): Set<string> {
    const keys = new Set<string>();
    if (menu.key1) keys.add('1');
    if (menu.key2) keys.add('2');
    if (menu.optOut) keys.add('9');
    return keys;
}

export interface ParityProblem {
    path: string;
    language: ParentLanguage;
    problem: string;
}

/** Compare the template leaves of all languages against the first: same paths, same placeholder sets. */
export function templateParityProblems(languages: readonly ParentLanguage[]): ParityProblem[] {
    const problems: ParityProblem[] = [];
    const [reference, ...others] = languages;
    const refLeaves = templateLeaves(callScripts(reference));
    for (const language of others) {
        const leaves = templateLeaves(callScripts(language));
        for (const [path, text] of refLeaves) {
            const other = leaves.get(path);
            if (other === undefined) {
                problems.push({ path, language, problem: `missing (present in ${reference})` });
                continue;
            }
            const a = placeholdersIn(text).join(',');
            const b = placeholdersIn(other).join(',');
            if (a !== b) problems.push({ path, language, problem: `placeholders {${b}} differ from ${reference} {${a}}` });
        }
        for (const path of leaves.keys()) {
            if (!refLeaves.has(path)) problems.push({ path, language, problem: `extra (absent in ${reference})` });
        }
    }
    return problems;
}
