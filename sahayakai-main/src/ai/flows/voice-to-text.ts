'use server';

/**
 * @fileOverview Converts voice input (audio data URI) to text with multilingual cleanup.
 *
 * - voiceToText - A function that converts voice input to text.
 * - VoiceToTextInput - The input type for the voiceToText function.
 * - VoiceToTextOutput - The return type for the voiceToText function.
 */

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
  text: z.string().describe('The transcribed text from the audio input.'),
});
export type VoiceToTextOutput = z.infer<typeof VoiceToTextOutputSchema>;

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  return voiceToTextFlow(input);
}

const voiceToTextPrompt = ai.definePrompt({
  name: 'voiceToTextPrompt',
  input: { schema: VoiceToTextInputSchema },
  output: { schema: VoiceToTextOutputSchema },
  prompt: `Transcribe the following audio data to text:\n\n{{media url=audioDataUri}}`,
});

const CleanupTextSchema = z.object({
  rawText: z.string().describe('The raw transcribed text to clean up.'),
});

const cleanupTextPrompt = ai.definePrompt({
  name: 'cleanupTextPrompt',
  input: { schema: CleanupTextSchema },
  output: { schema: VoiceToTextOutputSchema },
  prompt: `You are a multilingual text cleanup assistant for Indian languages and English.

STEP 1: Detect the language of the raw text.

STEP 2: Apply language-specific cleanup rules. Remove ONLY these filler words/discourse markers when they serve as hesitation or pause words (NOT when meaningful):

**ENGLISH:**
- Filler words: uh, um, er, ah, like, you know, I mean, well, so, actually, basically, literally

**HINDI (हिंदी):**
- Filler words: अच्छा (acchā), मतलब (matlab), वैसे (vaise), तो (to), देखो (dekho), यानी (yānī), वो (vo), असल में (asal mein), हूँ (hoon), अ (a), आ (aa)
- Avoid removing when meaningful in context

**KANNADA (ಕನ್ನಡ):**
- Filler words: ಅಂದರೆ (andare),ಹೆಳೋದೆಂದರೆ (heḷodendare), ಅಲ್ಲವಾ (allava), ಏನು (enu), ಹೌದು (haudu - when repetitive), ಅಂತೆ (ante), ನೋಡು (nodu), ಸರಿ (sari - when filler)
- Preserve cultural context

**TAMIL (தமிழ்):**
- Filler words: அது (athu), இது (idhu), அப்படின்னா (appadinna), சரி (sari), அது மாதிரி (athu maadhiri), அப்படியே (appadiye), என்ன (enna - when filler)
- Keep meaningful usage

**TELUGU (తెలుగు):**
- Filler words: అంటే (ante), అవి (avi), ఇవి (ivi), అలాగె (alāge), చూస్తే (chūstē), అదేంటి (adēnti), ఇదేంటి (idēnti), మరి (mari), అబ్బ (abba), ఆ (ā), అం (am), ఉం (um)
- Preserve natural Telugu flow

**BENGALI (বাংলা):**
- Filler words: ওই (oi), মানে (mane), তো (to), এই (ei), দেখো (dekho), আরে (are), আসলে (ashole), বুঝলে (bujhle), শুনো (shuno)
- Keep cultural expressions

**MARATHI (मराठी):**
- Filler words: अं (an), अरे (are), अगं (aga), म्हणजे (mhanje), तर (tar), बरं (bara), मग (mag), म्हणून (mhanun)
- Respect regional nuances

**GUJARATI (ગુજરાતી):**
- Filler words: એટલે (etle - "meaning/so"), ને (ne - "and/tag"), હવે (have - "now/so"), તો (to - "then/so"), પણ (pan - "but/um"), જુઓ (juo - "look"), રયો (rayo - "remained/um")
- Common hesitations: અ (a), હા (ha - repetitive yes)

**PUNJABI (ਪੰਜਾਬੀ):**
- Filler words: ਮਤਲਬ (matlab - "meaning"), ਜੀ (ji - honorific filler), ਤਾਂ (taan - "then/so"), ਹੁਣ (hun - "now"), ਕਿ (ki - "that/so"), ਵੇਖੋ (vekho - "look"), ਅੱਛਾ (accha - "okay")
- Discourse markers: ਗੱਲ ਸੁਣੋ (gal suno - "listen"), ਬਸ (bas - "just")

**MALAYALAM (മലയാളം):**
- Filler words: അത് (athu - "that/um"), പിന്നെ (pinne - "then"), എന്ന് വെച്ചാൽ (ennu vechaal - "meaning/if you say"), അപ്പോ (appol - "then/so"), എന്താ (enth - "what/um"), ദേ (de - "hey/look"), കേട്ടോ (ketto - "you know/hear me")
- Hesitations: ആ (aa), ഉം (um)

**ODIA (ଓଡ଼ିଆ):**
- Filler words: ମାନେ (mane - "meaning"), ଆଉ (au - "and/um"), ପରା (para - "tag/right?"), ହେଲେ (hele - "but/so"), ଟିକେ (tike - "little/just"), ଦେଖ (dekha - "look"), ଆଜ୍ଞା (agyan - "yes/sir")
- Common markers: ବୋଲି (boli - "that"), ସତରେ (satare - "really")

**GUJARATI (ગુજરાતી):**
- Filler words: એટલે (etle - "meaning/so"), ને (ne - "and/tag"), હવે (have - "now/so"), તો (to - "then/so"), પણ (pan - "but/um"), જુઓ (juo - "look"), રયો (rayo - "remained/um")
- Common hesitations: અ (a), હા (ha - repetitive yes)

**PUNJABI (ਪੰਜਾਬੀ):**
- Filler words: ਮਤਲਬ (matlab - "meaning"), ਜੀ (ji - honorific filler), ਤਾਂ (taan - "then/so"), ਹੁਣ (hun - "now"), ਕਿ (ki - "that/so"), ਵੇਖੋ (vekho - "look"), ਅੱਛਾ (accha - "okay")
- Discourse markers: ਗੱਲ ਸੁਣੋ (gal suno - "listen"), ਬਸ (bas - "just")

**MALAYALAM (മലയാളം):**
- Filler words: അത് (athu - "that/um"), പിന്നെ (pinne - "then"), എന്ന് വെച്ചാൽ (ennu vechaal - "meaning/if you say"), അപ്പോ (appol - "then/so"), എന്താ (enth - "what/um"), ദേ (de - "hey/look"), കേട്ടോ (ketto - "you know/hear me")
- Hesitations: ആ (aa), ഉം (um)

**ODIA (ଓଡ଼ିଆ):**
- Filler words: ମାନେ (mane - "meaning"), ଆଉ (au - "and/um"), ପରା (para - "tag/right?"), ହେଲେ (hele - "but/so"), ଟିକେ (tike - "little/just"), ଦେଖ (dekha - "look"), ଆଜ୍ଞା (agyan - "yes/sir")
- Common markers: ବୋଲି (boli - "that"), ସତରେ (satare - "really")

STEP 3: Apply universal cleanup rules:
1. Fix stutters and redundant phrases (e.g., "where exactly where" → "where exactly")
2. Improve grammar while preserving original intent and meaning
3. Keep tone natural and conversational
4. DO NOT add information that wasn't in the original text
5. Preserve code-switching (Hinglish, Tanglish, etc.) - don't over-Anglicize

Raw text: {{rawText}}

Provide only the cleaned text in the SAME LANGUAGE as the input, nothing else.`,
});

const voiceToTextFlow = ai.defineFlow(
  {
    name: 'voiceToTextFlow',
    inputSchema: VoiceToTextInputSchema,
    outputSchema: VoiceToTextOutputSchema,
  },
  async input => {
    // Step 1: Transcribe audio
    const { output: transcription } = await voiceToTextPrompt(input);

    // Step 2: Clean up the transcription with language-aware processing
    const { output: cleaned } = await cleanupTextPrompt({ rawText: transcription!.text });

    return cleaned!;
  }
);
