import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Server-side mirror of the client refusal-detection patterns. Kept inline
// (rather than re-imported from the client component) so this server flow
// has no client-only dependencies. Update both lists in lock-step.
const TRANSCRIPTION_REFUSAL_PATTERNS: RegExp[] = [
  /i am sorry,?\s+i\s+(cannot|can'?t)\s+(process|transcribe)\s+the\s+audio/i,
  /no audio input was provided/i,
  /please provide an audio input/i,
  /i\s+(cannot|can'?t)\s+hear\s+(any\s+|the\s+)?(speech|audio|voice)/i,
];

export function isLikelyTranscriptionRefusal(text: string): boolean {
  if (!text) return false;
  return TRANSCRIPTION_REFUSAL_PATTERNS.some((re) => re.test(text));
}

// Maps the app's 2-letter ISO to a readable language name + canonical script
// for the STT prompt. The Gemini model performs MUCH better when it knows
// which language and script to expect — auto-detect alone misclassifies
// Bengali/Tamil/Telugu/Kannada/Malayalam/Odia audio as English or Hindi for
// short or noisy clips.
const ISO_TO_LANG_HINT: Record<string, { name: string; script: string }> = {
  en: { name: 'English',   script: 'Latin' },
  hi: { name: 'Hindi',     script: 'Devanagari' },
  bn: { name: 'Bengali',   script: 'Bengali' },
  ta: { name: 'Tamil',     script: 'Tamil' },
  te: { name: 'Telugu',    script: 'Telugu' },
  kn: { name: 'Kannada',   script: 'Kannada' },
  mr: { name: 'Marathi',   script: 'Devanagari' },
  gu: { name: 'Gujarati',  script: 'Gujarati' },
  pa: { name: 'Punjabi',   script: 'Gurmukhi' },
  ml: { name: 'Malayalam', script: 'Malayalam' },
  or: { name: 'Odia',      script: 'Odia' },
};

// Unicode script ranges for each ISO language. Used by `scriptMatchesExpected`
// to detect when the model returned Latin-transliterated Indic text (a known
// Gemini failure mode for short / noisy / accented Bengali, Tamil, Telugu,
// Kannada, Malayalam, Odia, Gujarati, Punjabi, Marathi, and Hindi audio).
const ISO_TO_SCRIPT_RANGE: Record<string, { test: (cp: number) => boolean }> = {
  bn: { test: (c) => c >= 0x0980 && c <= 0x09ff },
  ta: { test: (c) => c >= 0x0b80 && c <= 0x0bff },
  te: { test: (c) => c >= 0x0c00 && c <= 0x0c7f },
  kn: { test: (c) => c >= 0x0c80 && c <= 0x0cff },
  ml: { test: (c) => c >= 0x0d00 && c <= 0x0d7f },
  or: { test: (c) => c >= 0x0b00 && c <= 0x0b7f },
  gu: { test: (c) => c >= 0x0a80 && c <= 0x0aff },
  pa: { test: (c) => c >= 0x0a00 && c <= 0x0a7f },
  hi: { test: (c) => c >= 0x0900 && c <= 0x097f },
  mr: { test: (c) => c >= 0x0900 && c <= 0x097f },
};

// Languages we'll force a retry on when output came back as pure Latin.
const RETRYABLE_INDIC = new Set(['bn', 'ta', 'te', 'kn', 'ml', 'or', 'gu', 'pa', 'hi', 'mr']);

function isLatin(cp: number): boolean {
  return (cp >= 0x0041 && cp <= 0x005a) || (cp >= 0x0061 && cp <= 0x007a);
}

/**
 * Returns true if the output text's script is consistent with the expected
 * language. Code-switching with English (Latin chars) is allowed — we only
 * fail when the expected lang is Indic AND there's a meaningful chunk of
 * non-Latin-eligible script characters AND none of them sit in the expected
 * Unicode range.
 *
 * Heuristic: count "letter-like" codepoints (skip whitespace, digits, punct).
 * If the expected language has a script range, require that >=30% of the
 * non-Latin letter chars fall in that range. If there are <=5 non-Latin
 * letter chars total, treat as English code-switching and pass.
 */
export function scriptMatchesExpected(text: string, isoLang: string | undefined): boolean {
  if (!isoLang) return true;
  const range = ISO_TO_SCRIPT_RANGE[isoLang];
  if (!range) return true; // English or unknown — nothing to validate
  if (!text) return true;

  let inExpected = 0;
  let nonLatinLetters = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // skip whitespace, digits, ASCII punct, common symbols
    if (cp < 0x0041) continue;
    if (isLatin(cp)) continue;
    // letter-ish — any non-Latin, non-ASCII codepoint
    nonLatinLetters++;
    if (range.test(cp)) inExpected++;
  }

  // Pure Latin or near-pure Latin output. If the user's UI lang is Indic but
  // they genuinely spoke English, we should NOT keep retrying. Treat <=5
  // non-Latin chars as "looks English" and pass.
  if (nonLatinLetters <= 5) return true;

  // Need at least 30% of non-Latin letters to be in the expected script.
  return inExpected / nonLatinLetters >= 0.3;
}

const VoiceToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "Audio data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  // 2026-12 Bengali STT investigation: cloud STT had no language hint, so
  // Gemini's auto-detect (biased toward English/Hindi) mis-transcribed
  // Bengali/Tamil/Telugu/Malayalam/Odia speech. Pass the user's app language
  // as a strong hint. Optional — old callers continue to auto-detect.
  expectedLanguage: z.string().optional().describe(
    '2-letter ISO of the user\'s app language (en, hi, bn, ta, te, kn, mr, gu, pa, ml, or). Strong hint to the model.'
  ),
});
export type VoiceToTextInput = z.infer<typeof VoiceToTextInputSchema>;

