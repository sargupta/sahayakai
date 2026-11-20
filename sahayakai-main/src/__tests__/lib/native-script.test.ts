/**
 * Class gate: a community persona message is posted only in its language's own script.
 *
 * The live evals caught a Tamil persona reply with six Tamil letters: the prompt mandates the
 * native script, but the model drifted. The flow now measures its output and asks once more;
 * if the second answer is still in the wrong script, nothing is posted.
 */
import { isInNativeScript, nativeScriptShare } from '@/lib/native-script';

const generate = jest.fn();
jest.mock('@/ai/genkit', () => ({
    ai: { defineFlow: (_cfg: unknown, fn: (input: unknown) => unknown) => fn, generate: (...a: unknown[]) => generate(...a) },
}));

import { generateCommunityPersonaMessage } from '@/ai/flows/community-persona-message';

const TAMIL = 'கண்ணாடி டம்ளரில் தண்ணீர் ஊற்றி ஒளிவிலகலை காட்டலாம், பிரிசம் தேவையில்லை.';
const ENGLISH = 'Use a glass of water as a prism, no lab needed! நன்றி';

const persona = {
    id: 'p1', displayName: 'Murugan Vel', state: 'Tamil Nadu', subject: 'Science', gradeLevel: '9',
    voiceTone: 'Enthusiastic experimenter', preferredLanguage: 'Tamil', yearsExperience: 11,
} as unknown as Parameters<typeof generateCommunityPersonaMessage>[0];

describe('native script share', () => {
    it('measures the share of letters in the native script', () => {
        expect(nativeScriptShare(TAMIL, 'Tamil')!).toBeGreaterThan(0.9);
        expect(nativeScriptShare(ENGLISH, 'Tamil')!).toBeLessThan(0.3);
        expect(nativeScriptShare('Anything', 'English')).toBeNull();
        expect(isInNativeScript('आपका बच्चा अच्छा कर रहा है, doubt हो तो पूछिए', 'Hindi')).toBe(true);
    });
});

describe('community persona message: native script', () => {
    beforeEach(() => generate.mockReset());

    it('posts a native-script reply as it is', async () => {
        generate.mockResolvedValueOnce({ text: TAMIL });
        await expect(generateCommunityPersonaMessage(persona, [], 'fresh')).resolves.toEqual({ message: TAMIL });
        expect(generate).toHaveBeenCalledTimes(1);
    });

    it('asks once more when the reply drifts out of the script, and posts the corrected one', async () => {
        generate.mockResolvedValueOnce({ text: ENGLISH }).mockResolvedValueOnce({ text: TAMIL });
        await expect(generateCommunityPersonaMessage(persona, [], 'fresh')).resolves.toEqual({ message: TAMIL });
        expect(generate).toHaveBeenCalledTimes(2);
        expect(String(generate.mock.calls[1][0].prompt)).toMatch(/not written in Tamil script/);
    });

    it('posts nothing when the second reply is still in the wrong script', async () => {
        generate.mockResolvedValue({ text: ENGLISH });
        await expect(generateCommunityPersonaMessage(persona, [], 'fresh')).rejects.toThrow(/not in Tamil script/);
    });
});

/**
 * Class gate: a one-word reply is asked again once, like a wrong-script reply.
 *
 * The live evals caught a Bengali persona reply of just "ঠিকই" ("right"): native script, so it
 * passed the script check, and the flow then threw "too short" without asking again, so nothing
 * was posted. Any answer the flow would refuse is now retried once, saying what was wrong.
 */
describe('community persona message: too short', () => {
    beforeEach(() => generate.mockReset());

    const ONE_WORD = 'ঠিকই';
    const BENGALI = 'মাধ্যমিকের আগে পুরনো প্রশ্নপত্র সময় ধরে লিখলে ভয়টা অনেক কমে যায়।';
    const bengaliPersona = { ...persona, preferredLanguage: 'Bengali' } as typeof persona;

    it('asks once more when the reply is one word, and posts the full one', async () => {
        generate.mockResolvedValueOnce({ text: ONE_WORD }).mockResolvedValueOnce({ text: BENGALI });
        await expect(generateCommunityPersonaMessage(bengaliPersona, [], 'fresh')).resolves.toEqual({ message: BENGALI });
        expect(generate).toHaveBeenCalledTimes(2);
        expect(String(generate.mock.calls[1][0].prompt)).toMatch(/was too short/);
    });

    it('posts nothing when the second reply is still one word', async () => {
        generate.mockResolvedValue({ text: ONE_WORD });
        await expect(generateCommunityPersonaMessage(bengaliPersona, [], 'fresh')).rejects.toThrow(/too short/);
        expect(generate).toHaveBeenCalledTimes(2);
    });

    it('a second reply in the wrong script is still refused', async () => {
        generate.mockResolvedValueOnce({ text: ONE_WORD }).mockResolvedValueOnce({ text: ENGLISH });
        await expect(generateCommunityPersonaMessage(bengaliPersona, [], 'fresh')).rejects.toThrow(/not in Bengali script/);
    });
});
