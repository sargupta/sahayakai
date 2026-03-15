/**
 * @fileOverview Generates empathetic, multilingual parent notification messages.
 *
 * - generateParentMessage — creates a context-aware message for parent outreach
 * - ParentMessageInput / ParentMessageOutput — exported types
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import type { OutreachReason } from '@/types/attendance';

// ── Language → BCP-47 code map ────────────────────────────────────────────────
// Do NOT let the AI decide this — hard-coded to prevent hallucination.

const LANGUAGE_TO_BCP47: Record<string, string> = {
    English:   'en-IN',
    Hindi:     'hi-IN',
    Tamil:     'ta-IN',
    Telugu:    'te-IN',
    Kannada:   'kn-IN',
    Malayalam: 'ml-IN',
    Bengali:   'bn-IN',
    Marathi:   'mr-IN',
    Gujarati:  'gu-IN',
    Punjabi:   'pa-IN',
    Odia:      'or-IN',
};

// ── Reason → prompt context ───────────────────────────────────────────────────

const REASON_CONTEXT: Record<OutreachReason, string> = {
    consecutive_absences: 'The student has been absent for multiple consecutive school days. Express genuine concern for the student\'s well-being, ask if everything is okay at home, and invite the parent to reach out. Be warm, not accusatory.',
    poor_performance:     'The student\'s academic performance has recently declined. Focus on offering support — mention that you want to work together to help the student succeed. Do NOT blame the student or parent.',
    behavioral_concern:   'There has been a behavioral concern in class. Approach this delicately — acknowledge the student\'s positive qualities, describe the concern objectively without exaggerating, and ask the parent to have a gentle conversation at home.',
    positive_feedback:    'Share a positive achievement or behavior. This message should be warm, celebratory, and brief. Encourage the parent to praise the student at home.',
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const ParentMessageInputSchema = z.object({
    studentName:              z.string().describe('Full name of the student'),
    className:                z.string().describe('Class name, e.g. "Class 6A"'),
    subject:                  z.string().describe('Subject the teacher teaches'),
    reason:                   z.enum(['consecutive_absences', 'poor_performance', 'behavioral_concern', 'positive_feedback']),
    reasonContext:            z.string().describe('Specific guidance for how to handle this reason'),
    teacherNote:              z.string().optional().describe('Optional note from the teacher with specific details'),
    parentLanguage:           z.string().describe('Language to write the message in, e.g. "Hindi"'),
    consecutiveAbsentDays:    z.number().optional().describe('Number of consecutive absent days (for absence reason)'),
    teacherName:              z.string().optional().describe('Teacher\'s name for the sign-off'),
    schoolName:               z.string().optional().describe('School name for context'),
    userId:                   z.string().optional(),
});

export type ParentMessageInput = z.infer<typeof ParentMessageInputSchema>;

const ParentMessageOutputSchema = z.object({
    message:        z.string().describe('The complete, ready-to-send message in the parent\'s language. Max 250 words.'),
    languageCode:   z.string().describe('BCP-47 language code e.g. hi-IN'),
    wordCount:      z.number().describe('Approximate word count of the message'),
});

export type ParentMessageOutput = z.infer<typeof ParentMessageOutputSchema>;

// ── Flow definition ───────────────────────────────────────────────────────────

const parentMessagePrompt = ai.definePrompt({
    name:   'parentMessagePrompt',
    input:  { schema: ParentMessageInputSchema },
    output: { schema: ParentMessageOutputSchema },
    prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}

You are a caring and professional school teacher writing a message to a student's parent/guardian. Your tone must be empathetic, respectful, and solution-focused — never threatening or judgmental.

**Situation context:**
- Student: {{studentName}}
- Class: {{className}}
- Subject: {{subject}}
- Reason for outreach: {{reason}}
- Specific guidance: {{reasonContext}}
{{#if consecutiveAbsentDays}}
- Days absent consecutively: {{consecutiveAbsentDays}}
{{/if}}
{{#if teacherNote}}
- Teacher's note: {{teacherNote}}
{{/if}}
{{#if teacherName}}
- From: {{teacherName}}
{{/if}}
{{#if schoolName}}
- School: {{schoolName}}
{{/if}}

**Critical instructions:**
1. Write the ENTIRE message in {{parentLanguage}} — not a mix of languages. If parentLanguage is English, write in English. If Hindi, write entirely in Hindi (Devanagari script). Same for all other languages.
2. Keep the message under 250 words — it will be read aloud over a phone call.
3. Start with a respectful greeting to the parent.
4. Mention the student's name naturally.
5. End with the teacher's name (if provided) or "Your child's teacher".
6. Do NOT include any phone numbers, links, or external references.
7. Reason-specific guidance:
   - consecutive_absences: Express concern for the child's well-being. Ask if they need any support. Do not accuse.
   - poor_performance: Offer help and partnership. Focus on improvement, not failure.
   - behavioral_concern: Be factual but gentle. Acknowledge positive qualities. Ask for home support.
   - positive_feedback: Be warm and celebratory. Specific praise is more meaningful than generic praise.

Return:
- message: the complete message text
- languageCode: the BCP-47 code for the language
- wordCount: approximate word count`,
});

const parentMessageFlow = ai.defineFlow(
    {
        name:         'parentMessageFlow',
        inputSchema:  ParentMessageInputSchema,
        outputSchema: ParentMessageOutputSchema,
    },
    async (input) => {
        const result = await parentMessagePrompt(input);
        const output = result.output!;

        // Override languageCode with our hardcoded map — do not trust the AI's value
        const languageCode = LANGUAGE_TO_BCP47[input.parentLanguage] ?? 'en-IN';

        return {
            message:      output.message,
            languageCode,
            wordCount:    output.wordCount ?? output.message.split(/\s+/).length,
        };
    },
);

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateParentMessage(input: ParentMessageInput): Promise<ParentMessageOutput> {
    let enrichedInput = {
        ...input,
        // Always resolve reasonContext here — never rely on the template to do a dynamic lookup
        reasonContext: REASON_CONTEXT[input.reason as OutreachReason] ?? REASON_CONTEXT.consecutive_absences,
    };

    // Enrich with user profile if userId provided
    if (input.userId && (!input.teacherName || !input.schoolName)) {
        const { dbAdapter } = await import('@/lib/db/adapter');
        const profile = await dbAdapter.getUser(input.userId);
        if (profile) {
            if (!enrichedInput.teacherName) enrichedInput.teacherName = profile.displayName;
            if (!enrichedInput.schoolName && profile.schoolName) enrichedInput.schoolName = profile.schoolName;
        }
    }

    return parentMessageFlow(enrichedInput);
}