const VoiceToTextOutputSchema = z.object({
  text: z.string().describe('The clean, transcribed text from the audio input.'),
  language: z.string().optional().describe('The detected 2-letter language code (e.g. "en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "pa", "ml", "or").'),
});
export type VoiceToTextOutput = z.infer<typeof VoiceToTextOutputSchema>;

const voiceToTextPrompt = ai.definePrompt({
  name: 'voiceToTextPrompt',
  input: { schema: VoiceToTextInputSchema },
  output: { schema: VoiceToTextOutputSchema },
  prompt: `You are a multilingual speech-to-text engine optimized for Indian languages and English.

Your task is to transcribe the audio and detect its language.

{{#if forceScript}}
CRITICAL — RETRY ATTEMPT: Your previous attempt returned Latin transliteration. The audio is in **{{expectedLanguageName}}**. Output in **{{expectedLanguageScript}} script ONLY** — absolutely no romanization. If you cannot recognize the audio as {{expectedLanguageName}}, transcribe what you do hear but DO NOT romanize Indic phonemes.
{{else}}
{{#if expectedLanguageHint}}
PRIMARY LANGUAGE HINT (USE THIS):
The user's app is set to **{{expectedLanguageName}}** ({{expectedLanguageScript}} script). Transcribe in that language and script UNLESS the audio is clearly in a different language. Code-switching with English is allowed. NEVER output Latin transliteration of an Indic language — use the native script.
{{/if}}
{{/if}}

INSTRUCTIONS:
1. **Transcribe**: Listen to the audio and transcribe exactly what is said. Focus on the primary speaker's voice.
2. **Detect Language**: Handle English, Hindi, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi, Malayalam, or Odia. Output its 2-letter code (en, hi, ta, te, kn, bn, mr, gu, pa, ml, or).
3. **Cleanup (Implicit)**:
   - Remove filler words (uh, um, like, matlab, yani, etc.) UNLESS they are essential to meaning.
   - Fix stutters and repetitions.
   - Ensure grammatical correctness while preserving the speaker's original intent and tone.
   - Preserve code-switching (e.g., Hindi + English mixed).
4. **Formatting**: Ensure proper punctuation and capitalization.
5. **Noisy Environments**: Audio may contain background noise (classrooms, traffic, fans, crowds). Ignore background sounds and focus solely on the teacher's speech. If a word is unclear due to noise, infer from context rather than leaving a gap.
6. **Indic scripts**: Bengali, Tamil, Telugu, Kannada, Malayalam, Odia, Gujarati, Punjabi, Marathi all have distinct scripts. Always output in the native script — never romanize.

Audio Input: {{media url=audioDataUri}}

Output strictly valid JSON matching the schema.`,
});

