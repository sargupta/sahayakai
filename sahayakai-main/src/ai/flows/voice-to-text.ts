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

{{#if expectedLanguageHint}}
PRIMARY LANGUAGE HINT (USE THIS):
The user's app is set to **{{expectedLanguageName}}** ({{expectedLanguageScript}} script). Transcribe in that language and script UNLESS the audio is clearly in a different language. Code-switching with English is allowed. NEVER output Latin transliteration of an Indic language — use the native script.
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

function buildPromptInput(input: VoiceToTextInput) {
  const hint = input.expectedLanguage ? ISO_TO_LANG_HINT[input.expectedLanguage] : null;
  return {
    audioDataUri: input.audioDataUri,
    expectedLanguage: input.expectedLanguage,
    expectedLanguageHint: hint ? 'yes' : undefined,
    expectedLanguageName: hint?.name,
    expectedLanguageScript: hint?.script,
  } as any;
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
    const { output: transcription } = await voiceToTextPrompt(
      buildPromptInput({ audioDataUri: base64Audio, expectedLanguage }),
      config,
    );

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    if (isLikelyTranscriptionRefusal(transcription.text)) {
      throw new Error("Model returned a refusal instead of a transcript (empty/silent audio)");
    }

    return { text: transcription.text, language: transcription.language };
  }, 'voiceToText.sarvam');
}

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  return runResiliently(async (config) => {
    const { output: transcription } = await voiceToTextPrompt(buildPromptInput(input), config);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    if (isLikelyTranscriptionRefusal(transcription.text)) {
      throw new Error("Model returned a refusal instead of a transcript (empty/silent audio)");
    }

    return { text: transcription.text, language: transcription.language };
  }, 'voiceToText.gemini');
}
