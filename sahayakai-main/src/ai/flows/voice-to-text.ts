'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const VoiceToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "Audio data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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

Audio Input: {{media url=audioDataUri}}

Output strictly valid JSON matching the schema.`,
});

export async function voiceToTextFormData(formData: FormData): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  const file = formData.get('audio') as File;
  if (!file) {
    throw new Error("No audio file provided in FormData");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // file.type can be empty on some browsers — fall back to webm which Gemini accepts
  const mimeType = file.type || 'audio/webm';
  const base64Audio = `data:${mimeType};base64,${buffer.toString('base64')}`;

  return runResiliently(async (config) => {
    const { output: transcription } = await voiceToTextPrompt({ audioDataUri: base64Audio }, config);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    return { text: transcription.text, language: transcription.language };
  });
}

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  return runResiliently(async (config) => {
    const { output: transcription } = await voiceToTextPrompt(input, config);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    return { text: transcription.text, language: transcription.language };
  });
}
