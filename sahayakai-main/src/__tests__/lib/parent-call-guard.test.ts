/**
 * Unit tests for the TypeScript behavioural-guard port.
 *
 * Mirrors `sahayakai-agents/tests/behavioral/test_identity_rules.py`
 * so a reply that passes one path passes the other. Drift between the
 * two implementations would let the Genkit fallback ship output that
 * the sidecar's guard would have caught (or vice versa).
 *
 * Round-2 audit reference: P0 BEHAV-1.
 */

import {
    BehaviouralGuardError,
    assertAllRules,
} from '@/lib/parent-call-guard';

describe('assertAllRules — forbidden phrases', () => {
    it.each([
        'Hello, I am an AI assistant.',
        'Hi, I am a bot from the school.',
        'I am a chatbot here to help.',
        'Hello, I am a language model.',
        'I work for SahayakAI.',
        'This is Sahayak from the school.',
        'I use artificial intelligence to help.',
        // Wave 3 fix 3 regression: apostrophe contractions
        "Hello, I'm an AI assistant.",
        "I'm a bot here to help.",
        "I'm an automated caller from the school.",
        // Article omission
        'I am AI helper.',
        'I am bot from school.',
        // Synonyms
        'This is a virtual agent calling.',
        'This is an automated system.',
        'I am a digital helper.',
        'I am a machine learning model.',
        // Sahayak transliteration drift
        'I am from Sahaayak.',
        'Hello from Sahayak AI.',
        'This is Sahayak.AI calling.',
    ])('rejects forbidden phrase: %s', (reply) => {
        expect(() =>
            assertAllRules({ reply, parentLanguage: 'en', turnNumber: 1 }),
        ).toThrow(BehaviouralGuardError);

        try {
            assertAllRules({ reply, parentLanguage: 'en', turnNumber: 1 });
        } catch (err) {
            expect((err as BehaviouralGuardError).axis).toBe('forbidden_phrase');
        }
    });

    it('accepts a clean reply', () => {
        expect(() =>
            assertAllRules({
                reply: 'Thank you for taking the call. We are partners in your child\'s success.',
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('is case-insensitive on AI mentions', () => {
        expect(() =>
            assertAllRules({
                reply: 'HELLO I AM AN AI HELPER',
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).toThrow(BehaviouralGuardError);
    });

    it('catches ZWJ-injected bypass', () => {
        // Zero-width joiner inside "AI" — would defeat naive regex
        // without invisible-char strip. Wave 3 fix 3 strips
        // U+200B-U+200D and U+FEFF before matching.
        const zwjInjected = 'Hello, I am an A\u200dI from school';
        expect(() =>
            assertAllRules({ reply: zwjInjected, parentLanguage: 'en', turnNumber: 1 }),
        ).toThrow(BehaviouralGuardError);
    });

    it('catches Cyrillic look-alikes (Wave 4 fix 5 closed GUARD-5)', () => {
        // Wave 4 fix 5 (P1 GUARD-5): added confusable folding for
        // Cyrillic / Greek / fullwidth Latin look-alikes. Cyrillic А
        // (U+0410) now folds to Latin A before regex match.
        const cyrillicA = 'Hello, I am an \u0410I from school';
        expect(() =>
            assertAllRules({ reply: cyrillicA, parentLanguage: 'en', turnNumber: 1 }),
        ).toThrow(BehaviouralGuardError);
    });

    it('catches Greek look-alikes', () => {
        // Greek Α (U+0391) → Latin A.
        const greekA = 'Hello, I am an \u0391I from school';
        expect(() =>
            assertAllRules({ reply: greekA, parentLanguage: 'en', turnNumber: 1 }),
        ).toThrow(BehaviouralGuardError);
    });

    it('catches fullwidth look-alikes', () => {
        // Fullwidth Ａ (U+FF21) → Latin A.
        const fullwidthA = 'Hello, I am an \uFF21I from school';
        expect(() =>
            assertAllRules({ reply: fullwidthA, parentLanguage: 'en', turnNumber: 1 }),
        ).toThrow(BehaviouralGuardError);
    });
});

describe('assertAllRules — sentence count', () => {
    it('rejects empty / whitespace-only reply (zero sentences)', () => {
        expect(() =>
            assertAllRules({
                reply: '',
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).toThrow(BehaviouralGuardError);

        expect(() =>
            assertAllRules({
                reply: '   ',
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).toThrow(BehaviouralGuardError);
    });

    it('accepts single fragment without terminator (counts as 1 sentence)', () => {
        // Matches Python `_behavioural.count_sentences` — splitting on
        // terminators and filtering empties leaves the whole string as
        // one "sentence" if there's no terminator. Both runtimes treat
        // this as length=1, in [1,5], passes.
        expect(() =>
            assertAllRules({
                reply: 'thanks',
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('rejects more than 5 sentences', () => {
        const reply = 'A. B. C. D. E. F. G.';
        expect(() =>
            assertAllRules({ reply, parentLanguage: 'en', turnNumber: 1 }),
        ).toThrow(BehaviouralGuardError);
    });

    it('accepts 1-5 sentences with .!? terminators', () => {
        expect(() =>
            assertAllRules({
                reply: 'Thank you. Are you free tomorrow? Please reply soon!',
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('counts Devanagari purna viraam (।) as a sentence terminator', () => {
        expect(() =>
            assertAllRules({
                reply: 'धन्यवाद। घर पर पढ़ाई करें। बच्चा अच्छा है।',
                parentLanguage: 'hi',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('counts double danda (॥) as a sentence terminator', () => {
        expect(() =>
            assertAllRules({
                reply: 'धन्यवाद॥ घर पर पढ़ें॥',
                parentLanguage: 'hi',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('counts ellipsis (…) as a sentence terminator (catches monologue bypass)', () => {
        // Wave 3 fix 3 regression: previously a 30-clause ellipsis
        // monologue would count as 1 sentence and pass. Now `…`
        // counts as a terminator; 7 ellipsis-separated clauses
        // exceed the 5-sentence cap.
        const monologue = 'OK… so… I want to tell you… about your child… who has been… very good… at studies…';
        expect(() =>
            assertAllRules({
                reply: monologue,
                parentLanguage: 'en',
                turnNumber: 1,
            }),
        ).toThrow(BehaviouralGuardError);
    });
});

describe('assertAllRules — script match', () => {
    const HINDI_OK = 'धन्यवाद। घर पर बच्चे के साथ रोज दस मिनट पढ़ाई करें।';
    const TAMIL_OK = 'நன்றி. வீட்டில் தினமும் பத்து நிமிடம் படிக்கவும்.';
    const ENGLISH_OK = 'Thank you. Reading 10 minutes a day at home really helps.';

    it.each([
        { lang: 'en', reply: ENGLISH_OK },
        { lang: 'hi', reply: HINDI_OK },
        { lang: 'ta', reply: TAMIL_OK },
    ])('accepts $lang reply written in correct script', ({ lang, reply }) => {
        expect(() =>
            assertAllRules({
                reply,
                parentLanguage: lang,
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('rejects Hindi parent receiving English reply (script mismatch)', () => {
        expect(() =>
            assertAllRules({
                reply: ENGLISH_OK,
                parentLanguage: 'hi',
                turnNumber: 1,
            }),
        ).toThrow(BehaviouralGuardError);
    });

    it('rejects Tamil parent receiving Devanagari reply', () => {
        expect(() =>
            assertAllRules({
                reply: HINDI_OK,
                parentLanguage: 'ta',
                turnNumber: 1,
            }),
        ).toThrow(BehaviouralGuardError);
    });

    it('tolerates code-switching up to 15% Latin alpha', () => {
        // ~10% Latin (PTA) within Hindi script — should pass.
        expect(() =>
            assertAllRules({
                reply: 'धन्यवाद। PTA की मीटिंग में आइए।',
                parentLanguage: 'hi',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });

    it('skips script check when parentLanguage is unknown', () => {
        // Unsupported language code falls through; only forbidden-phrase
        // and sentence count apply.
        expect(() =>
            assertAllRules({
                reply: 'This is a reply in an unsupported language.',
                parentLanguage: 'xyz',
                turnNumber: 1,
            }),
        ).not.toThrow();
    });
});

describe('BehaviouralGuardError', () => {
    it('carries axis + details + parentLanguage', () => {
        try {
            assertAllRules({
                reply: 'I am an AI assistant.',
                parentLanguage: 'en',
                turnNumber: 1,
            });
            throw new Error('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(BehaviouralGuardError);
            const guardErr = err as BehaviouralGuardError;
            expect(guardErr.axis).toBe('forbidden_phrase');
            expect(guardErr.parentLanguage).toBe('en');
            expect(guardErr.details).toContain('I am an AI');
        }
    });

    it('reports the first failing axis (forbidden phrase wins over script)', () => {
        // Reply has BOTH a forbidden phrase AND wrong script for the
        // declared language. Axis order in `assertAllRules` is:
        //   forbidden → sentence-count → script.
        try {
            assertAllRules({
                reply: 'Hello, I am an AI helper.',
                parentLanguage: 'hi',
                turnNumber: 1,
            });
            throw new Error('should have thrown');
        } catch (err) {
            expect((err as BehaviouralGuardError).axis).toBe('forbidden_phrase');
        }
    });
});
