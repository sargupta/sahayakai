/**
 * Impact Score Calculation Library
 * 
 * SCORING MODEL v2 (2026-03-03):
 * H(t) = 100 × σ( wA·A + wE·E + wS·S + wG·G + wC·C − β )
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

export function calculateHealthScore(data: any): any {
    // =========================================================================
    // NORMALIZE INPUTS (Handle snake_case/camelCase and undefined/null)
    // =========================================================================
    const sessions_last_7_days = Number(data.sessions_last_7_days ?? 0);
    const sessions_days_8_to_14 = Number(data.sessions_days_8_to_14 ?? 0);
    const content_created_last_7_days = Number(data.content_created_last_7_days ?? 0);
    const content_created_days_8_to_14 = Number(data.content_created_days_8_to_14 ?? 0);
    const content_created_total = Number(data.content_created_total ?? 0);
    const exported_content_count = Number(data.exported_content_count ?? 0);
    const shared_to_community_count = Number(data.shared_to_community_count ?? 0);
    const community_library_visits = Number(data.community_library_visits ?? 0);
    const days_since_last_use = Number(data.days_since_last_use ?? 0);
    const consecutive_days_used = Number(data.consecutive_days_used ?? 0);
    const total_attempts = Number(data.total_attempts ?? 0);
    const successful_generations = Number(data.successful_generations ?? 0);
    const avg_regenerations_per_content = Number(data.avg_regenerations_per_content ?? 1);
    const features_used_count = (data.features_used_last_30_days?.length ?? 1);

    // =========================================================================
    // DIMENSION 1: Kinematic Activity with Temporal Decay — A(t)
    // =========================================================================
    const decayLambda = Math.LN2 / 3;
    const recentActivity = sessions_last_7_days * Math.exp(-decayLambda * 3.5);
    const olderActivity = sessions_days_8_to_14 * Math.exp(-decayLambda * 11);
    const recencyBoost = Math.exp(-decayLambda * days_since_last_use);

    let rawActivity = (recentActivity + olderActivity + (recencyBoost * 2)) * 10;
    rawActivity = Math.min(100, Math.max(0, rawActivity));

    // =========================================================================
    // DIMENSION 2: Volume-Weighted Shannon Entropy of Feature Engagement — E(t)
    // =========================================================================
    const featuresUsedCount = Math.max(1, features_used_count);
    const kFeatures = 13;

    const pFeature = 1.0 / featuresUsedCount;
    const entropyDepth = featuresUsedCount > 1
        ? -(featuresUsedCount * (pFeature * (Math.log(pFeature) / Math.log(kFeatures))))
        : 0;

    const volumeBaseline = Math.min(1, content_created_total / 50);
    const entropyE = (0.7 * entropyDepth) + (0.3 * volumeBaseline);

    let rawEngagement = entropyE * 100;
    rawEngagement = Math.min(100, Math.max(0, rawEngagement));

    // =========================================================================
    // DIMENSION 3: Bayesian Success Competency — S(t)
    // =========================================================================
    const priorAlpha = 8;
    const priorBeta = 2;

    const successes = successful_generations;
    const failures = Math.max(0, total_attempts - successes);

    const expectedSuccessRate = (successes + priorAlpha) / (successes + failures + priorAlpha + priorBeta || 1);
    const avgRegens = avg_regenerations_per_content;
    const thrashingPenalty = Math.exp(-0.4 * Math.max(0, avgRegens - 1));

    let rawSuccess = (expectedSuccessRate * 100) * thrashingPenalty;
    rawSuccess = Math.min(100, Math.max(0, rawSuccess));

    // =========================================================================
    // DIMENSION 4: EMA Growth Momentum — G(t)
    // =========================================================================
    const deltaContent = content_created_last_7_days - content_created_days_8_to_14;
    const growthVelocity = Math.tanh(0.2 * deltaContent);
    const momentumScore = 50 + (growthVelocity * 50);
    const streakBonus = Math.min(20, consecutive_days_used * 2);

    let rawGrowth = momentumScore + streakBonus;
    rawGrowth = Math.min(100, Math.max(0, rawGrowth));

    // =========================================================================
    // DIMENSION 5: Community Impact Score — C(t)
    // =========================================================================
    const shareDepth = content_created_total > 1
        ? Math.log10(1 + shared_to_community_count) / Math.log10(1 + content_created_total)
        : 0;
    const exportReach = Math.min(1, exported_content_count / Math.max(1, content_created_total));
    const communityReciprocity = Math.min(1, community_library_visits / 20);

    let rawCommunity = ((0.5 * shareDepth) + (0.3 * exportReach) + (0.2 * communityReciprocity)) * 100;
    rawCommunity = Math.min(100, Math.max(0, rawCommunity));

    // =========================================================================
    // CORE HEALTH EQUATION — H(t)
    // =========================================================================
    const wA = 1.2;
    const wE = 0.9;
    const wS = 0.8;
    const wG = 1.4;
    const wC = 1.1;
    const betaOffset = 1.6;

    const zA = (rawActivity / 100) * wA;
    const zE = (rawEngagement / 100) * wE;
    const zS = (rawSuccess / 100) * wS;
    const zG = (rawGrowth / 100) * wG;
    const zC = (rawCommunity / 100) * wC;

    const zTotal = zA + zE + zS + zG + zC - betaOffset;
    const scaledZ = zTotal * 2.2;

    const finalHealthScore = Math.round(100 / (1 + Math.exp(-scaledZ)));

    const pChurn = 1 - (finalHealthScore / 100);
    let riskLevel: 'healthy' | 'at-risk' | 'critical';
    if (pChurn < 0.3) riskLevel = 'healthy';
    else if (pChurn <= 0.6) riskLevel = 'at-risk';
    else riskLevel = 'critical';

    return {
        score: finalHealthScore,
        risk_level: riskLevel,
        activity_score: Math.round((rawActivity / 100) * 30),
        engagement_score: Math.round((rawEngagement / 100) * 30),
        success_score: Math.round((rawSuccess / 100) * 20),
        growth_score: Math.round((rawGrowth / 100) * 20),
        community_score: Math.round((rawCommunity / 100) * 20),
        days_since_last_use,
        consecutive_days_used,
        estimated_students_impacted: data.estimated_students || 40,
    };
}
