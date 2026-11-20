/**
 * Class gate: speech-to-text never spends time "thinking".
 *
 * Production, 17 Nov 2026: one tap-to-talk clip took 24.4 s to transcribe on
 * Gemini 2.5 Flash, whose default is to reason before answering. Transcription
 * needs no reasoning, so the prompt must cap thinking at zero.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const FLOW = readFileSync(path.resolve(__dirname, '../../ai/flows/voice-to-text.ts'), 'utf8');

it('the transcription prompt disables thinking', () => {
    const prompt = FLOW.slice(FLOW.indexOf('const voiceToTextPrompt = ai.definePrompt({'));
    const head = prompt.slice(0, prompt.indexOf('prompt: `'));
    expect(head).toMatch(/thinkingConfig:\s*\{\s*thinkingBudget:\s*0\s*\}/);
});
