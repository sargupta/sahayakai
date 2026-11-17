/**
 * Class gate: SamparkAI's calling-provider page never locks a school out.
 *
 * Every SamparkAI page sat behind "Choose how SamparkAI places calls" until a
 * provider was chosen. Production runs SamparkAI in Practice with Riya's AI
 * calls off, so both provider cards are unavailable: with SamparkAI switched
 * on, no school could ever get past the page. The rule now: a provider choice
 * is required only when there is a provider to choose (Riya on), and the page
 * forwards straight in when there is not.
 */
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { needsProviderChoice, providerChoiceRequired } from '@/lib/sampark/provider-choice';
import { providerOptions, riyaEnabled } from '@/server/sampark/conversation';

const jsonSpy = jest.spyOn(NextResponse, 'json');

describe('a provider choice is required only when there is one to make', () => {
    it.each([undefined, '', 'false', 'true', 'TRUE', '1'])('agrees with riyaEnabled for SAMPARK_ELEVENLABS_ENABLED=%p', (v) => {
        const env = { SAMPARK_ELEVENLABS_ENABLED: v };
        expect(providerChoiceRequired(env)).toBe(riyaEnabled(env));
    });

    it('Riya off (production Practice): no provider is available and none is required', () => {
        const env = { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'false' };
        expect(providerOptions(env).some((o) => o.available)).toBe(false);
        expect(providerChoiceRequired(env)).toBe(false);
    });

    it('Riya on: a choice is required before the workspace', () => {
        expect(providerChoiceRequired({ SAMPARK_ELEVENLABS_ENABLED: 'true' })).toBe(true);
        expect(needsProviderChoice('/sampark/workspace')).toBe(true);
    });
});

describe('every gate on the chooser honours the rule', () => {
    it('the middleware redirects to the chooser only when a choice is required', () => {
        const src = readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8');
        const redirect = src.split('\n').find((l) => l.includes('needsProviderChoice(samparkPath)'));
        expect(redirect).toMatch(/providerChoiceRequired\(\)\s*&&\s*needsProviderChoice\(samparkPath\)/);
    });

    it('the chooser page forwards when nothing is required', () => {
        const src = readFileSync(path.join(process.cwd(), 'src/app/sampark/choose-provider/page.tsx'), 'utf8');
        expect(src).toMatch(/required === false\) router\.replace\(next\)/);
    });

    it('GET /api/sampark/provider says whether a choice is required', async () => {
        const saved = { ...process.env };
        try {
            Object.assign(process.env, { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'false' });
            const { GET } = await import('@/app/api/sampark/provider/route');
            const req = { headers: { get: (k: string) => (k === 'x-user-id' ? 'teacher-1' : null) } } as any;
            await GET(req);
            const body = jsonSpy.mock.calls.at(-1)?.[0] as { required?: boolean; options: { available: boolean }[] };
            expect(body.required).toBe(false);
            expect(body.options.every((o) => !o.available)).toBe(true);
        } finally {
            process.env = saved;
        }
    });
});
