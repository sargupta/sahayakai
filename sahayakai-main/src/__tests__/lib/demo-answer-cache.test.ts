/** @jest-environment node */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    _resetDemoAnswerCacheForTest,
    canonicalBody,
    demoAnswerCacheEnabled,
    demoAnswerKey,
    getDemoAnswer,
    putDemoAnswer,
    sanitizeDemoAnswer,
} from '@/lib/demo-answer-cache';

describe('demo answer cache (local demo only)', () => {
    it('is off unless development AND the explicit flag', () => {
        expect(demoAnswerCacheEnabled({ NODE_ENV: 'production', SAHAYAK_DEMO_ANSWER_CACHE: 'true' } as NodeJS.ProcessEnv)).toBe(false);
        expect(demoAnswerCacheEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
        expect(demoAnswerCacheEnabled({ NODE_ENV: 'development', SAHAYAK_DEMO_ANSWER_CACHE: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    });

    it('matches the same request regardless of key order and spacing, but not a different one', () => {
        expect(canonicalBody('{"b":1, "a":" x "}')).toBe(canonicalBody('{"a":"x","b":1}'));
        expect(demoAnswerKey('quiz', '{"topic":"Fractions"}')).toBe(demoAnswerKey('quiz', '{ "topic": "Fractions" }'));
        expect(demoAnswerKey('quiz', '{"topic":"Fractions"}')).not.toBe(demoAnswerKey('rubric', '{"topic":"Fractions"}'));
        expect(demoAnswerKey('quiz', '{"topic":"Fractions"}')).not.toBe(demoAnswerKey('quiz', '{"topic":"Decimals"}'));
    });

    it('ignores the fresh per-click ids (the lesson plan sends a new contentId every time)', () => {
        expect(demoAnswerKey('lesson-plan', '{"topic":"Water Cycle","contentId":"a1"}')).toBe(demoAnswerKey('lesson-plan', '{"contentId":"b2","topic":"Water Cycle"}'));
    });

    it('never serves library identity from someone else’s generation', () => {
        expect(sanitizeDemoAnswer({ id: 'x', isSaved: true, title: 'T' })).toEqual({ title: 'T' });
    });

    it('stores, serves and persists to the configured file', () => {
        const dir = mkdtempSync(join(tmpdir(), 'demo-cache-'));
        process.env.SAHAYAK_DEMO_ANSWER_CACHE_FILE = join(dir, 'answers.json');
        jest.useFakeTimers();
        _resetDemoAnswerCacheForTest();
        putDemoAnswer('lesson-plan', '{"topic":"Water Cycle"}', { title: 'Water', id: 'abc' });
        expect(getDemoAnswer('lesson-plan', '{"topic":"Water Cycle"}')).toEqual({ title: 'Water' });
        expect(getDemoAnswer('lesson-plan', '{"topic":"Photosynthesis"}')).toBeUndefined();
        jest.advanceTimersByTime(600);
        expect(Object.values(JSON.parse(readFileSync(join(dir, 'answers.json'), 'utf8')))).toEqual([{ title: 'Water' }]);
        _resetDemoAnswerCacheForTest();
        expect(getDemoAnswer('lesson-plan', '{"topic":"Water Cycle"}')).toEqual({ title: 'Water' }); // reloaded from file
        jest.useRealTimers();
        delete process.env.SAHAYAK_DEMO_ANSWER_CACHE_FILE;
    });
});
