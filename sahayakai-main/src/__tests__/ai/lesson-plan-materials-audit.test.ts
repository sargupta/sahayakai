/**
 * @jest-environment node
 *
 * Class gate (2026-11-13, found in internal testing on riya): an optional
 * follow-up model call must never hold up the result it decorates.
 *
 * The materials audit only adds materials a lesson plan forgot to list. With
 * thinking on it took 109 s, so every lesson plan hit the dispatcher's 60 s
 * timeout and the teacher got "try again" for a plan written in 18 s.
 * `auditMaterials` must ask for no thinking, and must hand back the plan's own
 * materials once MATERIALS_AUDIT_TIMEOUT_MS has passed, whatever the model does.
 */

import fs from 'fs';
import path from 'path';

// ── Mocks (before importing the SUT; see lesson-plan-language-leak.test.ts) ──

jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: jest.fn() } }));
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: jest.fn(async () => '') }));
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: jest.fn(async () => undefined) }));
jest.mock('@/lib/safety', () => ({ validateTopicSafety: jest.fn().mockReturnValue({ safe: true }) }));
jest.mock('@/ai/genkit', () => ({
    ai: {
        definePrompt: jest.fn(() => ({})),
        defineFlow: jest.fn((_config: unknown, fn: unknown) => fn),
        generate: jest.fn(),
    },
    runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
}));
jest.mock('@/ai/soul', () => ({ SAHAYAK_SOUL_PROMPT: '', STRUCTURED_OUTPUT_OVERRIDE: '' }));
jest.mock('@/lib/indian-context', () => ({
    getIndianContextPrompt: () => '',
    renderRegionalContextBlock: () => '',
}));
jest.mock('@/lib/lesson-plan-cache', () => ({
    generateLessonPlanCacheKey: () => 'k',
    getCachedLessonPlan: jest.fn().mockResolvedValue(null),
    setCachedLessonPlan: jest.fn(),
}));
jest.mock('@/lib/firebase-admin', () => ({ getStorageInstance: jest.fn() }));
jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: jest.fn() }));
jest.mock('@/lib/grade-utils', () => ({ extractGradeFromTopic: () => null }));

import { ai } from '@/ai/genkit';
import {
    auditMaterials,
    MATERIALS_AUDIT_TIMEOUT_MS,
    type LessonPlanOutput,
} from '@/ai/flows/lesson-plan-generator';

const mockGenerate = ai.generate as unknown as jest.Mock;

const plan = {
    title: 'Water Cycle',
    materials: ['chart paper'],
    activities: [
        { name: 'Evaporation', description: 'Heat water in a steel bowl and watch the steam.' },
    ],
} as unknown as LessonPlanOutput;

/** The lesson-plan dispatcher's timeout, read from its source. */
function lessonPlanDispatchTimeoutMs(): number {
    const src = fs.readFileSync(
        path.join(__dirname, '../../lib/sidecar/lesson-plan-dispatch.ts'),
        'utf8',
    );
    const m = src.match(/const FALLBACK_TIMEOUT_MS = ([\d_]+);/);
    if (!m) throw new Error('FALLBACK_TIMEOUT_MS not found in lesson-plan-dispatch.ts: update this gate.');
    return Number(m[1].replace(/_/g, ''));
}

beforeEach(() => {
    mockGenerate.mockReset();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('lesson plan: the materials audit never holds up the plan', () => {
    it('gives up on a slow audit and keeps the plan\'s own materials', async () => {
        jest.useFakeTimers({ now: 0 });
        mockGenerate.mockReturnValue(new Promise(() => {})); // the model never answers

        let settledAt = -1;
        const result = auditMaterials(plan, 'English').then((m) => {
            settledAt = Date.now();
            return m;
        });
        await jest.advanceTimersByTimeAsync(MATERIALS_AUDIT_TIMEOUT_MS + 1_000);

        await expect(result).resolves.toEqual(['chart paper']);
        expect(settledAt).toBeGreaterThanOrEqual(0);
        expect(settledAt).toBeLessThanOrEqual(MATERIALS_AUDIT_TIMEOUT_MS + 100);
    });

    it('adds the materials the audit finds when it answers in time', async () => {
        mockGenerate.mockResolvedValue({ output: ['steel bowl'] });
        await expect(auditMaterials(plan, 'English')).resolves.toEqual(['chart paper', 'steel bowl']);
    });

    it('asks the model for no thinking', async () => {
        mockGenerate.mockResolvedValue({ output: [] });
        await auditMaterials(plan, 'English');
        expect(mockGenerate.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    });

    it('leaves the plan itself most of the dispatcher timeout', () => {
        // The plan took 18.5 s on 2026-11-13 and saving it ~1 s; the audit's
        // cap must leave room for a slow plan as well.
        expect(MATERIALS_AUDIT_TIMEOUT_MS).toBeLessThanOrEqual(lessonPlanDispatchTimeoutMs() / 4);
    });
});
