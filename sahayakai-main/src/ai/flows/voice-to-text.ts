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
  text: z.string().describe('The transcribed text from the audio input.'),
});
export type VoiceToTextOutput = z.infer<typeof VoiceToTextOutputSchema>;

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

**KANNADA (ಕನ್ನಡ):**
- Filler words: ಅಂದರೆ (andare),ಹೆಳೋದೆಂದರೆ (heḷodendare), ಅಲ್ಲವಾ (allava), ಏನು (enu), ಹೌದು (haudu - when repetitive), ಅಂತೆ (ante), ನೋಡು (nodu), ಸರಿ (sari - when filler)

**TAMIL (தமிழ்):**
- Filler words: அது (athu), இது (idhu), அப்படின்னா (appadinna), சரி (sari), அது மாதிரி (athu maadhiri), அப்படியே (appadiye), என்ன (enna - when filler)

**TELUGU (తెలుగు):**
- Filler words: అంటే (ante), అవి (avi), ఇవి (ivi), అలాగె (alāge), చూస్తే (chūstē), అదేంటి (adēnti), ఇదేంటి (idēnti), మరి (mari), అಬ್ಬ (abba), ఆ (ā), ಅಂ (am), ಉಂ (um)

**BENGALI (বাংলা):**
- Filler words: ওই (oi), মানে (mane), তো (to), এই (ei), দেখো (dekho), আরে (are), আসলে (ashole), বুঝলে (bujhle), শুনো (shuno)

**MARATHI (मराठी):**
- Filler words: अं (an), अरे (are), अगं (aga), म्हणजे (mhanje), तर (tar), बरं (bara), मग (mag), म्हणून (mhanun)

**GUJARATI (ગુજરાતી):**
- Filler words: એટલે (etle), ને (ne), હવે (have), તો (to), પણ (pan), જુઓ (juo), રયો (rayo)

**PUNJABI (ਪੰਜਾਬੀ):**
- Filler words: ਮਤਲਬ (matlab), ਜੀ (ji), ਤਾਂ (taan), ਹੁਣ (hun), ਕਿ (ki), ਵੇਖੋ (vekho), ਅੱਛਾ (accha)

**MALAYALAM (മലയാളം):**
- Filler words: అది (athu), പിന്നെ (pinne), എന്ന് വെച്ചാൽ (ennu vechaal), അപ്പോ (appol), എന്താ (enth), ദേ (de), കേട്ടോ (ketto)

**ODIA (ଓଡ଼ିଆ):**
- Filler words: ମାନେ (mane), ଆଉ (au), ପରା (para), ହେଲେ (hele), ଟିକେ (tike), ଦେଖ (dekha), ଆଜ୍ଞା (agyan)

STEP 3: Apply universal cleanup rules:
1. Fix stutters and redundant phrases
2. Improve grammar while preserving original intent
3. Keep tone natural and conversational
4. DO NOT add information
5. Preserve code-switching

Raw text: {{rawText}}

Provide only the cleaned text in the SAME LANGUAGE as the input, nothing else.`,
});

export async function voiceToText(input: VoiceToTextInput): Promise<VoiceToTextOutput> {
  const { runResiliently } = await import('@/ai/genkit');

  return runResiliently(async (config) => {
    console.log(`[VoiceToText] Starting transcription. Audio URI length: ${input.audioDataUri.length}, Prefix: ${input.audioDataUri.substring(0, 50)}`);

    const { output: transcription } = await voiceToTextPrompt(input, config);

    console.log(`[VoiceToText] Raw transcription result:`, transcription);

    if (!transcription?.text) {
      throw new Error("Empty transcription returned from model");
    }

    const { output: cleaned } = await cleanupTextPrompt({ rawText: transcription.text }, config);

    if (!cleaned) {
      return { text: transcription.text };
    }

    return cleaned;
  });
}
