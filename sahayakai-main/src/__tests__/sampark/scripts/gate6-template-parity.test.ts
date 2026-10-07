/**
 * @jest-environment node
 *
 * CLASS GATE 6 — template parity (plan §13).
 * Every available purpose has templates in all four languages with identical
 * clip kinds and identical slots; nothing renders with an unfilled `{…}`; no
 * Hindi/Bengali/Nepali text contains a Latin letter or an ASCII digit (letters
 * and numbers must be spoken words — the voice test heard "कक्षा ४ ए" as "four
 * amperes"); no emoji anywhere; every menu offers exactly the keys the
 * catalogue's MenuSpec says. Any new purpose marked `available` is covered
 * automatically, because the matrix iterates the catalogue.
 */

import { availablePurposes, purposeSpec } from '@/lib/sampark/catalogue';
import {
    expectedMenuKeys,
    hasAsciiDigits,
    hasEmoji,
    hasLatinLetters,
    hasUnfilledPlaceholder,
    menuKeysMentioned,
    placeholdersIn,
    templateLeaves,
    templateParityProblems,
} from '@/lib/sampark/scripts/parity';
import { renderNoticeScript } from '@/lib/sampark/scripts/render';
import { callScripts } from '@/lib/sampark/scripts/templates';
import { PARENT_LANGUAGES, type ParentLanguage } from '@/types/sampark';

import { MATRIX_SCHOOL, renderMatrix } from './matrix';

const INDIC: ParentLanguage[] = ['Hindi', 'Bengali', 'Nepali'];

describe('Gate 6 — call-script template parity', () => {
    it('every template file is a reviewed-draft file for its own language', () => {
        for (const language of PARENT_LANGUAGES) {
            const meta = callScripts(language)._meta;
            expect(meta.language).toBe(language);
            expect(meta.reviewStatus).toMatch(/needs native-speaker sign-off/);
        }
    });

    it('every available purpose has a template in every language', () => {
        for (const spec of availablePurposes()) {
            for (const language of PARENT_LANGUAGES) {
                expect(callScripts(language).purposes[spec.id]).toBeDefined();
            }
        }
    });

    it('all four languages have the same template paths with identical placeholder sets', () => {
        expect(templateParityProblems(PARENT_LANGUAGES)).toEqual([]);
    });

    it('menus offer exactly the keys in the catalogue MenuSpec (at most two action keys plus 9)', () => {
        for (const spec of availablePurposes()) {
            const expected = [...expectedMenuKeys(spec.menu!)].sort();
            expect(expected.filter((k) => k !== '9').length).toBeLessThanOrEqual(2);
            for (const language of PARENT_LANGUAGES) {
                const menu = callScripts(language).purposes[spec.id]!.menu;
                expect({ language, purpose: spec.id, keys: [...menuKeysMentioned(menu, language)].sort() }).toEqual({
                    language,
                    purpose: spec.id,
                    keys: expected,
                });
            }
        }
    });

    it('no raw Indic template contains Latin letters, ASCII digits or emoji', () => {
        for (const language of INDIC) {
            for (const [path, text] of templateLeaves(callScripts(language))) {
                const withoutSlots = text.replace(/\{[^{}]*\}/g, '');
                expect({ language, path, latin: hasLatinLetters(withoutSlots), digits: hasAsciiDigits(withoutSlots), emoji: hasEmoji(text) }).toEqual({
                    language,
                    path,
                    latin: false,
                    digits: false,
                    emoji: false,
                });
            }
        }
    });

    describe.each(renderMatrix())('$label', ({ purpose, variant, facts, audience }) => {
        const rendered = Object.fromEntries(
            PARENT_LANGUAGES.map((language) => [
                language,
                renderNoticeScript({ purpose, facts, school: MATRIX_SCHOOL, language, variant, audience }),
            ]),
        ) as Record<ParentLanguage, ReturnType<typeof renderNoticeScript>>;

        it('renders the same clip kinds in all four languages', () => {
            const kinds = PARENT_LANGUAGES.map((l) => rendered[l].clips.map((c) => c.kind).join(','));
            expect(new Set(kinds).size).toBe(1);
            const spec = purposeSpec(purpose);
            const kindList = rendered.English.clips.map((c) => c.kind);
            expect(kindList.includes('confirm_2')).toBe(spec.menu!.key2 !== null);
            expect(kindList[0]).toBe('message');
        });

        it('leaves no placeholder, no emoji, and no Latin letter or ASCII digit in Indic text', () => {
            for (const language of PARENT_LANGUAGES) {
                for (const clip of rendered[language].clips) {
                    expect(hasUnfilledPlaceholder(clip.text)).toBe(false);
                    expect(hasEmoji(clip.text)).toBe(false);
                    if (INDIC.includes(language)) {
                        expect({ language, kind: clip.kind, text: clip.text, latin: hasLatinLetters(clip.text), digits: hasAsciiDigits(clip.text) }).toEqual({
                            language,
                            kind: clip.kind,
                            text: clip.text,
                            latin: false,
                            digits: false,
                        });
                    }
                }
            }
        });

        it('fits the 60-second billing unit (message + menu within 38 s by estimate)', () => {
            for (const language of PARENT_LANGUAGES) {
                expect(rendered[language].estimatedSeconds).toBeLessThanOrEqual(38);
                expect(rendered[language].warnings.filter((w) => w.includes('38 s'))).toEqual([]);
            }
        });
    });

    describe('the detectors fail when the rule is broken', () => {
        it('placeholder, Latin, digit and emoji detectors fire', () => {
            expect(placeholdersIn('{a} x {b} {a}')).toEqual(['a', 'b']);
            expect(hasUnfilledPlaceholder('कक्षा {grade}')).toBe(true);
            expect(hasLatinLetters('कक्षा सात, सेक्शन B')).toBe(true);
            expect(hasLatinLetters('एसएमएस')).toBe(false);
            expect(hasAsciiDigits('कक्षा 7')).toBe(true);
            expect(hasEmoji('नमस्ते 🙏')).toBe(true);
        });

        it('a menu that offers an extra key is caught', () => {
            expect([...menuKeysMentioned('अगर आप आएँगे, तो एक दबाएँ। तीन दबाएँ।', 'Hindi')].sort()).toEqual(['1', '3']);
        });
    });
});
