/**
 * Riya call synopsis — the model writes 3–6 factual bullets from the stored transcript and the
 * collected answers. Server-only. The output is checked by `acceptSynopsis`
 * (src/lib/sampark/conversation/synopsis.ts); anything that fails falls back to the
 * deterministic rules synopsis, so a call always has one.
 */

import { z } from 'zod';

import { ai, runResiliently } from '@/ai/genkit';
import { INJECTION_GUARD, neutralizeUserInput } from '@/ai/prompt-hardening';
import type { SynopsisInput } from '@/lib/sampark/conversation/synopsis';

const SYNOPSIS_TIMEOUT_MS = 20_000;

const PromptInput = z.object({
    purposeLabel: z.string(),
    announcement: z.string(),
    outcome: z.string(),
    durationSeconds: z.string(),
    answers: z.array(z.object({ key: z.string(), value: z.string() })),
    transcript: z.array(z.object({ role: z.string(), at: z.string(), text: z.string() })),
});

const PromptOutput = z.object({
    bullets: z.array(z.string()).describe('3 to 6 short factual bullet points, in English, no leading dash'),
    callbackRequest: z.string().nullable().describe("The listener's own words asking to be called back later, or null if they did not ask"),
});

const synopsisPrompt = ai.definePrompt({
    name: 'riyaCallSynopsis',
    input: { schema: PromptInput },
    output: { schema: PromptOutput },
    prompt: `You write the record of a finished school phone call made by Riya, a school's AI calling assistant, for the school staff.
${INJECTION_GUARD}

Call: {{purposeLabel}} — outcome: {{outcome}} — duration: {{durationSeconds}}
What Riya was asked to say: <user_input field="announcement">{{announcement}}</user_input>

Answers Riya collected:
{{#each answers}}
- {{key}}: {{value}}
{{/each}}

Transcript (speaker, seconds into the call, words):
<user_input field="transcript">
{{#each transcript}}
[{{role}} @{{at}}]: {{text}}
{{/each}}
</user_input>

Write 3 to 6 bullets. Rules:
1. Only facts stated in the transcript or the answers above. Never guess intentions, feelings or anything not said.
2. Cover: whether the listener engaged, what they said in response to the message, any date, time or commitment they gave, and any request (call back later, stop calling, a question).
3. Short plain sentences, at most 25 words each. No quotes longer than 12 words. No phone numbers.
4. callbackRequest: if the listener asked to be called back at another time, give their words for the time (for example "tomorrow at 5 PM"); otherwise null (JSON null).
5. If the listener said nothing, say so; do not fill bullets with speculation.
6. A request to be called back is only a request: never write that a callback was scheduled, booked or arranged. Never state consent, agreement, attendance or any follow-up as done unless the listener said it in the transcript.
7. Never add marks, grades, attendance figures or other academic details that are not in the transcript or the announcement.`,
});

function withTimeout<T>(ms: number, work: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('riyaCallSynopsis timed out')), ms);
        work.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
}

/** Raw model output (unchecked). Throws on failure; the caller falls back to the rules. */
export async function generateRiyaSynopsis(input: SynopsisInput): Promise<{ bullets: string[]; callbackRequest: string | null }> {
    const result = await withTimeout(
        SYNOPSIS_TIMEOUT_MS,
        runResiliently(
            (cfg) =>
                synopsisPrompt(
                    {
                        purposeLabel: input.purposeLabel,
                        announcement: neutralizeUserInput(input.announcement ?? ''),
                        outcome: input.outcome,
                        durationSeconds: input.durationSeconds === null ? 'unknown' : `${Math.round(input.durationSeconds)} s`,
                        answers: Object.entries(input.answers)
                            .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim() !== '')
                            .map(([key, value]) => ({ key, value: neutralizeUserInput(value) })),
                        transcript: input.transcript
                            .filter((t) => t.message.trim())
                            .map((t) => ({ role: t.role === 'agent' ? 'Riya' : 'Listener', at: t.timeInCallSecs === null ? '?' : String(Math.round(t.timeInCallSecs)), text: neutralizeUserInput(t.message) })),
                    },
                    cfg,
                ),
            'riyaCall.synopsis',
        ),
    );
    if (!result.output) throw new Error('riyaCallSynopsis returned no output');
    return result.output;
}
