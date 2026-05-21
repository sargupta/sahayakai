/**
 * Impact Score Calculation Library
 *
 * SCORING MODEL v3 (2026-05-20) — TRANSPARENT COMPOSITE
 *
 * Headline composite H(t) is now the RAW SUM of the four dimensions shown
 * to the user, so the dashboard breakdown adds up exactly to the headline:
 *
 *   H(t) = activity_score (0-30) + engagement_score (0-30)
 *        + success_score (0-20)  + growth_score (0-20)
 *
 *   Max = 100. Min = 0. No sigmoid magic.
 *
 * Why the change? v2 used a sigmoid composite that bore no visible relation
 * to the dimension breakdown. Founder observed Headline=95 while the four
 * dimensions summed to 61. The transparent sum is defensible to NCERT and
 * to any teacher inspecting their own dashboard.
 *
 * Community Impact (the old 5th dimension) is still computed for org-level
 * analytics, but it does NOT count toward the personal headline composite
 * — sharing is optional and most teachers never touch it. Penalising them
 * for that is wrong.
 *
 * Risk levels:
 *   level: 'new'      — Cold-start: < 3 resources AND < 7 days since signup.
 *                       Shown as "Getting Started", not red.
 *   level: 'critical' — H < 35.
 *   level: 'at-risk'  — 35 <= H < 65.
 *   level: 'healthy'  — H >= 65.
 *
 * Defensive read principles:
 *   - All numeric inputs pass through `safeNumber()` (NaN/Infinity → 0).
 *   - All counters non-negative (clamp at 0).
 *   - `successful_generations` clamped to `<= total_attempts` if both exist.
 *   - `days_since_last_use` clamped at 0 (no negative).
 *   - Every sub-score is clamped to its valid range BEFORE entering the sum.
 *
 * COMPOSITE INVARIANT (enforced by tests):
 *   `score === activity_score + engagement_score + success_score + growth_score`
 *   (off by at most 1 due to per-dimension Math.round)
 *
 * `risk_level` is preserved as an alias of `level` (excluding 'new' → 'critical')
 * for backward-compat with org-aggregator and any callers still on v2.
 */

export interface TeacherAnalytics {
    user_id: string;
    sessions_last_7_days: number;
    sessions_days_8_to_14: number;
    content_created_last_7_days: number;
    content_created_days_8_to_14: number;
    features_used_last_30_days: string[];
    avg_generation_time_sec: number;
    avg_regenerations_per_content: number;
    successful_generations: number;
    total_attempts: number;
    days_since_last_use: number;
    consecutive_days_used: number;
    days_since_signup: number;
    content_created_total: number;
    exported_content_count: number;
    shared_to_community_count: number;
    community_library_visits?: number;
    estimated_students: number;
    location_type: 'rural' | 'urban';
    preferred_language: string;
}

export interface HealthScoreResult {
    score: number;
    level: 'new' | 'healthy' | 'at-risk' | 'critical';
    /** Alias of `level` (with 'new' mapped to 'critical') for legacy callers. */
    risk_level: 'healthy' | 'at-risk' | 'critical';
    activity_score: number;     // 0-30
    engagement_score: number;   // 0-30
    success_score: number;      // 0-20
    growth_score: number;       // 0-20
    community_score: number;    // 0-20 (org-only, NOT in composite)
    days_since_last_use: number;
    consecutive_days_used: number;
    estimated_students_impacted: number;
    /** True when the user has too little data for a meaningful score. */
    is_cold_start: boolean;
}

/**
 * Safely coerce any value to a finite number. NaN / Infinity / null /
 * undefined / non-numeric strings all return 0. Negative values are
 * clamped to 0 because every input here is a count or a non-negative
 * duration.
 */
function safeNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined) return fallback;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n < 0 ? 0 : n;
}

