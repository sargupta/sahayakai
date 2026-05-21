/**
 * Tests for the VIDYA greeting suppressor.
 *
 * Coverage goals:
 *   1. No-op when prevHadModelTurn=false (first-turn greetings welcome).
 *   2. Strips a pure greeting sentence in English + every Indic language.
 *   3. Preserves substantive content that happens to start with a
 *      greeting token (the worst false-positive class — must never
 *      decapitate informative replies).
 *   4. Handles odd whitespace / mixed punctuation / no sentence end.
 *   5. Empty input is safe.
 */

import {
    stripRedundantGreeting,
    GREETING_TOKENS_FOR_TEST,
} from '../../lib/vidya-greeting-suppressor';

describe('stripRedundantGreeting', () => {
    describe('first-turn behaviour (no-op)', () => {
        it('returns input unchanged when prevHadModelTurn=false', () => {
            const reply = 'Namaste! How can I help you today?';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: false }))
                .toBe(reply);
        });

        it('does not strip even a pure greeting on first turn', () => {
            const reply = 'Hello.';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: false }))
                .toBe(reply);
        });
    });

    describe('mid-conversation: strips pure greeting sentence', () => {
        it('strips "Namaste!" + keeps the substantive sentence', () => {
            const out = stripRedundantGreeting(
                'Namaste! Here is your Class 7 lesson plan.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('Here is your Class 7 lesson plan.');
        });

        it('strips "Hello." + multi-sentence rest', () => {
            const out = stripRedundantGreeting(
                'Hello. The water cycle has four stages. Want a worksheet?',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('The water cycle has four stages. Want a worksheet?');
        });

        it('strips "Sure!" opener', () => {
            const out = stripRedundantGreeting(
                'Sure! Generating now.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('Generating now.');
        });

        it('strips "Of course!" (2 tokens — within the 4-token limit)', () => {
            const out = stripRedundantGreeting(
                'Of course! That is a great question.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('That is a great question.');
        });

        it('strips multi-word "Good morning."', () => {
            const out = stripRedundantGreeting(
                'Good morning. Today we will cover fractions.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('Today we will cover fractions.');
        });

        it('strips a Hindi (Devanagari) greeting + danda terminator', () => {
            const out = stripRedundantGreeting(
                'नमस्ते। पाठ योजना तैयार कर रहा हूँ।',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('पाठ योजना तैयार कर रहा हूँ।');
        });

        it('strips a Bengali greeting', () => {
            const out = stripRedundantGreeting(
                'নমস্কার! আপনার প্রশ্নের উত্তর এই।',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('আপনার প্রশ্নের উত্তর এই।');
        });

        it('strips a Tamil greeting', () => {
            const out = stripRedundantGreeting(
                'வணக்கம்! வகுப்பு 7 பாடத்திட்டம் தயார்.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('வகுப்பு 7 பாடத்திட்டம் தயார்.');
        });

        it('strips a Kannada greeting', () => {
            const out = stripRedundantGreeting(
                'ನಮಸ್ಕಾರ. ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರ ಇಲ್ಲಿದೆ.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರ ಇಲ್ಲಿದೆ.');
        });

        it('strips a Punjabi multi-word greeting "ਸਤ ਸ੍ਰੀ ਅਕਾਲ"', () => {
            const out = stripRedundantGreeting(
                'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਅੱਜ ਅਸੀਂ ਭਿੰਨ ਪੜ੍ਹਾਂਗੇ।',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('ਅੱਜ ਅਸੀਂ ਭਿੰਨ ਪੜ੍ਹਾਂਗੇ।');
        });
    });

    describe('preserves substantive content (anti-decapitation)', () => {
        it('does NOT strip "Sure, the answer is 42." — substantive sentence', () => {
            const reply = 'Sure, the answer is 42 and here is why.';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: true }))
                .toBe(reply);
        });

        it('does NOT strip a substantive sentence that starts with a greeting word', () => {
            const reply = 'Hello world is a classic first program.';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: true }))
                .toBe(reply);
        });

        it('does NOT strip an answer that begins with "Of course not, fractions are not whole numbers."', () => {
            const reply = 'Of course not, fractions are not whole numbers.';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: true }))
                .toBe(reply);
        });

        it('does NOT strip when sentence has >4 tokens after greeting', () => {
            // Even if it starts with "Sure", the whole first sentence is
            // substantive and must stay intact.
            const reply = 'Sure thing teacher, the water cycle starts with evaporation.';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: true }))
                .toBe(reply);
        });
    });

    describe('robustness', () => {
        it('empty string returns empty', () => {
            expect(stripRedundantGreeting('', { prevHadModelTurn: true })).toBe('');
        });

        it('whitespace-only returns unchanged', () => {
            expect(stripRedundantGreeting('   ', { prevHadModelTurn: true })).toBe('   ');
        });

        it('strips lowercase "namaste"', () => {
            const out = stripRedundantGreeting(
                'namaste. yeh raha aapka jawab.',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('yeh raha aapka jawab.');
        });

        it('strips single-word "Sure" with no sentence end', () => {
            const out = stripRedundantGreeting(
                'Sure',
                { prevHadModelTurn: true },
            );
            expect(out).toBe('');
        });

        it('handles double spaces / NBSP between greeting words', () => {
            // NBSP between "Good" and "morning" should still match.
            const reply = 'Good morning. Aaj ki class.';
            const out = stripRedundantGreeting(reply, { prevHadModelTurn: true });
            expect(out).toBe('Aaj ki class.');
        });

        it('returns input unchanged when no greeting and no sentence end', () => {
            const reply = 'evaporation';
            expect(stripRedundantGreeting(reply, { prevHadModelTurn: true }))
                .toBe(reply);
        });
    });

    describe('language coverage matrix', () => {
        it('table contains at least one token per supported language', () => {
            // Scripts present (heuristic): Latin, Devanagari, Bengali, Tamil,
            // Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Odia.
            const tokenString = GREETING_TOKENS_FOR_TEST.join(' ');
            expect(tokenString).toMatch(/[a-z]/i);              // Latin
            expect(tokenString).toMatch(/[ऀ-ॿ]/);     // Devanagari
            expect(tokenString).toMatch(/[ঀ-৿]/);     // Bengali
            expect(tokenString).toMatch(/[஀-௿]/);     // Tamil
            expect(tokenString).toMatch(/[ఀ-౿]/);     // Telugu
            expect(tokenString).toMatch(/[ಀ-೿]/);     // Kannada
            expect(tokenString).toMatch(/[ഀ-ൿ]/);     // Malayalam
            expect(tokenString).toMatch(/[઀-૿]/);     // Gujarati
            expect(tokenString).toMatch(/[਀-੿]/);     // Gurmukhi (Punjabi)
            expect(tokenString).toMatch(/[଀-୿]/);     // Odia
        });
    });
});
