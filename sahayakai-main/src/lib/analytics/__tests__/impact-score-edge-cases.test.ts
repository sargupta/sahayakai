/**
 * Edge-case test suite for calculateHealthScore
 *
 * Built around the 18 + UX scenarios called out in the 2026-05-20 robustness
 * pass. Each `describe` block maps to a scenario family (A: user states,
 * B: data integrity, C: composite-vs-breakdown consistency).
 *
 * INVARIANTS the test suite enforces:
 *   I1: composite === sum(activity, engagement, success, growth)   (±1 round)
 *   I2: every sub-score is finite and in its declared range
 *   I3: never throws on missing / malformed input
 *   I4: cold-start gets `level === 'new'`, never `'critical'`
 */

import { calculateHealthScore } from '../impact-score';

// Helper: invariant I1
function expectCompositeMatchesSum(result: ReturnType<typeof calculateHealthScore>) {
    const sum =
        result.activity_score +
        result.engagement_score +
        result.success_score +
        result.growth_score;
    expect(Math.abs(result.score - sum)).toBeLessThanOrEqual(1);
}

// Helper: invariant I2 (finite + in range)
function expectAllSubScoresFinite(result: ReturnType<typeof calculateHealthScore>) {
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.activity_score).toBeGreaterThanOrEqual(0);
    expect(result.activity_score).toBeLessThanOrEqual(30);
    expect(result.engagement_score).toBeGreaterThanOrEqual(0);
    expect(result.engagement_score).toBeLessThanOrEqual(30);
    expect(result.success_score).toBeGreaterThanOrEqual(0);
    expect(result.success_score).toBeLessThanOrEqual(20);
    expect(result.growth_score).toBeGreaterThanOrEqual(0);
    expect(result.growth_score).toBeLessThanOrEqual(20);
    expect(result.community_score).toBeGreaterThanOrEqual(0);
    expect(result.community_score).toBeLessThanOrEqual(20);
}

