/**
 * @jest-environment node
 *
 * Cache-key correctness tests.
 *
 * The hyperlocal fix added `state` to the cache key. Without that, the
 * first teacher to generate a "Class 5 / Gravity / Kannada" plan would
 * cache a Karnataka-flavoured response that subsequently served to a
 * Punjab teacher — which is the exact bug this fix is meant to remove.
 */

import { generateLessonPlanCacheKey } from '../../lib/lesson-plan-cache';

describe('lesson-plan cache key', () => {
    const baseParams = {
        topic: 'Gravity',
        gradeLevels: ['Class 5'],
        language: 'Kannada',
        resourceLevel: 'low',
        difficultyLevel: 'standard',
        subject: 'Science',
    };

    it('produces different keys for different states', () => {
        const ka = generateLessonPlanCacheKey({ ...baseParams, state: 'Karnataka' });
        const pb = generateLessonPlanCacheKey({ ...baseParams, state: 'Punjab' });
        expect(ka).not.toBe(pb);
    });

    it('produces same key for same state (case-insensitive)', () => {
        const a = generateLessonPlanCacheKey({ ...baseParams, state: 'Karnataka' });
        const b = generateLessonPlanCacheKey({ ...baseParams, state: 'karnataka' });
        const c = generateLessonPlanCacheKey({ ...baseParams, state: '  KARNATAKA  ' });
        expect(a).toBe(b);
        expect(a).toBe(c);
    });

    it('treats missing state as the generic India bucket', () => {
        const noState = generateLessonPlanCacheKey(baseParams);
        const india = generateLessonPlanCacheKey({ ...baseParams, state: 'India' });
        expect(noState).toBe(india);
    });

    it('is stable for identical inputs', () => {
        const k1 = generateLessonPlanCacheKey({ ...baseParams, state: 'West Bengal' });
        const k2 = generateLessonPlanCacheKey({ ...baseParams, state: 'West Bengal' });
        expect(k1).toBe(k2);
    });
});
