/**
 * Letter → speech sanitizer for the parent-call voice pipeline.
 *
 * Regression tests for the 2026-08-11 call defect: the Twilio path spoke
 * the WRITTEN letter verbatim — "Dear Gauri's Parent/Guardian, … Sincerely,
 * Abhishek Gupta" — including salutation and sign-off.
 */

import { sanitizeLetterForSpeech, resolveSpokenMessage } from '@/lib/voice-pipeline/spoken-script';

// The exact letter shape produced for outreach 3OxUXljMnIvLLP67s2TW.
const ENGLISH_LETTER = `Dear Gauri's Parent/Guardian,

I hope this message finds you well. I'm Abhishek Gupta, Gauri's Mathematics teacher at KKSJVM.

We have noticed a recent decline in her performance. In her recent Mathematics Mid Term exam, she scored 14 out of 50.

We are confident that with a little extra support, Gauri can certainly improve.

Sincerely,
Abhishek Gupta`;

describe('sanitizeLetterForSpeech', () => {
    it('strips the English salutation line', () => {
        const out = sanitizeLetterForSpeech(ENGLISH_LETTER);
        expect(out).not.toMatch(/^Dear /);
        expect(out).toContain('I hope this message finds you well');
    });

    it('strips the sign-off block including the trailing name', () => {
        const out = sanitizeLetterForSpeech(ENGLISH_LETTER);
        expect(out).not.toMatch(/Sincerely/);
        expect(out).not.toMatch(/Abhishek Gupta\s*$/);
        expect(out).toContain('Gauri can certainly improve');
    });

    it('strips an inline sign-off ("Sincerely, Name" on one line)', () => {
        const text = 'The body of the message.\n\nSincerely, Abhishek Gupta';
        expect(sanitizeLetterForSpeech(text)).toBe('The body of the message.');
    });

    it('strips a Hindi salutation and sign-off', () => {
        const text = 'प्रिय अभिभावक,\n\nआपकी बेटी की पढ़ाई के बारे में बात करनी है।\n\nसादर,\nअभिषेक गुप्ता';
        const out = sanitizeLetterForSpeech(text);
        expect(out).toBe('आपकी बेटी की पढ़ाई के बारे में बात करनी है।');
    });

    it('strips a Bengali salutation and sign-off', () => {
        const text = 'প্রিয় অভিভাবক,\n\nআপনার সন্তানের উপস্থিতি নিয়ে কথা বলতে চাই।\n\nআন্তরিকভাবে,\nঅভিষেক গুপ্ত';
        const out = sanitizeLetterForSpeech(text);
        expect(out).toBe('আপনার সন্তানের উপস্থিতি নিয়ে কথা বলতে চাই।');
    });

    it('returns conversational text without letter artifacts unchanged', () => {
        const text = 'Namaste! I am calling from KKSJVM about Gauri. Her teacher wanted to share an update.';
        expect(sanitizeLetterForSpeech(text)).toBe(text);
    });

    it('never returns an empty string when stripping would eat everything', () => {
        const text = 'Dear Parent,';
        expect(sanitizeLetterForSpeech(text)).toBe('Dear Parent,');
    });

    it('handles empty input', () => {
        expect(sanitizeLetterForSpeech('')).toBe('');
    });
});

describe('resolveSpokenMessage', () => {
    it('prefers spokenScript when present', () => {
        const doc = { spokenScript: 'Spoken rendition.', generatedMessage: ENGLISH_LETTER };
        expect(resolveSpokenMessage(doc)).toBe('Spoken rendition.');
    });

    it('falls back to the sanitized letter when spokenScript is missing', () => {
        const out = resolveSpokenMessage({ generatedMessage: ENGLISH_LETTER });
        expect(out).not.toMatch(/^Dear /);
        expect(out).not.toMatch(/Sincerely/);
    });

    it('ignores a whitespace-only spokenScript', () => {
        const out = resolveSpokenMessage({ spokenScript: '   ', generatedMessage: ENGLISH_LETTER });
        expect(out).toContain('I hope this message finds you well');
    });

    it('handles non-string fields defensively', () => {
        expect(resolveSpokenMessage({ spokenScript: 42, generatedMessage: null })).toBe('');
    });
});