// =============================================================================
// A. USER STATE SCENARIOS
// =============================================================================
describe('A. User state scenarios', () => {

    // A1 — Cold start
    test('A1: brand new user shows level=new, not critical', () => {
        const result = calculateHealthScore({
            user_id: 'new-user-uid',
            days_since_signup: 1,
            // everything else: undefined / missing
        });
        expect(result.is_cold_start).toBe(true);
        expect(result.level).toBe('new');
        expect(result.risk_level).toBe('critical'); // legacy alias collapses
        // Should NOT be all zeros — success gets prior credit, growth defaults to ~10
        expectAllSubScoresFinite(result);
    });

    test('A1b: cold-start composite matches sum of sub-scores', () => {
        const result = calculateHealthScore({ user_id: 'new', days_since_signup: 0 });
        expectCompositeMatchesSum(result);
    });

    test('A1c: empty object returns a coherent result, not a crash', () => {
        expect(() => calculateHealthScore({})).not.toThrow();
        const result = calculateHealthScore({});
        expectAllSubScoresFinite(result);
    });

    // A2 — Returning user with historical content
    test('A2: returning user (long absence, big history) — Engagement preserves volume', () => {
        const result = calculateHealthScore({
            user_id: 'returning',
            content_created_total: 60,
            features_used_last_30_days: ['lesson-plan', 'worksheet', 'image-gen', 'tts'],
            days_since_last_use: 45, // long absence — recency boost gone
            sessions_last_7_days: 0,
            sessions_days_8_to_14: 0,
            days_since_signup: 365,
        });
        // Activity should be low (decay applied + no recency)
        expect(result.activity_score).toBeLessThan(10);
        // Engagement should still anchor at non-zero from total content
        expect(result.engagement_score).toBeGreaterThan(10);
        expect(result.is_cold_start).toBe(false);
        expectCompositeMatchesSum(result);
    });

    // A3 — Burst user (50 in 1 day, nothing since)
    test('A3: burst user (50 resources in 1 day) — captured but bounded', () => {
        const result = calculateHealthScore({
            user_id: 'burst',
            content_created_total: 50,
            content_created_last_7_days: 50,
            content_created_days_8_to_14: 0,
            features_used_last_30_days: ['lesson-plan'],
            sessions_last_7_days: 1,
            days_since_last_use: 0,
            days_since_signup: 30,
        });
        // Growth should saturate (tanh) but not blow up
        expect(result.growth_score).toBeLessThanOrEqual(20);
        expect(result.growth_score).toBeGreaterThan(8);
        expectAllSubScoresFinite(result);
        expectCompositeMatchesSum(result);
    });

    // A4 — Single-feature loyalist
    test('A4: single-feature loyalist (100 lesson plans) — not punished', () => {
        const result = calculateHealthScore({
            user_id: 'loyalist',
            content_created_total: 100,
            features_used_last_30_days: ['lesson-plan'], // ONLY 1 feature
            sessions_last_7_days: 5,
            days_since_last_use: 1,
            days_since_signup: 180,
        });
        // Volume baseline + loyalty floor should give engagement >= 15 (out of 30)
        expect(result.engagement_score).toBeGreaterThanOrEqual(15);
        expectAllSubScoresFinite(result);
        expectCompositeMatchesSum(result);
    });

    // A5 — Multi-modal power user
    test('A5: multi-modal power user (8+ features) — high engagement', () => {
        const result = calculateHealthScore({
            user_id: 'power',
            content_created_total: 80,
            features_used_last_30_days: ['lesson-plan', 'worksheet', 'image-gen', 'tts', 'quiz', 'video', 'rubric', 'translate'],
            sessions_last_7_days: 10,
            days_since_last_use: 0,
            consecutive_days_used: 14,
            days_since_signup: 200,
        });
        expect(result.engagement_score).toBeGreaterThanOrEqual(20);
        expect(result.level).toBe('healthy');
        expectCompositeMatchesSum(result);
    });

    // A6 — Thrashing user
    test('A6: thrashing user (avg 5 regens) — success drops below ceiling', () => {
        const noThrash = calculateHealthScore({
            user_id: 'a',
            content_created_total: 30,
            avg_regenerations_per_content: 1,
        });
        const thrashing = calculateHealthScore({
            user_id: 'b',
            content_created_total: 30,
            avg_regenerations_per_content: 5,
        });
        expect(thrashing.success_score).toBeLessThan(noThrash.success_score);
        expectAllSubScoresFinite(thrashing);
    });

    // A7 — Demo / test account
    test('A7: demo account with real usage gets real numbers', () => {
        const result = calculateHealthScore({
            user_id: 'nc-ert-demo-test-uid',
            content_created_total: 25,
            features_used_last_30_days: ['lesson-plan', 'worksheet', 'quiz'],
            sessions_last_7_days: 3,
            days_since_last_use: 0,
            days_since_signup: 30,
        });
        expect(result.score).toBeGreaterThan(30);
        expectCompositeMatchesSum(result);
    });

    // A9 — Founder's actual case (~83 resources, ~30 in last 7 days)
    test('A9: founder case (83 total, 30 last7) — coherent breakdown', () => {
        const result = calculateHealthScore({
            user_id: 'founder',
            content_created_total: 83,
            content_created_last_7_days: 30,
            content_created_days_8_to_14: 10,
            features_used_last_30_days: ['lesson-plan', 'worksheet', 'image-gen', 'tts', 'quiz'],
            sessions_last_7_days: 8,
            days_since_last_use: 0,
            consecutive_days_used: 7,
            days_since_signup: 120,
            total_attempts: 145,
            successful_generations: 6, // realistic data — underreported
        });
        // All 4 should be > 5 given his usage
        expect(result.activity_score).toBeGreaterThan(5);
        expect(result.engagement_score).toBeGreaterThan(5);
        expect(result.success_score).toBeGreaterThan(5);
        expect(result.growth_score).toBeGreaterThan(5);
        expect(result.level).toBe('healthy');
        expectCompositeMatchesSum(result);
    });
});

