/**
 * @jest-environment node
 *
 * CLASS GATE 7 — the per-sentence Nepali gate passes every Nepali template and
 * fails every Hindi one (plan §5, §13).
 *
 * Both languages are Devanagari, so this is the only thing standing between a
 * Nepali-speaking hill family and a Hindi notice. The negative control (every
 * Hindi sentence must FAIL) is what proves the gate has teeth.
 */

import { renderNoticeScript } from '@/lib/sampark/scripts/render';
import { templateLeaves } from '@/lib/sampark/scripts/parity';
import {
    checkNepaliFragment,
    checkNepaliSentence,
    checkNepaliText,
    maskSlots,
    splitSentences,
} from '@/lib/sampark/scripts/purity';
import { callScripts } from '@/lib/sampark/scripts/templates';

import { MATRIX_SCHOOL, renderMatrix } from './matrix';

describe('Gate 7 — Nepali purity (per sentence, whole words, slots masked)', () => {
    const nepali = callScripts('Nepali');
    const hindi = callScripts('Hindi');

    it('every Nepali template sentence passes', () => {
        const failures: unknown[] = [];
        for (const [path, text] of templateLeaves(nepali)) {
            const verdict = checkNepaliText(text);
            for (const s of verdict.sentences) if (!s.ok) failures.push({ path, ...s });
        }
        expect(failures).toEqual([]);
    });

    it('every Nepali name and lexicon fragment is free of Hindi-only words and Hindi-only characters', () => {
        const lex = nepali.lexicon;
        const fragments = [
            ...Object.values(nepali.names.eventTypes),
            ...Object.values(nepali.names.closureReasons),
            ...Object.values(nepali.names.venues),
            ...Object.values(nepali.names.audience),
            ...Object.values(lex.numbers),
            ...Object.values(lex.dayOfMonth),
            ...lex.weekdays,
            ...lex.months,
            ...lex.dayPeriods.map((p) => p.word),
            lex.time.whole,
            lex.time.half,
            ...Object.values(lex.time.halfSpecial),
            lex.grade.pattern,
            ...Object.values(lex.sectionLetters),
        ];
        const bad = fragments.map((f) => ({ f, ...checkNepaliFragment(f) })).filter((v) => !v.ok);
        expect(bad).toEqual([]);
    });

    it('every rendered Nepali clip in the fact matrix passes, sentence by sentence', () => {
        const failures: unknown[] = [];
        for (const c of renderMatrix()) {
            const script = renderNoticeScript({ ...c, school: MATRIX_SCHOOL, language: 'Nepali' });
            for (const clip of script.clips) {
                for (const s of checkNepaliText(clip.text).sentences) if (!s.ok) failures.push({ case: c.label, kind: clip.kind, ...s });
            }
        }
        expect(failures).toEqual([]);
    });

    it('NEGATIVE CONTROL: every Hindi template sentence fails', () => {
        const passedWrongly: unknown[] = [];
        let checked = 0;
        for (const [path, text] of templateLeaves(hindi)) {
            for (const sentence of splitSentences(text)) {
                // A slot-only sentence ("{buses}") carries no words of its own; its filler is a leaf checked here too.
                if (maskSlots(sentence).replace(/[◌\s]/g, '') === '') continue;
                checked++;
                const v = checkNepaliSentence(sentence);
                if (v.ok) passedWrongly.push({ path, sentence, markers: v.nepaliMarkers });
            }
        }
        expect(checked).toBeGreaterThan(30);
        expect(passedWrongly).toEqual([]);
    });

    it('NEGATIVE CONTROL: every rendered Hindi message fails as a whole text', () => {
        for (const c of renderMatrix()) {
            const script = renderNoticeScript({ ...c, school: MATRIX_SCHOOL, language: 'Hindi' });
            expect(checkNepaliText(script.clips[0].text).ok).toBe(false);
        }
    });

    describe('targeted cases (false positives the plan warned about)', () => {
        it('छ inside Hindi words (कुछ, अच्छा) is not a Nepali marker — whole words only', () => {
            const v = checkNepaliSentence('कुछ अच्छा लगा');
            expect(v.nepaliMarkers).toEqual([]);
            expect(v.ok).toBe(false);
            expect(v.reason).toBe('no_nepali_marker');
        });

        it('छ as a whole word is a Nepali marker', () => {
            expect(checkNepaliSentence('स्कूल बन्द छ').ok).toBe(true);
        });

        it('आपतकालीन is not flagged as the Hindi pronoun आप', () => {
            const v = checkNepaliSentence('स्थानीय आपतकालीन अवस्थाले गर्दा स्कूल बन्द रहनेछ');
            expect(v.hindiOnly).toEqual([]);
            expect(v.ok).toBe(true);
        });

        it('DECISION: colloquial "है" fails even in Nepali ("…आउनुहोस् है", "है त") — templates must not use the tag particle', () => {
            expect(checkNepaliSentence('भोलि स्कूलमा आउनुहोस् है').ok).toBe(false);
            expect(checkNepaliSentence('हुन्छ है त').hindiOnly).toContain('है');
        });

        it('a standalone को is not a marker; the suffix -को is, including after a masked slot', () => {
            expect(checkNepaliSentence('शनिवार को').nepaliMarkers).toEqual([]);
            expect(checkNepaliSentence('स्कूलको हल').nepaliMarkers).toContain('स्कूलको');
            expect(checkNepaliSentence(maskSlots('{schoolName}को सूचना')).ok).toBe(true);
        });

        it('any nukta or ॉ fails the sentence', () => {
            expect(checkNepaliSentence('ज़रूरी सूचना छ').reason).toBe('forbidden_char');
            expect(checkNepaliSentence('स्कूल हॉलमा हुन्छ').reason).toBe('forbidden_char');
            expect(checkNepaliSentence('ऑफिसमा सम्पर्क गर्नुहोस्').reason).toBe('forbidden_char');
        });

        it('a greeting alone has no marker, which is why Nepali templates join it with a comma', () => {
            expect(checkNepaliSentence('नमस्ते').ok).toBe(false);
            expect(checkNepaliSentence('नमस्ते, यो स्कूलबाट सूचना हो').ok).toBe(true);
        });

        it('Hindi future endings are caught even when the word is not listed', () => {
            expect(checkNepaliSentence('स्कूल बसें चलेंगी').hindiOnly).toContain('चलेंगी');
        });

        it('the plan draft Hindi sentences fail and the Nepali drafts pass', () => {
            expect(checkNepaliText('पैरेंट-टीचर मीटिंग शनिवार, दस अक्टूबर को सुबह दस बजे स्कूल हॉल में होगी।').ok).toBe(false);
            expect(checkNepaliText('प्यारेन्ट-टिचर मिटिङ शनिबार, दस अक्टोबर, बिहान दस बजे स्कूलको हलमा हुन्छ।').ok).toBe(true);
            expect(checkNepaliText('फी स्कूलको काउन्टर वा एपबाट मात्र तिर्नुहोस्, र कसैलाई पनि ओटीपी नभन्नुहोस्।').ok).toBe(true);
            expect(checkNepaliText('फ़ीस केवल स्कूल के काउंटर या ऐप से ही जमा करें।').ok).toBe(false);
        });
    });
});
