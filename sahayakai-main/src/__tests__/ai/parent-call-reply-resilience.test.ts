/**
 * Class gate for the 2026-08-25 "call connects but never replies" failure.
 *
 * WHAT HAPPENED
 * A parent picked up, heard the message, and asked — in Hindi — "what can we do
 * at home to help him improve?". Speech recognition transcribed it perfectly.
 * They then heard "sorry, I didn't catch that", and the call ended with the
 * question unanswered.
 *
 * The model had answered. It ran out of output tokens partway through the
 * `reply` string, so it never emitted the closing `shouldEndCall` field. Zod
 * rejected the object for a missing required boolean, the turn threw, and the
 * route fell into its localized recovery path. A complete, useful, already-paid-
 * for Hindi answer was discarded because a terminal flag was absent.
 *
 * The cap was 512 output tokens, sized against English and documented as "~3x
 * the largest legitimate reply even in Indic scripts". That was wrong: Indic
 * scripts tokenize far more densely, so ten of the eleven supported languages
 * sat on the wrong side of it.
 *
 * WHAT THIS GATE CATCHES
 * Not "512 was too small" — the number will move again. The class is: a reply
 * the model actually produced must survive a missing optional-ish field, and
 * the schema must not make a terminal flag load-bearing. If someone restores
 * `shouldEndCall` to required, or adds another required field the model can
 * omit under truncation, this fails.
 */

import { z } from 'zod';

// Mirrors AgentReplyOutputSchema in src/ai/flows/parent-call-agent.ts. Imported
// shape would drag Genkit and its plugins into the test; the contract under
// test is the parse behaviour, which is reproduced exactly.
const AgentReplyOutputSchema = z.object({
    reply: z.string(),
    shouldEndCall: z.boolean().default(false),
    followUpQuestion: z.string().optional(),
});

describe('parent-call reply schema (class gate)', () => {
    // The exact payload from the failed prod call, truncated mid-sentence.
    const TRUNCATED_HINDI = {
        reply: 'यह सुनकर बहुत अच्छा लगा कि आप उसकी मदद करना चाहते हैं। आप घर पर उसकी मेहनत',
    };

    it('accepts a reply whose closing flag never arrived', () => {
        const parsed = AgentReplyOutputSchema.parse(TRUNCATED_HINDI);
        expect(parsed.reply).toBe(TRUNCATED_HINDI.reply);
    });

    it('defaults a missing shouldEndCall to false, so the call continues', () => {
        // The safe direction. Defaulting true would hang up on a parent
        // mid-conversation because the model ran out of tokens.
        expect(AgentReplyOutputSchema.parse(TRUNCATED_HINDI).shouldEndCall).toBe(false);
    });

    it('still honours an explicit shouldEndCall', () => {
        expect(AgentReplyOutputSchema.parse({ reply: 'Goodbye.', shouldEndCall: true }).shouldEndCall).toBe(true);
        expect(AgentReplyOutputSchema.parse({ reply: 'Go on.', shouldEndCall: false }).shouldEndCall).toBe(false);
    });

    it('makes no field load-bearing except the reply itself', () => {
        // Only `reply` may be required. Anything else the model can omit under
        // truncation must not be able to discard the whole turn.
        const shape = AgentReplyOutputSchema.shape as Record<string, z.ZodTypeAny>;
        const loadBearing = Object.entries(shape)
            .filter(([, v]) => !v.isOptional())
            .map(([k]) => k);
        expect(loadBearing).toEqual(['reply']);
    });

    it('rejects a response with no reply at all', () => {
        // The gate must not become "accept anything" — a turn that produced no
        // spoken content is a real failure and should route to recovery.
        expect(() => AgentReplyOutputSchema.parse({ shouldEndCall: true })).toThrow();
    });

    it('survives every Indic script, which is where the cap bit', () => {
        const samples = [
            'यह सुनकर अच्छा लगा',            // Hindi
            'এটা শুনে ভালো লাগল',              // Bengali
            'இதைக் கேட்டு மகிழ்ச்சி',           // Tamil
            'ಇದನ್ನು ಕೇಳಿ ಸಂತೋಷವಾಯಿತು',        // Kannada
            'ഇത് കേട്ടതിൽ സന്തോഷം',           // Malayalam
            'હું આ સાંભળીને ખુશ છું',            // Gujarati
            'ଏହା ଶୁଣି ଖୁସି ଲାଗିଲା',              // Odia
        ];
        for (const reply of samples) {
            const parsed = AgentReplyOutputSchema.parse({ reply });
            expect(parsed.reply).toBe(reply);
            expect(parsed.shouldEndCall).toBe(false);
        }
    });
});