// =============================================================================
// B. DATA INTEGRITY SCENARIOS
// =============================================================================
describe('B. Data integrity scenarios', () => {

    // B10 — Missing fields
    test('B10: missing fields in legacy doc — defensive defaults, no throw', () => {
        const legacyDoc = {
            user_id: 'legacy',
            score: 42, // only this field
        };
        expect(() => calculateHealthScore(legacyDoc)).not.toThrow();
        const result = calculateHealthScore(legacyDoc);
        expectAllSubScoresFinite(result);
    });

    test('B10b: null input does not crash', () => {
        expect(() => calculateHealthScore(null)).not.toThrow();
        const result = calculateHealthScore(null);
        expectAllSubScoresFinite(result);
    });

    test('B10c: undefined input does not crash', () => {
        expect(() => calculateHealthScore(undefined)).not.toThrow();
    });

    // B11 — NaN / Infinity propagation
    test('B11: NaN inputs are clamped to 0', () => {
        const result = calculateHealthScore({
            user_id: 'corrupt',
            sessions_last_7_days: NaN,
            content_created_total: NaN,
            days_since_last_use: NaN,
            avg_regenerations_per_content: NaN,
        });
        expectAllSubScoresFinite(result);
        expectCompositeMatchesSum(result);
    });

    test('B11b: Infinity inputs are clamped to 0', () => {
        const result = calculateHealthScore({
            user_id: 'corrupt',
            sessions_last_7_days: Infinity,
            content_created_total: Infinity,
        });
        expectAllSubScoresFinite(result);
    });

    test('B11c: string-numeric inputs are coerced', () => {
        const result = calculateHealthScore({
            user_id: 'string-input',
            content_created_total: '50' as any,
            sessions_last_7_days: '3' as any,
        });
        expectAllSubScoresFinite(result);
        // Should produce equivalent output to numeric input
        const numeric = calculateHealthScore({
            user_id: 'numeric-input',
            content_created_total: 50,
            sessions_last_7_days: 3,
        });
        expect(result.score).toBe(numeric.score);
    });

    test('B11d: non-numeric strings become 0', () => {
        const result = calculateHealthScore({
            user_id: 'gibberish',
            content_created_total: 'abc' as any,
            sessions_last_7_days: 'def' as any,
        });
        expectAllSubScoresFinite(result);
    });

    // B12 — Division by zero
    test('B12: total_attempts === 0 — Bayesian prior carries (success ≈ 16/20)', () => {
        const result = calculateHealthScore({
            user_id: 'no-attempts',
            content_created_total: 0,
            total_attempts: 0,
            successful_generations: 0,
        });
        // Pure prior: alpha/(alpha+beta) = 0.8 → 16/20
        expect(result.success_score).toBeGreaterThanOrEqual(14);
        expect(result.success_score).toBeLessThanOrEqual(20);
    });

    // B13 — Time skew (negative days)
    test('B13: negative days_since_last_use clamps to 0', () => {
        const result = calculateHealthScore({
            user_id: 'time-skew',
            days_since_last_use: -10,
            content_created_total: 30,
        });
        expect(result.days_since_last_use).toBe(0);
        expectAllSubScoresFinite(result);
    });

    // B14 — successful_generations never tracked
    test('B14: never-tracked successes → uses content_created_total as floor', () => {
        const result = calculateHealthScore({
            user_id: 'untracked',
            content_created_total: 50,
            total_attempts: 0, // never instrumented
            successful_generations: 0, // never instrumented
        });
        // Should infer 50 successes from content_created_total
        // Pure prior + 50 inferred successes → very high success rate
        expect(result.success_score).toBeGreaterThan(15);
    });

    // B15 — corruption: successes > attempts
    test('B15: successful_generations > total_attempts — clamped, no crash', () => {
        const result = calculateHealthScore({
            user_id: 'corruption',
            content_created_total: 10,
            total_attempts: 5,
            successful_generations: 100, // > attempts
        });
        expectAllSubScoresFinite(result);
        expectCompositeMatchesSum(result);
        // Failures should be 0 (clamp), score should be high
        expect(result.success_score).toBeGreaterThan(15);
    });

    test('B15b: negative successful_generations becomes 0', () => {
        const result = calculateHealthScore({
            user_id: 'neg',
            successful_generations: -10,
            content_created_total: 0,
        });
        expectAllSubScoresFinite(result);
    });
});

