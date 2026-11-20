/**
 * @fileOverview Generates a single in-character chat message for a demo teacher
 * persona. Used by:
 *   1. `scripts/seed-community-conversation.ts` — to backfill 50 messages
 *   2. `src/app/api/community/persona-pulse/route.ts` — live during demo
 *
 * Cost: ~$0.0002/call with gemini-2.5-flash (max 150 output tokens).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { INJECTION_GUARD, frameUserInput } from '@/ai/prompt-hardening';
import { isInNativeScript } from '@/lib/native-script';

/** Shorter than this after cleanup is a word, not a message ("ঠিকই", "OK"). */
const MIN_MESSAGE_CHARS = 5;
import type { PersonaDef } from '@/ai/data/community-personas';

// ── Schemas ──────────────────────────────────────────────────────────────────

const RecentMessageSchema = z.object({
  authorName: z.string(),
  text: z.string(),
});

const PersonaMessageInputSchema = z.object({
  personaName: z.string(),
  personaState: z.string(),
  personaSubject: z.string(),
  personaGradeLevel: z.string(),
  personaVoiceTone: z.string(),
  preferredLanguage: z.string(),
  yearsExperience: z.number(),
  recentMessages: z.array(RecentMessageSchema).describe('Last 5 messages in the chat for context. May be empty.'),
  /** Optional mode hint — "reply" forces a reaction to the most recent message;
   *  "fresh" forces a standalone message. Default: model decides. */
  mode: z.enum(['reply', 'fresh', 'auto']).default('auto'),
});

export type PersonaMessageInput = z.infer<typeof PersonaMessageInputSchema>;

const PersonaMessageOutputSchema = z.object({
  message: z.string().describe('Single short message in the persona voice and preferred language. 30-180 characters. No quotes, no preamble.'),
});

export type PersonaMessageOutput = z.infer<typeof PersonaMessageOutputSchema>;

// ── Prompt ───────────────────────────────────────────────────────────────────

/**
 * Build the prompt text inline. We do NOT use structured output here —
 * Gemini 2.5-flash returns null disproportionately often on tiny single-field
 * JSON schemas with strict character limits. Plain-text output (then we strip
 * quotes ourselves) is more reliable for this shape of task.
 */
function buildPrompt(input: PersonaMessageInput): string {
  const recentBlock =
    input.recentMessages.length === 0
      ? '(The chat is empty — start something new.)'
      : input.recentMessages
          .map((m) => `- ${m.authorName}: "${m.text.replace(/"/g, "'")}"`)
          .join('\n');

  return `You are role-playing as an Indian schoolteacher named ${input.personaName} in a community chat for teachers across India. Other teachers in the room are chatting in real time.
${INJECTION_GUARD}

YOUR CHARACTER:
- Name: ${input.personaName}
- State: ${input.personaState}
- Subject: ${input.personaSubject}
- Grade: Class ${input.personaGradeLevel}
- Years teaching: ${input.yearsExperience}
- Voice/personality: ${input.personaVoiceTone}
- Preferred language: ${input.preferredLanguage}

RECENT CHAT (last 5 messages):
${frameUserInput('recent_chat_messages', recentBlock)}

TASK: Write ONE short message that ${input.personaName} would post right now.

RULES:
1. Write in ${input.preferredLanguage}. Use the correct script (Devanagari for Hindi/Marathi, Bangla for Bengali, Tamil script for Tamil, Telugu script for Telugu, Kannada for Kannada, Malayalam for Malayalam, Gujarati for Gujarati, Odia script for Odia, Gurmukhi for Punjabi, English for English). NEVER transliterate into Latin or any other script — output MUST be in the native script of ${input.preferredLanguage}. Occasional Indian-English code-switch ("ma'am", "doubt") is fine only for English-preferring personas.
2. Length: 30 to 180 characters. Real WhatsApp-message style.
3. Stay in character — match the voice exactly.
4. Be concrete. Talk about teaching ${input.personaSubject} to Class ${input.personaGradeLevel}, a student moment, a small question, a tip, an observation.
5. Mode = ${input.mode}: ${
    input.mode === 'reply'
      ? 'directly reply to the most recent message above. Mention the previous teacher by first name if natural.'
      : input.mode === 'fresh'
        ? 'start a new thought. Do NOT reference recent messages.'
        : 'your call — reply if it feels organic, otherwise post fresh.'
  }
6. No hashtags. No emojis. No quotes around the message. No "${input.personaName}:" prefix.
7. Do NOT mention AI, SahayakAI, ChatGPT, or any product. You are a human teacher.
8. Vary openings — don't start every message the same way.

Output: ONLY the message text. Nothing else. No JSON, no labels.`;
}

