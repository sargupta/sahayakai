/**
 * API Route: GET /api/analytics/teacher-health/[userId]
 *
 * Returns teacher's health score and engagement metrics.
 *
 * SCORING MODEL v2 (2026-03-03):
 * H(t) = 100 × σ( wA·A + wE·E + wS·S + wG·G + wC·C − β )
 *
 * Five orthogonal competency dimensions:
 *   A(t) = Kinematic Activity  [Temporal Decay, λ = ln(2)/3]
 *   E(t) = Feature Engagement  [Volume-Weighted Shannon Entropy, k=13]
 *   S(t) = Success Competency  [Bayesian Beta-Binomial + Regen Dampening]
 *   G(t) = Growth Momentum     [MACD-style EMA Divergence + Streak Bonus]
 *   C(t) = Community Impact    [Share depth + Export reach + Reciprocity]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TeacherAnalytics {
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
    exported_content_count: number;       // Content downloaded/exported for classroom use
    shared_to_community_count: number;    // Content published to community library
    community_library_visits?: number;    // Times teacher browsed/downloaded others' content
    estimated_students: number;
    location_type: 'rural' | 'urban';
    preferred_language: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        const db = await getDb();
        const analyticsRef = db.collection('teacher_analytics').doc(userId);
        const analyticsDoc = await analyticsRef.get();

        if (!analyticsDoc.exists) {
            return NextResponse.json({
                score: 0,
                risk_level: 'critical',
                activity_score: 0,
                engagement_score: 0,
                success_score: 0,
                growth_score: 0,
                community_score: 0,
                days_since_last_use: 0,
                consecutive_days_used: 0,
                estimated_students_impacted: 40,
            });
        }

        const data = analyticsDoc.data() as TeacherAnalytics;
        const healthScore = calculateHealthScore(data);
        return NextResponse.json(healthScore);

    } catch (error) {
        logger.error('Failed to fetch teacher health score', error, 'ANALYTICS', { userId: (await params).userId });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export function calculateHealthScore(data: TeacherAnalytics) {

    // =========================================================================
    // DIMENSION 1: Kinematic Activity with Temporal Decay — A(t)
    // A(t) = Σ e^{-λ(t - τ_i)}, approximated via 7-day and 14-day bucket averages
    // λ = ln(2)/3 → activity value halves every 3 days
    // =========================================================================
    const decayLambda = Math.LN2 / 3;

    const recentActivity = data.sessions_last_7_days * Math.exp(-decayLambda * 3.5);  // midpoint of [0,7]
    const olderActivity = data.sessions_days_8_to_14 * Math.exp(-decayLambda * 11);   // midpoint of [8,14]
    const recencyBoost = Math.exp(-decayLambda * data.days_since_last_use);           // e^{-λ·d_last}

    let rawActivity = (recentActivity + olderActivity + (recencyBoost * 2)) * 10;
    rawActivity = Math.min(100, rawActivity);


    // =========================================================================
    // DIMENSION 2: Volume-Weighted Shannon Entropy of Feature Engagement — E(t)
    // E(t) = α·H_norm(features) + (1−α)·min(1, C_tot/50)
    // 
    // k=13: actual platform feature count (verified from analytics-events.ts + routes)
    //   Content types (8): lesson-plan, quiz, worksheet, rubric, field-trip,
    //                      visual-aid, instant-answer, micro-lesson
    //   Platform features (5): teacher-training, intent/assistant,
    //                          community-library, my-library, video-storyteller
    // =========================================================================
    const totalContent = data.content_created_total || 1;
    const featuresUsedCount = data.features_used_last_30_days?.length || 1;
    const kFeatures = 13; // UPDATE this constant when new features are added

    // Normalized Shannon Entropy: H = −Σ p·log_k(p)
    // Range: 0 (single feature) → 1 (all k features used equally)
    const pFeature = 1.0 / featuresUsedCount;
    const entropyDepth = featuresUsedCount > 1
        ? -(featuresUsedCount * (pFeature * (Math.log(pFeature) / Math.log(kFeatures))))
        : 0;

    // Volume baseline: rewards content volume for teachers with high depth in one area
    // Saturates at 1.0 after 50 content pieces (Forensic Fix — prevents E=0 for single-feature experts)
    const volumeBaseline = Math.min(1, totalContent / 50);

    // Final blend: 70% diversity + 30% volume
    const entropyE = (0.7 * entropyDepth) + (0.3 * volumeBaseline);

    let rawEngagement = entropyE * 100;
    rawEngagement = Math.min(100, rawEngagement);


    // =========================================================================
    // DIMENSION 3: Bayesian Success Competency with Regen Dampening — S(t)
    // S(t) = E[Beta(α+α₀, β+β₀)] × e^{−δ·max(0, r̄−1)}
    //
    // Prior Beta(8, 2): platform baseline of ~80% success.
    // Posterior mean converges to the teacher's true rate as evidence accumulates.
    // Regen penalty δ=0.4: each extra regeneration per content reduces score.
    // =========================================================================
    const priorAlpha = 8;
    const priorBeta = 2;

    const successes = data.successful_generations || 0;
    const failures = Math.max(0, (data.total_attempts || 0) - successes);

    const expectedSuccessRate = (successes + priorAlpha) / (successes + failures + priorAlpha + priorBeta);
    const avgRegens = data.avg_regenerations_per_content || 1.0;
    const thrashingPenalty = Math.exp(-0.4 * Math.max(0, avgRegens - 1));

    let rawSuccess = (expectedSuccessRate * 100) * thrashingPenalty;
    rawSuccess = Math.min(100, rawSuccess);


    // =========================================================================
    // DIMENSION 4: EMA Growth Momentum (MACD-style) — G(t)
    // G(t) = 50 + 50·tanh(κ·Δc) + streak_bonus
    // Δc = c_{7day} − c_{8-14day}: discrete velocity of content creation
    // tanh bounds the divergence to (−1, 1) — prevents a single spike from dominating
    // =========================================================================
    const deltaContent = data.content_created_last_7_days - data.content_created_days_8_to_14;
    const growthVelocity = Math.tanh(0.2 * deltaContent);
    const momentumScore = 50 + (growthVelocity * 50);                   // mapped to [0, 100]
    const streakBonus = Math.min(20, data.consecutive_days_used * 2); // up to +20

    let rawGrowth = momentumScore + streakBonus;
    rawGrowth = Math.min(100, Math.max(0, rawGrowth));


    // =========================================================================
    // DIMENSION 5: Community Impact Score — C(t)  [NEW]
    // Measures the teacher's role in the SahayakAI knowledge ecosystem.
    //
    // C(t) = γ₁·shareDepth + γ₂·exportReach + γ₃·communityReciprocity
    //
    // shareDepth:          log₁₀(1 + shared) / log₁₀(1 + total)
    //                      → logarithmic; rewards sharing disproportionately more for smaller libraries
    //
    // exportReach:         min(1, exported / total)
    //                      → fraction of content deemed classroom-ready (quality signal)
    //
    // communityReciprocity: min(1, visits / 20)
    //                      → teachers who learn FROM the community are more engaged members
    //
    // Weights: γ₁=0.5 (sharing), γ₂=0.3 (export/quality), γ₃=0.2 (reciprocity)
    // =========================================================================
    const sharedCount = data.shared_to_community_count || 0;
    const exportedCount = data.exported_content_count || 0;
    const communityVisits = data.community_library_visits || 0;

    const shareDepth = totalContent > 1
        ? Math.log10(1 + sharedCount) / Math.log10(1 + totalContent)
        : 0;
    const exportReach = Math.min(1, exportedCount / Math.max(1, totalContent));
    const communityReciprocity = Math.min(1, communityVisits / 20);

    let rawCommunity = ((0.5 * shareDepth) + (0.3 * exportReach) + (0.2 * communityReciprocity)) * 100;
    rawCommunity = Math.min(100, rawCommunity);


    // =========================================================================
    // CORE HEALTH EQUATION — H(t)
    // H(t) = 100 × σ( wA·A + wE·E + wS·S + wG·G + wC·C − β )
    // σ(x) = 1 / (1 + e^{−x}) — sigmoid activation bounds output to (0, 100)
    //
    // Weights reflect pedagogical priority:
    //   wG (growth) and wA (activity) are highest — a teacher who is improving
    //   and consistently present is the core SahayakAI success signal.
    //   wC (community) rewards ecosystem contribution.
    //   wS (success) penalises prompt-mastery struggles.
    //   wE (engagement) rewards breadth of platform usage.
    // =========================================================================
    const wA = 1.2;   // Activity: core platform usage signal
    const wE = 0.9;   // Engagement: feature diversity (breadth)
    const wS = 0.8;   // Success: AI generation mastery
    const wG = 1.4;   // Growth: momentum and habit formation
    const wC = 1.1;   // Community: ecosystem contribution [NEW]
    const betaOffset = 1.6; // Centers sigmoid for a 5-dimension weighted sum

    const zA = (rawActivity / 100) * wA;
    const zE = (rawEngagement / 100) * wE;
    const zS = (rawSuccess / 100) * wS;
    const zG = (rawGrowth / 100) * wG;
    const zC = (rawCommunity / 100) * wC;

    const zTotal = zA + zE + zS + zG + zC - betaOffset;
    const scaledZ = zTotal * 2.2; // Scale to active sigmoid region

    const finalHealthScore = Math.round(100 / (1 + Math.exp(-scaledZ)));


    // =========================================================================
    // DYNAMIC RISK CLASSIFICATION
    // P(churn) = 1 − H/100 → continuous churn probability
    // =========================================================================
    const pChurn = 1 - (finalHealthScore / 100);
    let riskLevel: 'healthy' | 'at-risk' | 'critical';
    if (pChurn < 0.3) riskLevel = 'healthy';
    else if (pChurn <= 0.6) riskLevel = 'at-risk';
    else riskLevel = 'critical';

    return {
        score: finalHealthScore,
        risk_level: riskLevel,
        // Scaled to backward-compatible UI chart boundaries
        activity_score: Math.round((rawActivity / 100) * 30),
        engagement_score: Math.round((rawEngagement / 100) * 30),
        success_score: Math.round((rawSuccess / 100) * 20),
        growth_score: Math.round((rawGrowth / 100) * 20),
        community_score: Math.round((rawCommunity / 100) * 20), // New dimension
        days_since_last_use: data.days_since_last_use,
        consecutive_days_used: data.consecutive_days_used,
        estimated_students_impacted: data.estimated_students || 40,
    };
}
