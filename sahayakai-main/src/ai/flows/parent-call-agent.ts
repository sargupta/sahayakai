/**
 * @fileOverview Conversational AI agent for parent phone calls.
 *
 * Two capabilities:
 * 1. generateAgentReply — produces the next conversational turn given transcript history
 * 2. generateCallSummary — produces a structured summary with action items after call ends
 */

import { ai, runResiliently } from '@/ai/genkit';
import { z } from 'genkit';
import { assertAllRules, BehaviouralGuardError } from '@/lib/parent-call-guard';

// ── Schemas ──────────────────────────────────────────────────────────────────

const TranscriptTurnSchema = z.object({
    role: z.enum(['agent', 'parent']),
    text: z.string(),
});

// ── Agent Reply ──────────────────────────────────────────────────────────────

const AgentReplyInputSchema = z.object({
    studentName: z.string(),
    className: z.string(),
    subject: z.string(),
    reason: z.string(),
    teacherMessage: z.string(),
    teacherName: z.string().optional(),
    schoolName: z.string().optional(),
    parentLanguage: z.string(),
    transcript: z.array(TranscriptTurnSchema),
    parentSpeech: z.string().describe('What the parent just said (transcribed)'),
    turnNumber: z.number(),
    /** One-line summary of recent test scores the agent can quote if the
     *  parent asks "what were his marks?". Built from PerformanceContext. */
    performanceSummary: z.string().optional(),
});

const AgentReplyOutputSchema = z.object({
    reply: z.string().describe('Agent response in parent\'s language. Max 3-4 sentences. Spoken aloud.'),
    shouldEndCall: z.boolean().describe('True if conversation has reached natural conclusion'),
    followUpQuestion: z.string().optional().describe('Optional gentle follow-up to keep conversation going'),
});

export type AgentReplyInput = z.infer<typeof AgentReplyInputSchema>;
export type AgentReplyOutput = z.infer<typeof AgentReplyOutputSchema>;

const agentReplyPrompt = ai.definePrompt({
    name: 'parentCallAgentReply',
    input: { schema: AgentReplyInputSchema },
    output: { schema: AgentReplyOutputSchema },
    prompt: `You are a warm, caring school representative making a phone call to a parent about their child. You are NOT a robot — you are having a real conversation.

**Context:**
- Student: {{studentName}}, Class: {{className}}, Subject: {{subject}}
- Reason for call: {{reason}}
- Teacher's original message: {{teacherMessage}}
{{#if teacherName}}- Teacher: {{teacherName}}{{/if}}
{{#if schoolName}}- School: {{schoolName}}{{/if}}
{{#if performanceSummary}}- Recent academic scores (quote ONLY if parent asks about marks/performance): {{performanceSummary}}{{/if}}
- Parent's language: {{parentLanguage}}

**Conversation so far:**
{{#each transcript}}
{{role}}: {{text}}
{{/each}}

**Parent just said:** "{{parentSpeech}}"

**Turn number:** {{turnNumber}} of maximum 6

**Your role — CRITICAL INSTRUCTIONS:**
1. Write your ENTIRE reply in {{parentLanguage}}. Not mixed. If Hindi, write in Devanagari. If Kannada, write in Kannada script. Etc.
2. Keep reply to 3-4 SHORT sentences MAX — this is spoken on a phone call, not written text.
3. Be genuinely conversational — respond to what the parent ACTUALLY said. Acknowledge their emotions.
4. If parent shares a concern: validate it, then offer ONE practical suggestion (home learning tip, school-parent collaboration idea).
5. If parent asks a question: answer it simply and warmly.
6. If parent seems satisfied or has no more to say: gently wrap up.
7. DO NOT lecture. DO NOT give long lists. ONE idea at a time.
8. Pedagogical guidance should be practical and simple — things a parent can do at HOME (read together 10 min, check homework daily, ask "what did you learn today?", create a quiet study corner, praise effort not marks).
9. If turn number >= 5, start wrapping up naturally unless parent has an urgent concern.
10. Set shouldEndCall=true when: parent says goodbye, parent seems done, or turn >= 6.
11. Use warm closings like "We are partners in your child's success" / "The school is always here for you".
12. NEVER introduce yourself as "Sahayak", "SahayakAI", or any AI/bot name. You are the school or the teacher — never reveal you are an AI system.

**Tone:** Like a kind teacher speaking to a parent at a chai meeting — respectful, warm, unhurried. Village parents deserve the same dignity as city parents. Never condescend. Never use jargon.`,
});