/** Clamp a number to [min, max]. NaN-safe via Number.isFinite check. */
function clamp(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

export function calculateHealthScore(data: any): HealthScoreResult {
    // Defensive null-guard — never throw on missing input
    const input: any = data ?? {};

    // =========================================================================
    // NORMALIZE INPUTS — every field defensively coerced + clamped
    // =========================================================================
    const sessions_last_7_days = safeNumber(input.sessions_last_7_days);
    const sessions_days_8_to_14 = safeNumber(input.sessions_days_8_to_14);
    const content_created_last_7_days = safeNumber(input.content_created_last_7_days);
    const content_created_days_8_to_14 = safeNumber(input.content_created_days_8_to_14);
    const content_created_total = safeNumber(input.content_created_total);
    const exported_content_count = safeNumber(input.exported_content_count);
    const shared_to_community_count = safeNumber(input.shared_to_community_count);
    const community_library_visits = safeNumber(input.community_library_visits);
    const days_since_last_use = safeNumber(input.days_since_last_use); // clamped >= 0 by safeNumber
    const consecutive_days_used = safeNumber(input.consecutive_days_used);
    const days_since_signup = safeNumber(input.days_since_signup);
    const raw_total_attempts = safeNumber(input.total_attempts);
    const raw_successful_generations = safeNumber(input.successful_generations);
    const avg_regenerations_per_content = safeNumber(input.avg_regenerations_per_content, 1);
    const features_used_array: unknown[] = Array.isArray(input.features_used_last_30_days)
        ? input.features_used_last_30_days
        : [];
    const features_used_count = features_used_array.length;

    // =========================================================================
    // COLD-START DETECTION
    // A user with no real footprint shouldn't be branded "critical" — they
    // get a friendly "Getting Started" state. Threshold: fewer than 3 saved
    // resources AND signed up within the last 7 days.
    // =========================================================================
    const is_cold_start = content_created_total < 3
        && sessions_last_7_days === 0
        && sessions_days_8_to_14 === 0
        && (days_since_signup === 0 || days_since_signup < 7);

    // =========================================================================
    // DIMENSION 1: Activity with Temporal Decay — A (0..30)
    //
    // Recent sessions dominate (decay half-life ~3 days). Older sessions
    // contribute a residual. Recency boost rewards recent logins.
    // Returning user with old historical content still gets activity > 0
    // through `content_created_total` baseline (Engagement handles that).
    // =========================================================================
    const decayLambda = Math.LN2 / 3;
    const recentActivity = sessions_last_7_days * Math.exp(-decayLambda * 3.5);
    const olderActivity = sessions_days_8_to_14 * Math.exp(-decayLambda * 11);
    const recencyBoost = days_since_last_use < 30
        ? Math.exp(-decayLambda * days_since_last_use)
        : 0;

    let rawActivity01 = (recentActivity + olderActivity + (recencyBoost * 2)) / 10;
    // Sessions data is sparse / underreported in production. If we have ANY
    // content created in the last 7 days, give the user at least a small
    // activity floor — they're clearly active even if session telemetry
    // missed them. (~5/30 floor when there's recent content.)
    if (content_created_last_7_days > 0 && rawActivity01 < 0.2) {
        rawActivity01 = Math.min(0.4, 0.2 + (content_created_last_7_days / 50));
    }
    const rawActivity = clamp(rawActivity01, 0, 1);
    const activity_score = Math.round(rawActivity * 30);

    // =========================================================================
    // DIMENSION 2: Engagement — E (0..30)
    //
    // Volume-weighted Shannon entropy of feature usage. A user who uses
    // 5 features gets credit for breadth. But a power-user who hammers
    // one feature 100 times also gets credit through the volume baseline
    // — we don't punish depth.
    //
    // Single-feature loyalists: low entropy, but the volume baseline
    // preserves their score. UI surfaces a "try more features" nudge
    // elsewhere; the score itself doesn't punish them below half.
    // =========================================================================
    const safeFeatureCount = Math.max(1, features_used_count);
    const kFeatures = 13;

    const pFeature = 1.0 / safeFeatureCount;
    const entropyDepth = safeFeatureCount > 1
        ? -(safeFeatureCount * (pFeature * (Math.log(pFeature) / Math.log(kFeatures))))
        : 0;

    // Volume baseline — caps at 50 total resources for full credit
    const volumeBaseline = Math.min(1, content_created_total / 50);

    // Single-feature-loyalist floor: if user has zero feature diversity
    // but high volume, still give them 50% of volumeBaseline (their work
    // is real even if narrow).
    const loyaltyFloor = (safeFeatureCount === 1 && content_created_total >= 20)
        ? volumeBaseline * 0.5
        : 0;

    const entropyE = clamp(
        Math.max(loyaltyFloor, (0.7 * entropyDepth) + (0.3 * volumeBaseline)),
        0, 1
    );
    const engagement_score = Math.round(entropyE * 30);

    // =========================================================================
    // DIMENSION 3: Bayesian Success — S (0..20)
    //
    // Production reality: many server actions increment `total_attempts`
    // without flipping `successful_generations` (the event-tracker's
    // `event.success` field isn't wired up everywhere). That misclassifies
    // saved-and-persisted resources as failures.
    //
    // Fix: a persisted resource IS a success. We use `content_created_total`
    // as a stricter floor on successes than the (often-uninstrumented)
    // event counter. Failures = max(0, total_attempts - inferredSuccesses).
    //
    // When both counters are 0, Beta(8, 2) priors deliver a neutral
    // ~16/20 — cold-start users see realistic defaults, not punishing
    // zeros. Thrashing (regens > 1) still drags the score down.
    //
    // Corruption guard: if `successful_generations > total_attempts`
    // (which can happen from bad backfills), we clamp `total_attempts`
    // to `>= successful_generations`.
    // =========================================================================
    const priorAlpha = 8;
    const priorBeta = 2;

    const inferredSuccesses = Math.max(raw_successful_generations, content_created_total);
    const observedAttempts = Math.max(raw_total_attempts, inferredSuccesses);
    const failures = Math.max(0, observedAttempts - inferredSuccesses);

    const denom = inferredSuccesses + failures + priorAlpha + priorBeta;
    const expectedSuccessRate = denom > 0
        ? (inferredSuccesses + priorAlpha) / denom
        : priorAlpha / (priorAlpha + priorBeta); // pure prior = 0.8

    const thrashingPenalty = Math.exp(-0.4 * Math.max(0, avg_regenerations_per_content - 1));
    const rawSuccess = clamp(expectedSuccessRate * thrashingPenalty, 0, 1);

    // Floor: when telemetry is missing entirely (no attempts, no successes,
    // no thrashing data), we still want users to see ~10/20 — neutral
    // baseline, neither rewarded nor punished. This is the prior with no
    // adjustments.
    const success_score = Math.round(rawSuccess * 20);

    // =========================================================================
    // DIMENSION 4: Growth Momentum — G (0..20)
    //
    // Week-over-week delta in content creation. tanh squashing keeps
    // burst-then-quiet users from saturating at 100. Streak bonus adds
    // up to +20% for daily-active users.
    // =========================================================================
    const deltaContent = content_created_last_7_days - content_created_days_8_to_14;
    const growthVelocity = Math.tanh(0.2 * deltaContent);
    const momentumScore = 0.5 + (growthVelocity * 0.5); // 0..1
    const streakBonus = Math.min(0.2, consecutive_days_used * 0.02);
    const rawGrowth = clamp(momentumScore + streakBonus, 0, 1);
    const growth_score = Math.round(rawGrowth * 20);

    // =========================================================================
    // DIMENSION 5: Community Impact — C (0..20)  [OPTIONAL; org-only]
    //
    // Share depth (% of resources shared publicly), export reach, library
    // visits (reciprocity). Not in personal composite — most teachers
    // don't share publicly, and we don't want to penalise private use.
    // =========================================================================
    const shareDepth = content_created_total > 1
        ? Math.log10(1 + shared_to_community_count) / Math.log10(1 + content_created_total)
        : 0;
    const exportReach = content_created_total > 0
        ? Math.min(1, exported_content_count / content_created_total)
        : 0;
    const communityReciprocity = Math.min(1, community_library_visits / 20);
    const rawCommunity = clamp(
        (0.5 * shareDepth) + (0.3 * exportReach) + (0.2 * communityReciprocity),
        0, 1
    );
    const community_score = Math.round(rawCommunity * 20);

    // =========================================================================
    // COMPOSITE — transparent sum, math adds up
    // =========================================================================
    let score = activity_score + engagement_score + success_score + growth_score;
    score = clamp(score, 0, 100);
    // Defensive: ensure no NaN slipped through
    if (!Number.isFinite(score)) score = 0;

    // =========================================================================
    // LEVEL / RISK
    // =========================================================================
    let level: HealthScoreResult['level'];
    if (is_cold_start) {
        level = 'new';
    } else if (score < 35) {
        level = 'critical';
    } else if (score < 65) {
        level = 'at-risk';
    } else {
        level = 'healthy';
    }

    // Legacy alias — 'new' collapses to 'critical' so existing dashboards
    // that switch on risk_level still get a value in the original 3-tuple.
    const risk_level: HealthScoreResult['risk_level'] =
        level === 'new' ? 'critical'
        : level === 'critical' ? 'critical'
        : level === 'at-risk' ? 'at-risk'
        : 'healthy';

    const estimated_students_impacted = Math.max(0, safeNumber(input.estimated_students, 40));

    return {
        score,
        level,
        risk_level,
        activity_score,
        engagement_score,
        success_score,
        growth_score,
        community_score,
        days_since_last_use,
        consecutive_days_used,
        estimated_students_impacted,
        is_cold_start,
    };
}