const personaMessageFlow = ai.defineFlow(
  {
    name: 'communityPersonaMessageFlow',
    inputSchema: PersonaMessageInputSchema,
    outputSchema: PersonaMessageOutputSchema,
  },
  async (input) => {
    // Plain-text generation — more reliable than schema-bound output for
    // this single-field shape. We do the cleanup ourselves below.
    const generate = async (prompt: string) => {
      const result = await ai.generate({
        prompt,
        config: {
          temperature: 0.85,
          maxOutputTokens: 220,
        },
      });
      return (result.text ?? '').trim();
    };

    // Cleanup: strip surrounding quotes, leading "Name:" if model added it,
    // and trailing whitespace. Also drop accidental code-fences.
    const clean = (text: string): string => {
      let out = text
        .replace(/^```[a-z]*\n?/gi, '')
        .replace(/\n?```$/g, '')
        .trim()
        .replace(/^"+|"+$/g, '')
        .replace(/^[“”]+|[“”]+$/g, '')
        .replace(new RegExp(`^${input.personaName}\\s*:\\s*`, 'i'), '')
        .trim();
      // Hard cap — prompt says 180 but the model sometimes overruns. Trim at
      // the last whitespace before 240 chars so we don't cut mid-word.
      if (out.length > 240) {
        const cut = out.slice(0, 240);
        const lastSpace = cut.lastIndexOf(' ');
        out = (lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trim() + '…';
      }
      return out;
    };

    // What is wrong with an answer, if anything. The prompt mandates the native script and a
    // full message, but the model sometimes drifts into English or Latin transliteration (the
    // live evals caught a Tamil reply with six Tamil letters) or answers with one word (a
    // Bengali reply of just "ঠিকই"). Either way it is asked once more, saying what was wrong;
    // a message that is still wrong is not posted.
    const problem = (text: string): 'script' | 'short' | null => {
      if (!isInNativeScript(text, input.preferredLanguage)) return 'script';
      if (clean(text).length < MIN_MESSAGE_CHARS) return 'short';
      return null;
    };

    let raw = await generate(buildPrompt(input));
    if (!raw) {
      throw new Error('Persona message generation returned empty output');
    }

    const first = problem(raw);
    if (first) {
      const why = first === 'script'
        ? `was not written in ${input.preferredLanguage} script`
        : 'was too short: one or two words, not a message';
      raw = await generate(
        `${buildPrompt(input)}\n\nYour previous answer ${why}. ` +
          `Write the message again, entirely in ${input.preferredLanguage} script, as one or two full sentences.`,
      );
      const second = raw ? problem(raw) : 'short';
      if (second === 'script') {
        throw new Error(`Persona message is not in ${input.preferredLanguage} script after one retry`);
      }
      if (second === 'short') {
        throw new Error(`Persona message too short: "${clean(raw)}"`);
      }
    }

    const cleaned = clean(raw);
    return { message: cleaned };
  },
);

// ── Public API ───────────────────────────────────────────────────────────────

export interface RecentMessageContext {
  authorName: string;
  text: string;
}

/**
 * Generate one in-character message for a persona, optionally responding to
 * the last 5 messages in the room.
 */
export async function generateCommunityPersonaMessage(
  persona: PersonaDef,
  recentMessages: RecentMessageContext[] = [],
  mode: 'reply' | 'fresh' | 'auto' = 'auto',
): Promise<PersonaMessageOutput> {
  return personaMessageFlow({
    personaName: persona.displayName,
    personaState: persona.state,
    personaSubject: persona.subject,
    personaGradeLevel: persona.gradeLevel,
    personaVoiceTone: persona.voiceTone,
    preferredLanguage: persona.preferredLanguage,
    yearsExperience: persona.yearsExperience,
    recentMessages: recentMessages.slice(-5),
    mode,
  });
}