export async function generateAgentReply(input: AgentReplyInput): Promise<AgentReplyOutput> {
    const result = await runResiliently((cfg) => agentReplyPrompt(input, cfg), 'parentCall.agentReply');
    const output = result.output!;

    // Round-2 audit P0 BEHAV-1: post-response behavioural guard, fail-closed.
    // Mirrors the Python sidecar's `assert_all_rules` so the Genkit
    // fallback path cannot ship "I am an AI assistant" or wrong-script
    // replies that the sidecar would have caught. The TwiML route's outer
    // try/catch already lands a safe canned wrap-up on any throw from
    // this function, so throwing is the right move here.
    try {
        assertAllRules({
            reply: output.reply,
            parentLanguage: input.parentLanguage,
            turnNumber: input.turnNumber,
        });
    } catch (err) {
        if (err instanceof BehaviouralGuardError) {
            console.error('[parentCall.agentReply] behavioural guard failed', {
                axis: err.axis,
                details: err.details,
                parentLanguage: err.parentLanguage,
                turnNumber: input.turnNumber,
            });
        }
        throw err;
    }
    return output;
}

// ── Call Summary ─────────────────────────────────────────────────────────────

const CallSummaryInputSchema = z.object({
    studentName: z.string(),
    className: z.string(),
    subject: z.string(),
    reason: z.string(),
    teacherMessage: z.string(),
    teacherName: z.string().optional(),
    schoolName: z.string().optional(),
    parentLanguage: z.string(),
    transcript: z.array(TranscriptTurnSchema),
    callDurationSeconds: z.number().optional(),
});

const CallSummaryOutputSchema = z.object({
    parentResponse: z.string().describe('Brief summary of what the parent said/felt — 1-2 sentences in English'),
    parentConcerns: z.array(z.string()).describe('List of specific concerns raised by the parent'),
    parentCommitments: z.array(z.string()).describe('Things the parent agreed or offered to do'),
    actionItemsForTeacher: z.array(z.string()).describe('Recommended follow-up actions for the teacher'),
    guidanceGiven: z.array(z.string()).describe('Pedagogical advice that was shared during the call'),
    parentSentiment: z.enum(['cooperative', 'concerned', 'grateful', 'upset', 'indifferent', 'confused']),
    callQuality: z.enum(['productive', 'brief', 'difficult', 'unanswered']),
    followUpNeeded: z.boolean().describe('Whether teacher should follow up again'),
    followUpSuggestion: z.string().optional().describe('If followUpNeeded, what should the teacher do next'),
});

export type CallSummaryInput = z.infer<typeof CallSummaryInputSchema>;
export type CallSummaryOutput = z.infer<typeof CallSummaryOutputSchema>;

const callSummaryPrompt = ai.definePrompt({
    name: 'parentCallSummary',
    input: { schema: CallSummaryInputSchema },
    output: { schema: CallSummaryOutputSchema },
    prompt: `You are analyzing a completed phone call between a school AI agent and a parent. Generate a structured summary for the teacher's records.

**Call Context:**
- Student: {{studentName}}, Class: {{className}}, Subject: {{subject}}
- Reason: {{reason}}
- Teacher's original message: {{teacherMessage}}
{{#if teacherName}}- Teacher: {{teacherName}}{{/if}}
{{#if schoolName}}- School: {{schoolName}}{{/if}}
- Parent's language: {{parentLanguage}}
{{#if callDurationSeconds}}- Call duration: {{callDurationSeconds}} seconds{{/if}}

**Full Transcript:**
{{#each transcript}}
[{{role}}]: {{text}}
{{/each}}

**Instructions:**
1. Write ALL summary fields in English (this is for the teacher's internal records).
2. parentResponse: 1-2 sentence summary of the parent's overall reaction.
3. parentConcerns: Extract SPECIFIC concerns (not vague). Empty array if none.
4. parentCommitments: Things parent said they would do ("I'll check homework", "I'll send him tomorrow"). Empty if none.
5. actionItemsForTeacher: Practical next steps ("Schedule follow-up in 1 week", "Share worksheets for home practice"). Always include at least one.
6. guidanceGiven: What advice was shared during the call. Empty if none.
7. parentSentiment: Best single word describing parent's overall emotional state.
8. callQuality: "productive" if meaningful exchange, "brief" if parent didn't say much, "difficult" if parent was upset/uncooperative, "unanswered" if no real conversation happened.
9. followUpNeeded + followUpSuggestion: Based on the conversation outcome.`,
});

export async function generateCallSummary(input: CallSummaryInput): Promise<CallSummaryOutput> {
    const result = await runResiliently((cfg) => callSummaryPrompt(input, cfg), 'parentCall.summary');
    return result.output!;
}
