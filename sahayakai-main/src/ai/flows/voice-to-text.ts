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
});
export type VoiceToTextOutput = z.infer<typeof VoiceToTextOutputSchema>;

const voiceToTextPrompt = ai.definePrompt({
  name: 'voiceToTextPrompt',
  input: { schema: VoiceToTextInputSchema },
  output: { schema: VoiceToTextOutputSchema },
  prompt: `You are a multilingual speech-to-text engine optimized for Indian languages and English.

Your task is to transcribe the audio and output ONLY the clean, final text.

INSTRUCTIONS:
1. **Transcribe**: Listen to the audio and transcribe exactly what is said.
2. **Detect Language**: Handle English, Hindi, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi, Malayalam, or Odia.
3. **Cleanup (Implicit)**:
   - Remove filler words (uh, um, like, matlab, yani, etc.) UNLESS they are essential to meaning.
   - Fix stutters and repetitions.
   - Ensure grammatical correctness while preserving the speaker's original intent and tone.
   - Preserve code-switching (e.g., Hindi + English mixed).
4. **Formatting**: Ensure proper punctuation and capitalization.

Audio Input: {{media url=audioDataUri}}

Output ONLY the cleaned text string.`,
});

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  return runResiliently(async (config) => {
    // console.log(`[VoiceToText] Starting optimized transcription. Audio URI length: ${input.audioDataUri.length}`);

    const { output: transcription } = await voiceToTextPrompt(input, config);

    // console.log(`[VoiceToText] Transcription result:`, transcription);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    return { text: transcription.text };
  });
}