function buildPromptInput(input: VoiceToTextInput, opts?: { forceScript?: boolean }) {
  const hint = input.expectedLanguage ? ISO_TO_LANG_HINT[input.expectedLanguage] : null;
  return {
    audioDataUri: input.audioDataUri,
    expectedLanguage: input.expectedLanguage,
    expectedLanguageHint: hint ? 'yes' : undefined,
    expectedLanguageName: hint?.name,
    expectedLanguageScript: hint?.script,
    forceScript: opts?.forceScript ? 'yes' : undefined,
  } as any;
}

/**
 * Returns true if we should retry: expected lang is a retryable Indic lang,
 * the model returned text, AND the script check failed.
 */
function shouldRetryForScript(text: string | undefined, expectedLanguage: string | undefined): boolean {
  if (!expectedLanguage) return false;
  if (!RETRYABLE_INDIC.has(expectedLanguage)) return false;
  if (!text) return false;
  return !scriptMatchesExpected(text, expectedLanguage);
}

export async function voiceToTextFormData(formData: FormData): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  const file = formData.get('audio') as File;
  if (!file) {
    throw new Error("No audio file provided in FormData");
  }

  // Optional language hint from the client (e.g. "bn", "ta") — set by the
  // microphone-input fallback before posting the FormData.
  const expectedLanguage = (formData.get('language') as string) || undefined;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // file.type can be empty on some browsers — fall back to webm which Gemini accepts
  const mimeType = file.type || 'audio/webm';
  const base64Audio = `data:${mimeType};base64,${buffer.toString('base64')}`;

  return runResiliently(async (config) => {
    const baseInput = { audioDataUri: base64Audio, expectedLanguage };
    let { output: transcription } = await voiceToTextPrompt(buildPromptInput(baseInput), config);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    if (isLikelyTranscriptionRefusal(transcription.text)) {
      throw new Error("Model returned a refusal instead of a transcript (empty/silent audio)");
    }

    // Script-validation retry (max 1). Catches Gemini's habit of romanizing
    // short / noisy / accented Indic audio even when given a language hint.
    if (shouldRetryForScript(transcription.text, expectedLanguage)) {
      console.info(
        `[voiceToText.formData] script_mismatch first_attempt expectedLanguage=${expectedLanguage} sample="${transcription.text.slice(0, 60)}" — retrying with forceScript`,
      );
      const retry = await voiceToTextPrompt(buildPromptInput(baseInput, { forceScript: true }), config);
      if (retry.output?.text && !isLikelyTranscriptionRefusal(retry.output.text)) {
        transcription = retry.output;
      }
      if (!scriptMatchesExpected(transcription.text, expectedLanguage)) {
        console.warn(
          `[voiceToText.formData] script_mismatch after_retry expectedLanguage=${expectedLanguage} sample="${transcription.text.slice(0, 60)}" — returning anyway`,
        );
      }
    }

    return { text: transcription.text, language: transcription.language };
  }, 'voiceToText.sarvam');
}

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  return runResiliently(async (config) => {
    let { output: transcription } = await voiceToTextPrompt(buildPromptInput(input), config);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    if (isLikelyTranscriptionRefusal(transcription.text)) {
      throw new Error("Model returned a refusal instead of a transcript (empty/silent audio)");
    }

    if (shouldRetryForScript(transcription.text, input.expectedLanguage)) {
      console.info(
        `[voiceToText] script_mismatch first_attempt expectedLanguage=${input.expectedLanguage} sample="${transcription.text.slice(0, 60)}" — retrying with forceScript`,
      );
      const retry = await voiceToTextPrompt(buildPromptInput(input, { forceScript: true }), config);
      if (retry.output?.text && !isLikelyTranscriptionRefusal(retry.output.text)) {
        transcription = retry.output;
      }
      if (!scriptMatchesExpected(transcription.text, input.expectedLanguage)) {
        console.warn(
          `[voiceToText] script_mismatch after_retry expectedLanguage=${input.expectedLanguage} sample="${transcription.text.slice(0, 60)}" — returning anyway`,
        );
      }
    }

    return { text: transcription.text, language: transcription.language };
  }, 'voiceToText.gemini');
}
