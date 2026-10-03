/**
 * Child-specific call-script templates — loader and shape (slice 2, plan §2A, §2C, §5).
 *
 * These live beside the class-wide notice templates in
 * `src/locales/call-scripts/child-{english,hindi,bengali,nepali}.json` and are
 * kept in their own files and loader so the slice-1 template shape, renderer
 * and gates are untouched. Every purpose here is CHILD-specific, so every call
 * opens with the LISTENER CHECK (plan §1 principle 2): a clip that names the
 * child and nothing else. Everything specific is in `message`, played only
 * after the parent presses 1.
 *
 * Validated with Zod on first import (a malformed file fails loudly at startup
 * and in the class-gate tests) and NFC-normalised, like the slice-1 files.
 */

import { z } from 'zod';

import childBengali from '@/locales/call-scripts/child-bengali.json';
import childEnglish from '@/locales/call-scripts/child-english.json';
import childHindi from '@/locales/call-scripts/child-hindi.json';
import childNepali from '@/locales/call-scripts/child-nepali.json';
import { PARENT_LANGUAGES, type ParentLanguage, type PurposeId } from '@/types/sampark';

/** The purposes that have child-specific templates. */
export const CHILD_PURPOSES = ['attendance_talk', 'academic_talk', 'conduct_talk', 'recognition', 'absence_today', 'fee_due', 'fee_overdue'] as const;
export type ChildPurposeId = (typeof CHILD_PURPOSES)[number];

export function isChildPurpose(p: PurposeId | string): p is ChildPurposeId {
    return (CHILD_PURPOSES as readonly string[]).includes(p);
}

const text = z.string().min(1);

const childPurposeTemplate = z
    .object({
        /** Played first. May contain ONLY {schoolName} and {childName} (class gate 9). */
        listenerCheck: text,
        /** Played after key 1 on the listener check. The facts of the call are here, never earlier. */
        message: text,
        menu: text,
        confirm_1: text.optional(),
        confirm_2: text.optional(),
    })
    .strict();

const childFileSchema = z
    .object({
        _meta: z
            .object({ language: z.enum(PARENT_LANGUAGES), reviewStatus: text, reviewedBy: z.string().nullable(), notes: z.array(text) })
            .strict(),
        amount: z.object({ pattern: text, lakh: text, thousand: text, hundred: text }).strict(),
        purposes: z.record(z.string(), childPurposeTemplate),
        common: z.object({ listener_no_input: text }).strict(),
    })
    .strict();

export type ChildScriptFile = z.infer<typeof childFileSchema>;
export type ChildPurposeTemplate = z.infer<typeof childPurposeTemplate>;

function nfcDeep<T>(value: T): T {
    if (typeof value === 'string') return value.normalize('NFC') as T;
    if (Array.isArray(value)) return value.map((v) => nfcDeep(v)) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k.normalize('NFC'), nfcDeep(v)])) as T;
    }
    return value;
}

function load(language: ParentLanguage, raw: unknown): ChildScriptFile {
    const parsed = childFileSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`call-scripts/child-${language}: invalid template file at ${issue.path.join('.')}: ${issue.message}`);
    }
    if (parsed.data._meta.language !== language) throw new Error(`call-scripts/child-${language}: _meta.language is ${parsed.data._meta.language}`);
    return Object.freeze(nfcDeep(parsed.data));
}

const FILES: Readonly<Record<ParentLanguage, ChildScriptFile>> = Object.freeze({
    English: load('English', childEnglish),
    Hindi: load('Hindi', childHindi),
    Bengali: load('Bengali', childBengali),
    Nepali: load('Nepali', childNepali),
});

export function childScripts(language: ParentLanguage): ChildScriptFile {
    const file = FILES[language];
    if (!file) throw new Error(`No child call-script templates for language: ${String(language)}`);
    return file;
}
