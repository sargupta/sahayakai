/**
 * Complaints about the teacher on real parent calls (class gate):
 *   - the agent promises the principal only where complaints are routed there
 *     (`complaintRouting`, set by the SamparkAI demo); everywhere else it
 *     promises only that the school will see it;
 *   - every caller of generateCallSummary gets a cleaned summary: the word
 *     "null" is never a complaint, and a real complaint means a follow-up.
 */

// jest.mock is hoisted above the imports, so the mock keeps its state on
// globalThis rather than in module variables that do not exist yet.
type PromptLog = { prompts: Array<{ name: string; prompt: string }>; output: unknown };
const log = (): PromptLog => {
    const g = globalThis as unknown as { __promptLog?: PromptLog };
    g.__promptLog ??= { prompts: [], output: null };
    return g.__promptLog;
};

jest.mock('@/ai/genkit', () => ({
    ai: {
        definePrompt: (cfg: { name: string; prompt: string }) => {
            const g = globalThis as unknown as { __promptLog?: { prompts: unknown[]; output: unknown } };
            g.__promptLog ??= { prompts: [], output: null };
            g.__promptLog.prompts.push({ name: cfg.name, prompt: cfg.prompt });
            return async () => ({ output: g.__promptLog!.output });
        },
    },
    runResiliently: (fn: (cfg: unknown) => Promise<unknown>) => fn({}),
}));
jest.mock('@/lib/parent-call-guard', () => ({
    assertAllRules: () => undefined,
    BehaviouralGuardError: class extends Error {},
}));

import { generateCallSummary } from '@/ai/flows/parent-call-agent';

const base = {
    parentResponse: 'The parent was upset.',
    parentConcerns: [],
    parentCommitments: [],
    actionItemsForTeacher: ['Call back'],
    guidanceGiven: [],
    parentSentiment: 'upset' as const,
    callQuality: 'difficult' as const,
    followUpNeeded: false,
};

const input = {
    studentName: 'A',
    className: '7A',
    subject: 'Science',
    reason: 'behavioral_concern',
    teacherMessage: 'note',
    parentLanguage: 'en' as const,
    transcript: [{ role: 'parent' as const, text: 'hello' }],
    callSid: 'CA1',
};

describe('agent reply prompt', () => {
    const reply = () => log().prompts.find((p) => p.name === 'parentCallAgentReply')!.prompt;

    it('stays calm with an angry parent', () => {
        expect(reply()).toMatch(/Never argue/);
        expect(reply()).toMatch(/not blaming the child/);
    });

    it('promises the principal only when complaints are routed there', () => {
        const prompt = reply();
        const gated = /\{\{#if complaintRouting\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/.exec(prompt);
        expect(gated).not.toBeNull();
        expect(gated![1]).toMatch(/principal/);
        expect(gated![2]).not.toMatch(/principal/i);
        // Outside the gate, no line promises the principal.
        expect(prompt.replace(gated![0], '')).not.toMatch(/reach the teacher and the principal/);
    });
});

describe('generateCallSummary', () => {
    it.each(['null', 'None', 'N/A', '  '])('treats %p as no complaint', async (word) => {
        log().output = { ...base, complaintAboutTeacher: word };
        const out = await generateCallSummary(input);
        expect(out.complaintAboutTeacher).toBeNull();
        expect(out.followUpNeeded).toBe(false);
    });

    it('makes a real complaint a follow-up', async () => {
        log().output = { ...base, complaintAboutTeacher: ' The teacher shouts. ' };
        const out = await generateCallSummary(input);
        expect(out.complaintAboutTeacher).toBe('The teacher shouts.');
        expect(out.followUpNeeded).toBe(true);
    });
});