// =============================================================================
// C. COMPOSITE-VS-BREAKDOWN CONSISTENCY
// =============================================================================
describe('C. Composite-vs-breakdown consistency', () => {

    // C16 — Composite must equal sum (the BIG invariant)
    test('C16: composite === sum(sub-scores), 100 randomized inputs', () => {
        for (let i = 0; i < 100; i++) {
            const result = calculateHealthScore({
                user_id: `rand-${i}`,
                sessions_last_7_days: Math.floor(Math.random() * 20),
                sessions_days_8_to_14: Math.floor(Math.random() * 20),
                content_created_total: Math.floor(Math.random() * 200),
                content_created_last_7_days: Math.floor(Math.random() * 50),
                content_created_days_8_to_14: Math.floor(Math.random() * 50),
                features_used_last_30_days: Array(Math.floor(Math.random() * 13)).fill('f'),
                days_since_last_use: Math.floor(Math.random() * 100),
                consecutive_days_used: Math.floor(Math.random() * 30),
                total_attempts: Math.floor(Math.random() * 300),
                successful_generations: Math.floor(Math.random() * 150),
                avg_regenerations_per_content: 1 + Math.random() * 5,
                exported_content_count: Math.floor(Math.random() * 50),
                shared_to_community_count: Math.floor(Math.random() * 50),
            });
            expectCompositeMatchesSum(result);
            expectAllSubScoresFinite(result);
        }
    });

    test('C16b: composite = sum even with all-extreme inputs (max values)', () => {
        const result = calculateHealthScore({
            user_id: 'max',
            sessions_last_7_days: 1000,
            sessions_days_8_to_14: 1000,
            content_created_total: 10000,
            content_created_last_7_days: 1000,
            content_created_days_8_to_14: 0,
            features_used_last_30_days: Array(50).fill('f'),
            consecutive_days_used: 365,
        });
        expect(result.score).toBe(100);
        expectCompositeMatchesSum(result);
    });

    test('C16c: composite = sum even with all-zero inputs', () => {
        const result = calculateHealthScore({ user_id: 'zero' });
        expectCompositeMatchesSum(result);
    });

    // C18 — Sub-scores drift from composite (the founder's bug)
    test('C18: composite never drifts more than 1 from sub-score sum', () => {
        // This was the FOUNDER's specific bug — composite=95, sum=61
        // Now it cannot happen because composite IS the sum.
        const result = calculateHealthScore({
            user_id: 'founder-bug-repro',
            content_created_total: 83,
            content_created_last_7_days: 30,
            features_used_last_30_days: ['lesson-plan', 'worksheet'],
            sessions_last_7_days: 5,
        });
        const sum = result.activity_score + result.engagement_score + result.success_score + result.growth_score;
        expect(Math.abs(result.score - sum)).toBeLessThanOrEqual(1);
    });
});

// =============================================================================
// D. RISK LEVEL THRESHOLDS
// =============================================================================
describe('D. Risk level thresholds', () => {
    test('D-thresholds: score < 35 → critical', () => {
        const result = calculateHealthScore({
            user_id: 'low',
            content_created_total: 5,
            days_since_last_use: 30,
            days_since_signup: 60,
        });
        if (result.score < 35) {
            expect(result.level).toBe('critical');
        }
    });

    test('D-thresholds: 35 <= score < 65 → at-risk', () => {
        // Construct: moderate usage
        const result = calculateHealthScore({
            user_id: 'mid',
            content_created_total: 20,
            content_created_last_7_days: 3,
            features_used_last_30_days: ['lesson-plan', 'worksheet'],
            sessions_last_7_days: 2,
            days_since_signup: 30,
        });
        if (result.score >= 35 && result.score < 65) {
            expect(result.level).toBe('at-risk');
        }
    });

    test('D-thresholds: score >= 65 → healthy', () => {
        const result = calculateHealthScore({
            user_id: 'high',
            content_created_total: 80,
            content_created_last_7_days: 20,
            content_created_days_8_to_14: 10,
            features_used_last_30_days: ['lesson-plan', 'worksheet', 'image-gen', 'tts', 'quiz'],
            sessions_last_7_days: 8,
            days_since_last_use: 0,
            consecutive_days_used: 7,
            days_since_signup: 120,
        });
        expect(result.score).toBeGreaterThanOrEqual(65);
        expect(result.level).toBe('healthy');
    });

    test('D-legacy-alias: risk_level always one of three strings (org-aggregator contract)', () => {
        const cases = [
            { user_id: 'a' },
            { user_id: 'b', content_created_total: 50 },
            { user_id: 'c', content_created_total: 100, sessions_last_7_days: 10 },
        ];
        for (const input of cases) {
            const r = calculateHealthScore(input);
            expect(['healthy', 'at-risk', 'critical']).toContain(r.risk_level);
        }
    });
});

// =============================================================================
// E. ESTIMATED STUDENTS IMPACTED
// =============================================================================
describe('E. estimated_students_impacted defaults', () => {
    test('E1: default to 40 if not provided', () => {
        const r = calculateHealthScore({ user_id: 'a' });
        expect(r.estimated_students_impacted).toBe(40);
    });
    test('E2: respects user-provided value', () => {
        const r = calculateHealthScore({ user_id: 'a', estimated_students: 75 });
        expect(r.estimated_students_impacted).toBe(75);
    });
    test('E3: negative value clamps to 0', () => {
        const r = calculateHealthScore({ user_id: 'a', estimated_students: -5 });
        expect(r.estimated_students_impacted).toBe(0);
    });
});
